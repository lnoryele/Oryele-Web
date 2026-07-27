/**
 * POST /api/form
 *
 * Oryele website form handler — contact, careers, and newsletter.
 * Everything routes through Microsoft Graph. No third-party ESP (Resend etc).
 *
 *   contact     -> Graph sendMail. Routes to sales@oryele.com when the
 *                  Reason field is "Talk to Sales", otherwise info@oryele.com.
 *   careers     -> Graph sendMail with one inline resume attachment (2MB cap)
 *   newsletter  -> D1 subscriber table, notifies info@oryele.com by default
 *
 * Field names match the live HTML forms exactly:
 *   contact:    First Name, Last Name, Email, Firm, Reason, Message
 *   careers:    Name, Email, Phone, Title, Area, Message, Resume (file)
 *   newsletter: Email, Source
 *
 * Every submission carries a formType field. Anything not in FORMS is rejected.
 *
 * Runtime bindings (wrangler pages secret put NAME --project-name oryele-website)
 *   MS_TENANT_ID          Azure AD tenant id
 *   MS_CLIENT_ID          App registration client id
 *   MS_CLIENT_SECRET      App registration client secret value
 *   MS_SENDER             The one mailbox everything sends AS (info@oryele.com)
 *   TURNSTILE_SECRET_KEY  Turnstile secret
 *
 * Optional overrides, wrangler.jsonc vars or secrets
 *   TO_CONTACT     default info@oryele.com
 *   TO_CAREERS     default hr@oryele.com
 *   TO_SALES       default sales@oryele.com (used when Reason is "Talk to Sales")
 *   TO_NEWSLETTER  default info@oryele.com. Set to "off" to send no notification.
 *   SITE_ORIGIN           comma separated allowed origins
 *   SEND_AUTOREPLY        "true" to acknowledge the submitter
 *
 * Optional binding
 *   DB                    D1. Required for newsletter.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LOGIN = 'https://login.microsoftonline.com';
const TURNSTILE_VERIFY =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/* Graph rejects a sendMail payload at roughly 3MB. Leave headroom for the
   HTML body, the JSON envelope, and base64 expansion of the attachment. */
const MAX_MESSAGE_BYTES = 2_900_000;

const FORMS = {
  contact: {
    label: 'Contact',
    emailKey: 'Email',
    displayName: (v) => `${v['First Name'] || ''} ${v['Last Name'] || ''}`.trim(),
    to: (env, v) =>
      v['Reason'] === 'Talk to Sales'
        ? env.TO_SALES || 'sales@oryele.com'
        : env.TO_CONTACT || 'info@oryele.com',
    subject: (v) => {
      const name = `${v['First Name'] || ''} ${v['Last Name'] || ''}`.trim();
      return `Contact form: ${name}${v['Firm'] ? ' at ' + v['Firm'] : ''}`;
    },
    required: ['First Name', 'Last Name', 'Email'],
    fields: [
      { key: 'First Name', label: 'First Name', max: 100 },
      { key: 'Last Name', label: 'Last Name', max: 100 },
      { key: 'Email', label: 'Email', max: 254 },
      { key: 'Firm', label: 'Firm', max: 120 },
      { key: 'Reason', label: 'Reason', max: 60 },
      { key: 'Message', label: 'Message', max: 5000, long: true },
    ],
    success:
      'Thank you. Your message reached the Oryele team and someone will reply within one business day.',
  },

  careers: {
    label: 'Application',
    emailKey: 'Email',
    displayName: (v) => v['Name'] || '',
    to: (env) => env.TO_CAREERS || 'hr@oryele.com',
    subject: (v) =>
      `Application: ${v['Area'] || 'general interest'} from ${v['Name']}`,
    required: ['Name', 'Email', 'Area', 'Message'],
    fields: [
      { key: 'Name', label: 'Name', max: 100 },
      { key: 'Email', label: 'Email', max: 254 },
      { key: 'Phone', label: 'Phone', max: 40 },
      { key: 'Title', label: 'Current Title', max: 150 },
      { key: 'Area', label: 'Area of interest', max: 60 },
      { key: 'Message', label: 'Why Oryele', max: 5000, long: true },
    ],
    attachments: {
      fieldName: 'Resume',
      required: true,
      maxFiles: 1,
      maxBytes: 2 * 1024 * 1024,
      types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      extensions: ['.pdf', '.doc', '.docx'],
    },
    success:
      'Application received. Thank you for your interest in Oryele.',
  },

  newsletter: {
    label: 'Newsletter signup',
    emailKey: 'Email',
    displayName: () => '',
    to: (env) => env.TO_NEWSLETTER || 'info@oryele.com',
    subject: (v) => `Newsletter signup: ${v['Email']}`,
    required: ['Email'],
    fields: [
      { key: 'Email', label: 'Email', max: 254 },
      { key: 'Source', label: 'Source', max: 60 },
    ],
    turnstile: false,
    subscriber: true,
    success: 'You are on the list. Thank you for subscribing.',
  },
};

