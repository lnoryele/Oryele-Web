import { retrieveKnowledge, formatKnowledgeContext } from '../_lib/elle-knowledge.js';

const MISTRAL_URL = 'http://oryele-mistral-alb-1544237830.us-east-1.elb.amazonaws.com/v1/chat/completions';
const MISTRAL_URL_LOCAL = 'http://localhost:8000/v1/chat/completions';
const MISTRAL_MODEL = 'mistral';

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

  const safeMessages = sanitiseMessages(messages);
  if (!safeMessages.length) {
    return json({ error: 'At least one valid user message is required' }, 400);
  }

  const latestUserMessage = [...safeMessages].reverse().find((message) => message.role === 'user');
  const question = latestUserMessage ? latestUserMessage.content : '';
  const greetingOnly = normalise(question) === '__greeting__';
  const sources = greetingOnly ? [] : retrieveKnowledge(question, 3);
  const route = determineRoute(question, sources);
  const confidence = calculateConfidence(question, sources, route);
  const interactionId = crypto.randomUUID();

  const orchestrationPrompt = buildOrchestrationPrompt({
    suppliedSystemPrompt: system,
    route,
    confidence,
    knowledgeContext: formatKnowledgeContext(sources),
    hasSources: sources.length > 0,
  });

  const fullMessages = [
    { role: 'system', content: orchestrationPrompt },
    ...safeMessages,
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (env.MISTRAL_API_KEY) {
    headers.Authorization = `Bearer ${env.MISTRAL_API_KEY}`;
  }

  const url = String(env.MISTRAL_LOCAL || '').toLowerCase() === 'true'
    ? MISTRAL_URL_LOCAL
    : MISTRAL_URL;

  const startedAt = Date.now();

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: fullMessages,
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return json({ error: data.error?.message || 'Upstream error' }, upstream.status);
    }

    const text = data.choices?.[0]?.message?.content || 'No response received.';
    const responseSources = sources.map(({ id, title, url }) => ({ id, title, url }));
    const responseTimeMs = Date.now() - startedAt;

    context.waitUntil(storeInteraction(env, {
      id: interactionId,
      created_at: new Date().toISOString(),
      question,
      answer: text,
      route,
      confidence,
      sources: responseSources,
      response_time_ms: responseTimeMs,
      helpful: null,
    }));

    return json({
      content: [{ text }],
      interaction_id: interactionId,
      route,
      confidence,
      sources: responseSources,
      response_time_ms: responseTimeMs,
    }, 200);
  } catch (err) {
    return json({ error: 'Could not reach Mistral server: ' + (err.message || err) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function buildOrchestrationPrompt({ suppliedSystemPrompt, route, confidence, knowledgeContext, hasSources }) {
  const base = suppliedSystemPrompt || 'You are Elle, the Oryele AI Orchestrator.';

  return `${base}\n\nORCHESTRATION ROLE\n` +
    `You are the intelligent entry point to Oryele. Determine what capability should handle the request, explain the next action, and never claim an action was executed unless the platform confirms it.\n` +
    `Selected route: ${route}.\nRetrieval confidence: ${confidence}.\n\n` +
    `APPROVED KNOWLEDGE\n${knowledgeContext}\n\nRESPONSE RULES\n` +
    `1. Answer the user's actual question directly and concisely.\n` +
    `2. Use approved knowledge when it matches. Do not invent product behavior, pricing, account data, or completed actions.\n` +
    `3. ${hasSources ? 'Base factual product guidance on the supplied sources.' : 'No approved source matched. Be transparent and give only safe general guidance or direct the user to support@oryele.ai.'}\n` +
    `4. For __greeting__, return one brief friendly sentence only.\n` +
    `5. When execution is required, state which capability should perform it: Knowledge, Workflow Engine, Digital Workforce, Communications, Governance, Analytics, or Integration.\n` +
    `6. For account-specific or security-sensitive issues, direct the user to support@oryele.ai.\n` +
    `7. Do not add a sources section; the interface renders citations separately.`;
}

function determineRoute(question, sources) {
  const q = normalise(question);
  if (q === '__greeting__' || /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) return 'conversation';
  if (/\b(email|message|notify|notification|communication|template)\b/.test(q)) return 'communications';
  if (/\b(report|dashboard|metric|analytics|performance|trend)\b/.test(q)) return 'analytics';
  if (/\b(permission|policy|risk|audit|governance|approval|access)\b/.test(q)) return 'governance';
  if (/\b(workflow|process|trigger|step|approval flow)\b/.test(q)) return 'workflow-engine';
  if (/\b(digital worker|agent|worker|automate|execute|perform)\b/.test(q)) return 'digital-workforce';
  if (/\b(connect|connector|integration|api|sharepoint|slack|teams)\b/.test(q)) return 'integration';
  if (sources.length) return 'knowledge';
  return 'support-triage';
}

function calculateConfidence(question, sources, route) {
  if (normalise(question) === '__greeting__') return 1;
  if (sources.length >= 3) return 0.95;
  if (sources.length === 2) return 0.88;
  if (sources.length === 1) return 0.76;
  if (route !== 'support-triage') return 0.55;
  return 0.25;
}

function sanitiseMessages(messages) {
  const cleaned = [];
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role)) continue;
    const content = String(message.content || '').trim();
    if (!content) continue;
    const previous = cleaned[cleaned.length - 1];
    if (previous && previous.role === message.role) {
      previous.content += `\n${content}`;
    } else {
      cleaned.push({ role: message.role, content });
    }
  }
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned.slice(-12);
}

async function storeInteraction(env, interaction) {
  const store = env.ELLE_ANALYTICS || env.SUBSCRIBERS;
  if (!store) return;
  try {
    await store.put(`elle:interaction:${interaction.id}`, JSON.stringify(interaction), {
      expirationTtl: 31536000,
    });
  } catch (error) {
    console.error('Unable to store Elle interaction:', error);
  }
}

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_\s-]/g, ' ').replace(/\s+/g, ' ').trim();
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
