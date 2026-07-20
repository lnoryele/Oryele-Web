// Cloudflare Pages Function: /api/subscribe
// Stores subscriber emails in Cloudflare KV (SUBSCRIBERS namespace).
// Sends a notification email via MailChannels (free on Cloudflare Workers).
//
// Setup required in Cloudflare dashboard:
//   1. KV → Create namespace → name it "oryele-subscribers"
//   2. Pages → oryele-website → Settings → Functions → KV namespace bindings
//      Binding name: SUBSCRIBERS  →  select "oryele-subscribers"
//   3. Copy the namespace ID into wrangler.jsonc (for local dev with wrangler pages dev)
//
// To view subscribers: Cloudflare dashboard → KV → oryele-subscribers → View
// Each key is  subscriber:<email>  with JSON value {email, source, subscribedAt}

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

    // Duplicate check
    if (env.SUBSCRIBERS) {
      const existing = await env.SUBSCRIBERS.get(key);
      if (existing) {
        return json({ ok: true, message: 'Already subscribed' }, 200, request);
      }

      // Store in KV — no expiry so it persists permanently
      await env.SUBSCRIBERS.put(key, JSON.stringify({
        email: email.toLowerCase().trim(),
        source,
        subscribedAt: ts,
      }));
    }

    // Notification email via MailChannels (free Cloudflare integration)
    try {
      await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: 'info@oryele.com', name: 'Oryele' }] }],
          from: { email: 'noreply@oryele.com', name: 'Oryele Newsletter' },
          subject: 'New newsletter subscriber: ' + email,
          content: [{
            type: 'text/plain',
            value: 'New subscriber:\n\nEmail: ' + email + '\nSource: ' + source + '\nTime: ' + ts + '\n\nView all subscribers in Cloudflare KV → oryele-subscribers.',
          }],
        }),
      });
    } catch (_) {
      // Email notification failure is non-fatal — subscriber is already saved in KV
    }

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
  // Allow any origin so local dev (localhost) and production both work
  const origin = request ? (request.headers.get('Origin') || '*') : '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
