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

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
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
    outgoing.append('_url', 'https://oryele.ai/careers');
    outgoing.append('_replyto', email);
    outgoing.append('Name', name);
    outgoing.append('Email', email);
    outgoing.append('Phone', String(incoming.get('Phone') || '').trim() || 'Not provided');
    outgoing.append('Current Title', String(incoming.get('Title') || '').trim() || 'Not provided');
    outgoing.append('Department', area);
    outgoing.append('About the applicant', message);
    outgoing.append('Resume', resume, resume.name);

    // FormSubmit documents file uploads on its standard multipart endpoint.
    // The AJAX endpoint is intended for JSON payloads and can reject attachments.
    const upstream = await fetch('https://formsubmit.co/hr@oryele.com', {
      method: 'POST',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json',
        'User-Agent': 'Oryele-Careers-Form/1.0',
      },
      body: outgoing,
      redirect: 'follow',
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      console.error('Careers FormSubmit failure', upstream.status, raw.slice(0, 1000));
      return json({
        ok: false,
        error: 'We could not deliver your application. Please email your resume to hr@oryele.com.',
      }, 502);
    }

    return json({ ok: true });
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