let tokenCache = { value: null, expiresAt: 0 };

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'POST') return handle(context);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders() });
  }
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}

async function handle(context) {
  const { request, env } = context;

  try {
    if (!originAllowed(request, env)) {
      return json({ ok: false, error: 'Request blocked.' }, 403);
    }

    const parsed = await readBody(request);
    if (!parsed) {
      return json({ ok: false, error: 'Could not read the submission.' }, 400);
    }
    const { data, files } = parsed;

    const type = String(data.formType || '').trim().toLowerCase();
    const form = FORMS[type];
    if (!form) {
      return json({ ok: false, error: 'Unknown form.' }, 400);
    }

    if (String(data.website || '').trim() !== '') {
      return json({ ok: true, message: form.success }, 200);
    }

    const { values, errors } = validate(form, data);
    if (errors.length) {
      return json({ ok: false, error: errors[0], fields: errors }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';

    if (form.turnstile !== false) {
      const token = data['cf-turnstile-response'] || data.turnstileToken || '';
      const check = await verifyTurnstile(env, token, ip);
      if (!check.ok) {
        return json(
          { ok: false, error: 'Spam check failed. Please reload and try again.' },
          400
        );
      }
    }

    if (form.subscriber) {
      const stored = await storeSubscriber(env, form, values, ip, request);
      if (!stored.ok) {
        return json({ ok: false, error: stored.error }, stored.status);
      }
      if (String(env.TO_NEWSLETTER || '').trim().toLowerCase() !== 'off') {
        try {
          await sendViaGraph(env, form, values, [], { ip, request });
        } catch (err) {
          console.error('newsletter notification failed', err);
        }
      }
      return json({ ok: true, message: form.success }, 200);
    }

    let attachments = [];
    if (form.attachments) {
      const built = await buildAttachments(form, files);
      if (built.error) {
        return json({ ok: false, error: built.error }, built.status || 400);
      }
      attachments = built.attachments;
    }

    await sendViaGraph(env, form, values, attachments, { ip, request });

    if (env.SEND_AUTOREPLY === 'true') {
      try {
        await sendAutoreply(env, form, values);
      } catch (err) {
        console.error('autoreply failed', err);
      }
    }

    context.waitUntil(storeSubmission(env, type, form, values, attachments, ip, request));

    return json({ ok: true, message: form.success }, 200);
  } catch (err) {
    console.error('form handler error', err && err.stack ? err.stack : err);
    return json(
      {
        ok: false,
        error:
          'We could not send your message. Please email info@oryele.com and we will pick it up right away.',
      },
      502
    );
  }
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders() });
}

function originAllowed(request, env) {
  const allow = String(env.SITE_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allow.length) return true;
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return allow.includes(origin);
}

async function readBody(request) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  try {
    if (type.includes('application/json')) {
      return { data: await request.json(), files: [] };
    }
    const form = await request.formData();
    const data = {};
    const files = [];
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') {
        data[key] = value;
      } else if (value && typeof value.arrayBuffer === 'function') {
        files.push(value);
      }
    }
    return { data, files };
  } catch {
    return null;
  }
}

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function validate(form, data) {
  const values = {};
  for (const field of form.fields) {
    values[field.key] = clean(data[field.key], field.max);
  }
  values.page = clean(data.page, 300);

  const errors = [];
  const labelOf = (key) =>
    (form.fields.find((f) => f.key === key) || { label: key }).label;

  for (const key of form.required) {
    const v = values[key] || '';
    if (key === form.emailKey) {
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) {
        errors.push('Please enter a valid email address.');
      }
      continue;
    }
    if (v.length < 2) {
      errors.push(`Please fill in the ${labelOf(key).toLowerCase()} field.`);
    }
  }

  const headerish = form.fields
    .filter((f) => !f.long)
    .map((f) => values[f.key] || '')
    .join('');
  if (/[\r\n]/.test(headerish)) {
    errors.push('Invalid characters in the form.');
  }

  return { values, errors };
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY missing, rejecting submission');
    return { ok: false };
  }
  if (!token) return { ok: false };

  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body });
  const out = await res.json();
  if (!out.success) console.warn('turnstile rejected', out['error-codes']);
  return { ok: Boolean(out.success) };
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function safeFilename(name) {
  return String(name || 'attachment')
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .slice(0, 120);
}

