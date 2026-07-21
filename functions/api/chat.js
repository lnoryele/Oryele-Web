// Cloudflare Pages Function: /api/chat
// Proxies to Mistral on AWS EC2 via ALB (OpenAI-compatible API).

const MISTRAL_URL = 'http://oryele-mistral-alb-1544237830.us-east-1.elb.amazonaws.com/v1/chat/completions';
const MISTRAL_URL_LOCAL = 'http://localhost:8000/v1/chat/completions';
const MISTRAL_MODEL = 'mistral';
const UPSTREAM_TIMEOUT_MS = 30000;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { messages, system, stream = false } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400);
  }

  const recentMessages = messages.slice(-8);
  const fullMessages = system
    ? [{ role: 'system', content: system }, ...recentMessages]
    : recentMessages;

  const headers = { 'Content-Type': 'application/json' };
  if (env.MISTRAL_API_KEY) headers.Authorization = `Bearer ${env.MISTRAL_API_KEY}`;

  const url = String(env.MISTRAL_LOCAL || '').toLowerCase() === 'true'
    ? MISTRAL_URL_LOCAL
    : MISTRAL_URL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: fullMessages,
        max_tokens: 220,
        temperature: 0.2,
        stream: Boolean(stream),
      }),
    });

    if (!upstream.ok) {
      const raw = await upstream.text();
      let message = 'Upstream error';
      try { message = JSON.parse(raw).error?.message || message; } catch {}
      return json({ error: message }, upstream.status);
    }

    if (stream && upstream.body) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content || 'No response received.';
    return json({
      content: [{ text }],
      interaction_id: crypto.randomUUID(),
    }, 200);
  } catch (err) {
    return json({
      error: controller.signal.aborted
        ? 'Elle took too long to respond. Please try again.'
        : 'Could not reach Mistral server: ' + (err.message || err),
    }, controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
