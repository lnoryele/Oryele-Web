const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  try {
    if (!env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY');
      return json({
        ok: false,
        error: 'Application delivery is not configured. Please email your resume to hr@oryele.com.',
      }, 503);
    }

    const incoming = await request.formData();
    const name = clean(incoming.get('Name'));
    const email = clean(incoming.get('Email'));
    const phone = clean(incoming.get('Phone')) || 'Not provided';
    const title = clean(incoming.get('Title')) || 'Not provided';
    const area = clean(incoming.get('Area'));
    const message = clean(incoming.get('Message'));
    const resume = incoming.get('Resume');

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

    const attachmentBytes = new Uint8Array(await resume.arrayBuffer());
    const attachmentBase64 = bytesToBase64(attachmentBytes);
    const toEmail = env.CAREERS_TO_EMAIL || 'hr@oryele.com';
    const fromEmail = env.CAREERS_FROM_EMAIL || 'Oryele Careers <careers@oryele.ai>';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `New Oryele application: ${name} — ${area}`,
        html: buildEmail({ name, email, phone, title, area, message, resumeName: resume.name }),
        text: buildText({ name, email, phone, title, area, message, resumeName: resume.name }),
        attachments: [{
          filename: resume.name,
          content: attachmentBase64,
          content_type: resume.type || 'application/octet-stream',
        }],
      }),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok || !resendBody.id) {
      console.error('Resend careers failure', resendResponse.status, JSON.stringify(resendBody));
      return json({
        ok: false,
        error: 'We could not deliver your application. Please email your resume to hr@oryele.com.',
      }, 502);
    }

    return json({ ok: true, id: resendBody.id });
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

function clean(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmail(data) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0b1526;line-height:1.55;max-width:680px;margin:auto">
      <h1 style="font-size:24px;margin:0 0 20px">New Oryele job application</h1>
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', data.name)}
        ${row('Email', data.email)}
        ${row('Phone', data.phone)}
        ${row('Current title', data.title)}
        ${row('Area of interest', data.area)}
        ${row('Resume', data.resumeName)}
      </table>
      <h2 style="font-size:18px;margin:26px 0 8px">Why Oryele?</h2>
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(data.message)}</p>
    </div>`;
}

function row(label, value) {
  return `<tr><td style="padding:9px 12px;border:1px solid #dbe3ee;background:#f7f9fc;font-weight:700;width:160px">${escapeHtml(label)}</td><td style="padding:9px 12px;border:1px solid #dbe3ee">${escapeHtml(value)}</td></tr>`;
}

function buildText(data) {
  return [
    'New Oryele job application',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Current title: ${data.title}`,
    `Area of interest: ${data.area}`,
    `Resume: ${data.resumeName}`,
    '',
    'Why Oryele?',
    data.message,
  ].join('\n');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
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