async function buildAttachments(form, files) {
  const rules = form.attachments;
  const usable = (files || []).filter((f) => f && f.size > 0);

  if (!usable.length) {
    if (rules.required) {
      return { error: 'Please attach your resume.', status: 400 };
    }
    return { attachments: [] };
  }

  if (usable.length > rules.maxFiles) {
    return {
      error: `Please attach no more than ${rules.maxFiles} file${rules.maxFiles === 1 ? '' : 's'}.`,
      status: 400,
    };
  }

  let total = 0;
  const attachments = [];

  for (const file of usable) {
    const name = safeFilename(file.name);
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const typeOk =
      rules.types.includes(file.type) || rules.extensions.includes(ext);
    if (!typeOk) {
      return { error: 'Please attach a PDF or Word document.', status: 415 };
    }
    if (file.size > rules.maxBytes) {
      return {
        error:
          'That file is too large. Please attach a document under 2MB, or send it by email to hr@oryele.com.',
        status: 413,
      };
    }

    const buffer = await file.arrayBuffer();
    const encoded = toBase64(buffer);
    total += encoded.length;

    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name,
      contentType: file.type || 'application/octet-stream',
      contentBytes: encoded,
    });
  }

  if (total > MAX_MESSAGE_BYTES) {
    return {
      error:
        'That attachment is too large. Please keep it under 2MB, or send it by email to hr@oryele.com.',
      status: 413,
    };
  }

  return { attachments };
}

async function getGraphToken(env) {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt > now + 60000) {
    return tokenCache.value;
  }

  for (const key of ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET']) {
    if (!env[key]) throw new Error(`Missing binding ${key}`);
  }

  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`${LOGIN}/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const out = await res.json();
  if (!res.ok || !out.access_token) {
    throw new Error(
      `Token request failed ${res.status}: ${out.error_description || out.error || 'unknown'}`
    );
  }

  tokenCache = {
    value: out.access_token,
    expiresAt: now + Number(out.expires_in || 3600) * 1000,
  };
  return tokenCache.value;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipients(list) {
  return String(list)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
}

function buildHtml(form, v, attachments, meta) {
  const row = (label, value) =>
    value
      ? `<tr><td style="padding:6px 14px 6px 0;color:#5b6472;font:600 13px/1.5 Arial,sans-serif;white-space:nowrap;vertical-align:top">${esc(
          label
        )}</td><td style="padding:6px 0;color:#101828;font:400 14px/1.6 Arial,sans-serif">${esc(
          value
        )}</td></tr>`
      : '';

  const short = form.fields
    .filter((f) => !f.long)
    .map((f) => row(f.label, v[f.key]))
    .join('');

  const long = form.fields
    .filter((f) => f.long && v[f.key])
    .map(
      (f) =>
        `<div style="margin:18px 0 6px;color:#5b6472;font:600 13px/1.5 Arial,sans-serif">${esc(
          f.label
        )}</div><div style="white-space:pre-wrap;color:#101828;font:400 14px/1.7 Arial,sans-serif;background:#f7f9fc;border:1px solid #e4e8ee;border-radius:8px;padding:14px">${esc(
          v[f.key]
        )}</div>`
    )
    .join('');

  const attached = attachments && attachments.length
    ? `<div style="margin:18px 0 0;color:#5b6472;font:600 13px/1.5 Arial,sans-serif">Attached</div>
       <div style="color:#101828;font:400 14px/1.7 Arial,sans-serif">${attachments
         .map((a) => esc(a.name))
         .join('<br>')}</div>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e4e8ee">
  <tr><td style="background:#0b1b33;padding:18px 24px">
    <span style="color:#ffffff;font:700 16px/1.3 Arial,sans-serif;letter-spacing:2px">ORYELE</span>
    <span style="color:#7fb2ff;font:400 13px/1.3 Arial,sans-serif;margin-left:10px">${esc(
      form.label
    )}</span>
  </td></tr>
  <tr><td style="padding:24px">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${short}${row(
      'Page',
      v.page
    )}</table>
    ${long}
    ${attached}
  </td></tr>
  <tr><td style="padding:14px 24px;background:#f7f9fc;border-top:1px solid #e4e8ee;color:#7a8494;font:400 12px/1.6 Arial,sans-serif">
    Received ${esc(meta.received)} &nbsp;&bull;&nbsp; IP ${esc(
      meta.ip || 'not recorded'
    )} &nbsp;&bull;&nbsp; ${esc(meta.country || 'unknown region')}<br>
    Reply directly to this email to reach the sender.
  </td></tr>
