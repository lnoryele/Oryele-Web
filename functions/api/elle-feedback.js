export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const interactionId = body?.interaction_id;
    const helpful = body?.helpful;

    if (!interactionId || typeof helpful !== "boolean") {
      return new Response(
        JSON.stringify({
          error: "interaction_id and helpful are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Feedback is accepted even when no persistence layer is configured.
    // Add database, analytics, or logging integration here when available.
    console.log("Elle feedback received", {
      interaction_id: interactionId,
      helpful,
      feedback: body?.feedback ?? null,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Elle feedback error", error);

    return new Response(
      JSON.stringify({
        error: "Unable to process feedback",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
