// Cloudflare Pages Function: /api/contact
// Sends via Resend (resend.com) — requires RESEND_API_KEY secret in CF dashboard.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { first, last, email, firm, reason, message } = body;

    if (!first || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please provide your name and a valid email address.' }, 400, request);
    }

    const ts     = new Date().toISOString();
    const key    = 'contact:' + ts + ':' + email.toLowerCase();
    const record = { first, last, email, firm, reason, message, submittedAt: ts };

    // Store in KV
    if (env.SUBSCRIBERS) {
      try { await env.SUBSCRIBERS.put(key, JSON.stringify(record)); } catch (_) {}
    }

    const text = [
      'New contact form submission from oryele.ai',
      '',
      'Name:    ' + (first || '') + ' ' + (last || ''),
      'Email:   ' + email,
      'Firm:    ' + (firm || 'Not provided'),
      'Reason:  ' + (reason || 'Not selected'),
      'Message: ' + (message || 'No message'),
      '',
      'Submitted: ' + ts,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Oryele Website <onboarding@resend.dev>',
        to: ['info@oryele.com'],
        reply_to: email,
        subject: 'Contact: ' + (reason || 'General') + ' from ' + first + ' ' + (last || ''),
        text,
      }),
    });

    const resData = await res.json();
    console.log('Resend response:', res.status, JSON.stringify(resData));

    return json({ ok: true, email_status: res.status, email_ok: res.ok }, 200, request);

  } catch (err) {
    return json({ error: 'Server error: ' + (err.message || err) }, 500, request);
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function corsHeaders(request) {
  const origin = request ? (request.headers.get('Origin') || '*') : '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