</table>
</body></html>`;
}

async function sendViaGraph(env, form, v, attachments, ctx) {
  if (!env.MS_SENDER) throw new Error('Missing binding MS_SENDER');
  const to = form.to(env, v) || env.MS_SENDER;

  const token = await getGraphToken(env);
  const meta = {
    received: easternTimestamp(),
    ip: ctx.ip,
    country: ctx.request.headers.get('CF-IPCountry') || '',
  };

  const message = {
    subject: form.subject(v),
    body: { contentType: 'HTML', content: buildHtml(form, v, attachments, meta) },
    toRecipients: recipients(to),
  };
  const email = v[form.emailKey];
  if (email) {
    const name = form.displayName(v) || email;
    message.replyTo = [{ emailAddress: { address: email, name } }];
  }
  if (attachments && attachments.length) message.attachments = attachments;

  const payload = JSON.stringify({ message, saveToSentItems: true });

  if (payload.length > MAX_MESSAGE_BYTES) {
    throw new Error('Payload above the Graph single request limit');
  }

  const res = await fetch(
    `${GRAPH}/users/${encodeURIComponent(env.MS_SENDER)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    }
  );

  if (res.status !== 202) {
    const detail = await res.text();
    throw new Error(
      `Graph sendMail failed ${res.status}: ${detail.slice(0, 400)}`
    );
  }
}

async function sendAutoreply(env, form, v) {
  const email = v[form.emailKey];
  if (!email) return;
  const token = await getGraphToken(env);
  const name = form.displayName(v);
  const first = (name || '').split(' ')[0] || 'there';

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e4e8ee;overflow:hidden">
  <tr><td style="background:#0b1b33;padding:18px 24px"><span style="color:#ffffff;font:700 16px/1.3 Arial,sans-serif;letter-spacing:2px">ORYELE</span></td></tr>
  <tr><td style="padding:24px;color:#101828;font:400 15px/1.7 Arial,sans-serif">
    <p style="margin:0 0 14px">Hi ${esc(first)},</p>
    <p style="margin:0 0 14px">${esc(form.success)}</p>
    <p style="margin:0 0 14px">If anything is time sensitive, reply to this email and it will come straight back to us.</p>
    <p style="margin:0;color:#5b6472">The Oryele Team</p>
  </td></tr>
</table>
</body></html>`;

  const res = await fetch(
    `${GRAPH}/users/${encodeURIComponent(env.MS_SENDER)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: 'We received your message',
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: email } }],
        },
        saveToSentItems: false,
      }),
    }
  );
  if (res.status !== 202) throw new Error(`autoreply status ${res.status}`);
}

async function storeSubmission(env, type, form, v, attachments, ip, request) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT INTO form_submissions
         (form_type, name, email, company, phone, subject, message, payload,
          attachment_names, page, ip, country, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        type,
        form.displayName(v) || null,
        v[form.emailKey] || null,
        v['Firm'] || null,
        v['Phone'] || null,
        v['Reason'] || v['Area'] || null,
        v['Message'] || null,
        JSON.stringify(v),
        attachments && attachments.length
          ? attachments.map((a) => a.name).join(', ')
          : null,
        v.page || null,
        ip || null,
        request.headers.get('CF-IPCountry') || null,
        (request.headers.get('User-Agent') || '').slice(0, 300) || null,
        new Date().toISOString()
      )
      .run();
  } catch (err) {
    console.error('D1 submission insert failed', err);
  }
}

async function storeSubscriber(env, form, v, ip, request) {
  if (!env.DB) {
    console.error('newsletter signup received with no D1 binding');
    return {
      ok: false,
      status: 503,
      error: 'Signups are briefly unavailable. Please try again shortly.',
    };
  }
  try {
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers
         (email, name, page, ip, country, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING`
    )
      .bind(
        v[form.emailKey],
        v['Source'] || null,
        v.page || null,
        ip || null,
        request.headers.get('CF-IPCountry') || null,
        new Date().toISOString()
      )
      .run();
    return { ok: true };
  } catch (err) {
    console.error('D1 subscriber insert failed', err);
    return {
      ok: false,
      status: 502,
      error: 'We could not save that. Please try again shortly.',
    };
  }
}

function easternTimestamp() {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()) + ' ET'
  );
}
