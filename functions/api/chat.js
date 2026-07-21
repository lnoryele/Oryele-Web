// Cloudflare Pages Function: /api/chat
// Proxies to Mistral on AWS EC2 via ALB (OpenAI-compatible API).
//
// For local dev with wrangler pages dev, set MISTRAL_LOCAL=true in .dev.vars
// so the function hits localhost:8000 instead of the ALB.

const MISTRAL_URL       = 'http://oryele-mistral-alb-1544237830.us-east-1.elb.amazonaws.com/v1/chat/completions';
const MISTRAL_URL_LOCAL = 'http://localhost:8000/v1/chat/completions';
const MISTRAL_MODEL     = 'mistral';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { messages, system } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400);
  }

  const fullMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const headers = { 'Content-Type': 'application/json' };
  if (env.MISTRAL_API_KEY) {
    headers['Authorization'] = `Bearer ${env.MISTRAL_API_KEY}`;
  }

  const url =
    String(env.MISTRAL_LOCAL || '').toLowerCase() === 'true'
      ? MISTRAL_URL_LOCAL
      : MISTRAL_URL;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: fullMessages,
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return json({ error: data.error?.message || 'Upstream error' }, upstream.status);
    }

    const text = data.choices?.[0]?.message?.content || 'No response received.';
    return json({ content: [{ text }] }, 200);

  } catch (err) {
    return json({ error: 'Could not reach Mistral server: ' + (err.message || err) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
