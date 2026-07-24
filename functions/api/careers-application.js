const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  try {
    if (!env.RESEND_API_KEY) {
      return json({
        ok: false,
        error: 'Application email service is not configured. Please email your resume to hr@oryele.com.',
      }, 503);
    }

    const form = await request.formData();
    const name = clean(form.get('Name'));
    const email = clean(form.get('Email'));
    const phone = clean(form.get('Phone')) || 'Not provided';
    const title = clean(form.get('Title')) || 'Not provided';
    const area = clean(form.get('Area'));
    const message = clean(form.get('Message'));
    const resume = form.get('Resume');

    if (!name || !email || !area || !message || !(resume instanceof File) || !resume.size) {
      return json({ ok: false, error: 'Please complete all required fields and attach your resume.' }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }
    if (resume.size > MAX_FILE_SIZE) {
      return json({ ok: false, error: 'Your resume must be 5 MB or smaller.' }, 400);
    }
    if (!ALLOWED_TYPES.has(resume.type) && !/\.(pdf|doc|docx)$/i.test(resume.name)) {
      return json({ ok: false, error: 'Please upload a PDF, DOC, or DOCX resume.' }, 400);
    }

    // The sender must use the domain verified in Resend. Oryele's website domain is oryele.ai.
    const from = env.CAREERS_FROM_EMAIL || 'Oryele Careers <careers@oryele.ai>';
    const to = env.CAREERS_TO_EMAIL || 'hr@oryele.com';
    const content = bytesToBase64(new Uint8Array(await resume.arrayBuffer()));

    const internal = await send(env.RESEND_API_KEY, {
      from,
      to: [to],
      reply_to: email,
      subject: `New Oryele application: ${name} — ${area}`,
      html: internalHtml({ name, email, phone, title, area, message, resumeName: resume.name }),
      attachments: [{
        filename: resume.name,
        content,
        content_type: resume.type || 'application/octet-stream',
      }],
    });

    if (!internal.ok) {
      const detail = resendError(internal.body);
      console.error('Careers application delivery failed', internal.status, detail);
      return json({
        ok: false,
        error: detail || 'We could not deliver your application. Please email your resume to hr@oryele.com.',
      }, 502);
    }

    const confirmation = await send(env.RESEND_API_KEY, {
      from,
      to: [email],
      reply_to: to,
      subject: 'We received your Oryele application',
      html: confirmationHtml(name, area),
    });

    if (!confirmation.ok) {
      console.error('Applicant confirmation failed', confirmation.status, resendError(confirmation.body));
    }

    return json({ ok: true, id: internal.body.id, confirmationSent: confirmation.ok });
  } catch (error) {
    console.error('Careers application error', error);
    return json({
      ok: false,
      error: 'We could not deliver your application. Please email your resume to hr@oryele.com.',
    }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}

async function send(key, payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) {
    console.error('Resend failure', response.status, JSON.stringify(body));
  }
  return { ok: response.ok && Boolean(body.id), status: response.status, body };
}

function resendError(body) {
  if (!body || typeof body !== 'object') return '';
  const message = clean(body.message || body.error);
  if (!message) return '';
  if (/api[_ -]?key|unauthori[sz]ed|forbidden/i.test(message)) {
    return 'The application email service could not authenticate. Please email your resume to hr@oryele.com.';
  }
  if (/domain|sender|from address|verified/i.test(message)) {
    return 'The application sender domain is not verified. Please email your resume to hr@oryele.com.';
  }
  return `Application delivery failed: ${message}`;
}

function clean(value) {
  return String(value || '').trim();
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function internalHtml(data) {
  return `<div style="font-family:Arial,sans-serif;color:#0b1526;line-height:1.55;max-width:680px;margin:auto"><h1>New Oryele job application</h1><p><b>Name:</b> ${esc(data.name)}<br><b>Email:</b> ${esc(data.email)}<br><b>Phone:</b> ${esc(data.phone)}<br><b>Current title:</b> ${esc(data.title)}<br><b>Area:</b> ${esc(data.area)}<br><b>Resume:</b> ${esc(data.resumeName)}</p><h2>Why Oryele?</h2><p style="white-space:pre-wrap">${esc(data.message)}</p></div>`;
}

function confirmationHtml(name, area) {
  return `<div style="font-family:Arial,sans-serif;color:#0b1526;line-height:1.6;max-width:620px;margin:auto"><div style="padding:28px;background:#07152c;color:#fff;border-radius:14px 14px 0 0"><h1 style="margin:0;font-size:26px">Application received</h1></div><div style="padding:30px;border:1px solid #dbe3ee;border-top:0;border-radius:0 0 14px 14px"><p>Hi ${esc(name)},</p><p>Thank you for your interest in Oryele. We have received your application for <strong>${esc(area)}</strong>.</p><p>Our team will review your experience and contact you if there is a suitable opportunity.</p><p>Best regards,<br><strong>Oryele Careers</strong></p></div></div>`;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
