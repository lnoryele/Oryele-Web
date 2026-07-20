// Cloudflare Pages Function: /api/contact
// Stores contact form submissions in KV and sends notification via MailChannels.
//
// MailChannels setup (required for emails to send):
//   1. Add a DNS TXT record on oryele.com:
//      Name: _mailchannels   Type: TXT   Value: v=mc1 cfid=oryele-website.pages.dev
//   2. This authorizes Cloudflare Workers to send email on behalf of oryele.com.
//
// KV binding (for storing submissions):
//   Same SUBSCRIBERS namespace — submissions stored as contact:<timestamp>:<email>
//   Or create a separate namespace: CONTACTS

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { first, last, email, firm, reason, message } = body;

    if (!first || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please provide your name and a valid email address.' }, 400, request);
    }

    const ts   = new Date().toISOString();
    const key  = 'contact:' + ts + ':' + email.toLowerCase();
    const data = { first, last, email, firm, reason, message, submittedAt: ts };

    // Store in KV (non-fatal if KV not configured)
    try {
      if (env.SUBSCRIBERS) {
        await env.SUBSCRIBERS.put(key, JSON.stringify(data));
      }
    } catch (_) {}

    // Send via MailChannels
    const emailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: 'info@oryele.com', name: 'Oryele' }],
          dkim_domain: 'oryele.com',
          dkim_selector: 'mailchannels',
          dkim_private_key: env.DKIM_PRIVATE_KEY || '',
        }],
        from: { email: 'noreply@oryele.com', name: 'Oryele Website' },
        reply_to: { email: email, name: (first + ' ' + last).trim() },
        subject: 'New contact: ' + (reason || 'General') + ' from ' + first + ' ' + (last || ''),
        content: [{
          type: 'text/plain',
          value: [
            'New contact form submission',
            '',
            'Name:    ' + first + ' ' + (last || ''),
            'Email:   ' + email,
            'Firm:    ' + (firm || 'Not provided'),
            'Reason:  ' + (reason || 'Not selected'),
            'Message: ' + (message || 'No message'),
            '',
            'Time: ' + ts,
          ].join('\n'),
        }],
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('MailChannels error:', emailRes.status, errText);
      // Still return ok:true — submission is saved in KV
    }

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
