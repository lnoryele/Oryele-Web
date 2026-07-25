// Cloudflare Pages Function: /api/chat
// Proxies to Mistral via an OpenAI-compatible chat completions API.

const DEFAULT_MISTRAL_URL = 'http://oryele-mistral-alb-1544237830.us-east-1.elb.amazonaws.com/v1/chat/completions';
const MISTRAL_URL_LOCAL = 'http://localhost:8000/v1/chat/completions';
const DEFAULT_MODEL = 'mistral';
const ATTEMPT_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 2;

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

  const recentMessages = messages
    .slice(-8)
    .filter((message) => message && typeof message.content === 'string' && message.content.trim())
    .map((message) => ({ role: message.role, content: message.content }));

  if (!recentMessages.length) {
    return json({ error: 'At least one valid message is required' }, 400);
  }

  const fullMessages = system
    ? [{ role: 'system', content: String(system) }, ...recentMessages]
    : recentMessages;

  const headers = { 'Content-Type': 'application/json' };
  if (env.MISTRAL_API_KEY) headers.Authorization = `Bearer ${env.MISTRAL_API_KEY}`;

  const configuredUrl = String(env.MISTRAL_URL || '').trim();
  const url = String(env.MISTRAL_LOCAL || '').toLowerCase() === 'true'
    ? MISTRAL_URL_LOCAL
    : configuredUrl || DEFAULT_MISTRAL_URL;
  const model = String(env.MISTRAL_MODEL || DEFAULT_MODEL);

  const upstreamPayload = {
    model,
    messages: fullMessages,
    max_tokens: 220,
    temperature: 0.2,
    stream: Boolean(stream),
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(upstreamPayload),
      });

      if (!upstream.ok) {
        const raw = await upstream.text();
        const message = getUpstreamMessage(raw, upstream.status);
        lastError = new Error(message);

        // Retry only failures that are likely to be temporary.
        if (attempt < MAX_ATTEMPTS && shouldRetryStatus(upstream.status)) {
          await delay(350 * attempt);
          continue;
        }

        return json({
          error: message,
          retryable: shouldRetryStatus(upstream.status),
          request_id: crypto.randomUUID(),
        }, normalizeStatus(upstream.status));
      }

      if (stream && upstream.body) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            ...corsHeaders(),
            'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, no-transform',
            'X-Accel-Buffering': 'no',
            'X-Elle-Upstream-Attempt': String(attempt),
          },
        });
      }

      const data = await upstream.json();
      const text = data.choices?.[0]?.message?.content || 'No response received.';
      return json({
        content: [{ text }],
        interaction_id: crypto.randomUUID(),
        upstream_attempt: attempt,
      }, 200);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await delay(350 * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const timedOut = lastError?.name === 'AbortError';
  return json({
    error: timedOut
      ? 'Elle took too long to respond. Please try again.'
      : 'Elle could not reach the AI service. Please try again in a moment.',
    retryable: true,
    request_id: crypto.randomUUID(),
  }, timedOut ? 504 : 502);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function getUpstreamMessage(raw, status) {
  let message = `AI service returned ${status}`;
  try {
    const parsed = JSON.parse(raw);
    message = parsed?.error?.message || parsed?.error || parsed?.message || message;
  } catch {
    if (raw && raw.length < 300) message = raw;
  }
  return String(message);
}

function shouldRetryStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function normalizeStatus(status) {
  return status >= 400 && status <= 599 ? status : 502;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
