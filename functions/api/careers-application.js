const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function onRequestPost({ request }) {
  try {
    const incoming = await request.formData();
    const name = String(incoming.get('Name') || '').trim();
    const email = String(incoming.get('Email') || '').trim();
    const area = String(incoming.get('Area') || '').trim();
    const message = String(incoming.get('Message') || '').trim();
    const resume = incoming.get('Resume');

    if (!name || !email || !area || !message || !(resume instanceof File) || !resume.size) {
      return json({ ok: false, error: 'Please complete all required fields and attach your resume.' }, 400);
    }

    if (resume.size > 5 * 1024 * 1024) {
      return json({ ok: false, error: 'Your resume must be 5 MB or smaller.' }, 400);
    }

    if (!ALLOWED_TYPES.has(resume.type) && !/\.(pdf|doc|docx)$/i.test(resume.name)) {
      return json({ ok: false, error: 'Please upload a PDF, DOC, or DOCX resume.' }, 400);
    }

    const outgoing = new FormData();
    outgoing.append('_subject', `New Oryele job application: ${name} - ${area}`);
    outgoing.append('_captcha', 'false');
    outgoing.append('_template', 'table');
    outgoing.append('Name', name);
    outgoing.append('Email', email);
    outgoing.append('Phone', String(incoming.get('Phone') || '').trim() || 'Not provided');
    outgoing.append('Current Title', String(incoming.get('Title') || '').trim() || 'Not provided');
    outgoing.append('Department', area);
    outgoing.append('About the applicant', message);
    outgoing.append('Resume', resume, resume.name);

    const upstream = await fetch('https://formsubmit.co/ajax/hr@oryele.com', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: outgoing,
    });

    const raw = await upstream.text();
    let data = {};
    try { data = JSON.parse(raw); } catch (_) {}

    if (!upstream.ok || !(data.success === true || data.success === 'true')) {
      console.error('Careers FormSubmit failure', upstream.status, raw);
      return json({ ok: false, error: 'We could not send your application. Please email hr@oryele.com.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Careers application error', error);
    return json({ ok: false, error: 'We could not send your application. Please email hr@oryele.com.' }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
