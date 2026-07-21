// Cloudflare Pages Function: /api/elle-feedback
// Records helpful / not helpful feedback against a prior Elle interaction.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const interactionId = String(body.interaction_id || '').trim();
  const helpful = body.helpful;
  const comment = String(body.comment || '').trim().slice(0, 1000);

  if (!/^[0-9a-f-]{36}$/i.test(interactionId)) {
    return json({ error: 'A valid interaction_id is required' }, 400);
  }

  if (typeof helpful !== 'boolean') {
    return json({ error: 'helpful must be true or false' }, 400);
  }

  const store = env.ELLE_ANALYTICS || env.SUBSCRIBERS;
  if (!store) {
    return json({ error: 'Elle analytics storage is not configured' }, 503);
  }

  const interactionKey = `elle:interaction:${interactionId}`;
  const feedbackKey = `elle:feedback:${interactionId}`;

  try {
    const rawInteraction = await store.get(interactionKey);
    if (!rawInteraction) {
      return json({ error: 'Interaction not found' }, 404);
    }

    const feedback = {
      interaction_id: interactionId,
      helpful,
      comment: comment || null,
      submitted_at: new Date().toISOString(),
    };

    let interaction;
    try {
      interaction = JSON.parse(rawInteraction);
    } catch {
      interaction = { id: interactionId };
    }

    interaction.helpful = helpful;
    interaction.feedback_comment = comment || null;
    interaction.feedback_submitted_at = feedback.submitted_at;

    await Promise.all([
      store.put(interactionKey, JSON.stringify(interaction), { expirationTtl: 31536000 }),
      store.put(feedbackKey, JSON.stringify(feedback), { expirationTtl: 31536000 }),
    ]);

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Unable to store Elle feedback:', error);
    return json({ error: 'Unable to save feedback' }, 500);
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
