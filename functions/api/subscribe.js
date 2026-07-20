// Cloudflare Pages Function: /api/subscribe
// Stores subscriber in KV and sends notification via Resend.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email, source = 'footer' } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400, request);
    }

    const key = 'subscriber:' + email.toLowerCase().trim();
    const ts  = new Date().toISOString();

    if (env.SUBSCRIBERS) {
      const existing = await env.SUBSCRIBERS.get(key);
      if (existing) {
        return json({ ok: true, message: 'Already subscribed' }, 200, request);
      }
      await env.SUBSCRIBERS.put(key, JSON.stringify({
        email: email.toLowerCase().trim(),
        source,
        subscribedAt: ts,
      }));
    }

    // Notify via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Oryele Website <onboarding@resend.dev>',
        to: ['info@oryele.com'],
        subject: 'New newsletter subscriber: ' + email,
        text: 'New subscriber:\n\nEmail: ' + email + '\nSource: ' + source + '\nTime: ' + ts,
      }),
    });

    return json({ ok: true }, 200, request);

  } catch (err) {
    return json({ error: 'Server error' }, 500, request);
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
