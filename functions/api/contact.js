// Cloudflare Pages Function: /api/contact
// Receives contact form submissions and emails them via MailChannels.
// No additional setup needed — MailChannels is free on Cloudflare Workers.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { first, last, email, firm, reason, message } = body;

    if (!first || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please provide your name and a valid email address.' }, 400, request);
    }

    const text = [
      'New contact form submission from oryele.com',
      '',
      'Name:    ' + first + ' ' + last,
      'Email:   ' + email,
      'Firm:    ' + (firm || 'Not provided'),
      'Reason:  ' + (reason || 'Not selected'),
      'Message: ' + (message || 'No message'),
      '',
      'Time: ' + new Date().toISOString(),
    ].join('\n');

    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'info@oryele.com', name: 'Oryele' }] }],
        from: { email: 'noreply@oryele.com', name: 'Oryele Website' },
        reply_to: { email: email, name: first + ' ' + last },
        subject: 'New contact: ' + (reason || 'General') + ' from ' + first + ' ' + last,
        content: [{ type: 'text/plain', value: text }],
      }),
    });

    return json({ ok: true }, 200, request);

  } catch (err) {
    return json({ error: 'Server error. Please email info@oryele.com directly.' }, 500, request);
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
