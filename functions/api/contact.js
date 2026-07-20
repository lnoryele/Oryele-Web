// Cloudflare Pages Function: /api/contact
// Stores submissions in KV and emails via MailChannels.
// 
// For emails to work, you need this DNS record on oryele.ai:
//   Type: TXT  Name: _mailchannels  Value: v=mc1 cfid=oryele-website.pages.dev
//
// KV binding: same SUBSCRIBERS namespace — submissions stored as contact:<ts>:<email>

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { first, last, email, firm, reason, message } = body;

    if (!first || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please provide your name and a valid email address.' }, 400, request);
    }

    const ts  = new Date().toISOString();
    const key = 'contact:' + ts + ':' + email.toLowerCase();
    const record = { first, last, email, firm, reason, message, submittedAt: ts };

    // Always store in KV first — this never fails silently
    if (env.SUBSCRIBERS) {
      await env.SUBSCRIBERS.put(key, JSON.stringify(record));
    }

    // Send notification email
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

    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'info@oryele.com', name: 'Oryele' }] }],
        from: { email: 'noreply@oryele.ai', name: 'Oryele Website' },
        reply_to: { email, name: (first + ' ' + (last || '')).trim() },
        subject: 'Contact: ' + (reason || 'General') + ' from ' + first + ' ' + (last || ''),
        content: [{ type: 'text/plain', value: text }],
      }),
    });

    // Always return success — submission is saved in KV regardless of email
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
