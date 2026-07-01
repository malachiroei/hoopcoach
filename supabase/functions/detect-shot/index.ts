import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CloudShotZone = "paint" | "mid" | "free_throw" | "three" | "corner_three" | null;
type CloudShotSide = "left" | "center" | "right" | null;
type CloudShotEvent = "shot_made" | "shot_missed" | "no_shot";

interface DetectShotResponse {
  observation: string;
  event: CloudShotEvent;
  zone: CloudShotZone;
  side: CloudShotSide;
  confidence: number;
}

interface DetectShotRequest {
  imageBase64: string;
  prevImageBase64?: string;
}

const SYSTEM_PROMPT = `You are a basketball shot detection AI analyzing court-facing camera frames.

Return ONLY valid JSON with this exact schema:
{
  "observation": "brief description of what you see",
  "event": "shot_made" | "shot_missed" | "no_shot",
  "zone": "paint" | "mid" | "free_throw" | "three" | "corner_three" | null,
  "side": "left" | "center" | "right" | null,
  "confidence": number between 0 and 1
}

Rules:
- shot_made: the ball clearly went through the hoop
- shot_missed: a clear shot attempt that missed the basket
- no_shot: no shot attempt, idle court, or too unclear to decide
- zone: shooter court area; side: left/center/right relative to the hoop
- Use null for zone/side when unknown
- confidence reflects certainty of the event classification`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeEvent(value: unknown): CloudShotEvent {
  if (value === "shot_made" || value === "shot_missed" || value === "no_shot") {
    return value;
  }
  return "no_shot";
}

function normalizeZone(value: unknown): CloudShotZone {
  if (
    value === "paint" ||
    value === "mid" ||
    value === "free_throw" ||
    value === "three" ||
    value === "corner_three"
  ) {
    return value;
  }
  return null;
}

function normalizeSide(value: unknown): CloudShotSide {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return null;
}

function parseModelJson(raw: string): DetectShotResponse {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as Partial<DetectShotResponse>;

  return {
    observation:
      typeof parsed.observation === "string" && parsed.observation.length > 0
        ? parsed.observation
        : "No observation provided",
    event: normalizeEvent(parsed.event),
    zone: normalizeZone(parsed.zone),
    side: normalizeSide(parsed.side),
    confidence: clampConfidence(parsed.confidence),
  };
}

async function callGemini(
  imageBase64: string,
  prevImageBase64?: string,
): Promise<DetectShotResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const parts: Array<Record<string, unknown>> = [
    { text: SYSTEM_PROMPT },
    {
      inline_data: {
        mime_type: "image/jpeg",
        data: imageBase64,
      },
    },
  ];

  if (prevImageBase64) {
    parts.push({
      text: "Previous frame for motion comparison:",
    });
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: prevImageBase64,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const text =
    payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) =>
      typeof part.text === "string"
    )?.text;

  if (!text) {
    throw new Error("Gemini returned no text content");
  }

  return parseModelJson(text);
}

async function callOpenAI(
  imageBase64: string,
  prevImageBase64?: string,
): Promise<DetectShotResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: SYSTEM_PROMPT },
    {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    },
  ];

  if (prevImageBase64) {
    content.push({
      type: "text",
      text: "Previous frame for motion comparison:",
    });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${prevImageBase64}` },
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new Error("OpenAI returned no text content");
  }

  return parseModelJson(text);
}

async function detectShot(
  imageBase64: string,
  prevImageBase64?: string,
): Promise<DetectShotResponse> {
  if (Deno.env.get("GEMINI_API_KEY")) {
    return callGemini(imageBase64, prevImageBase64);
  }

  if (Deno.env.get("OPENAI_API_KEY")) {
    return callOpenAI(imageBase64, prevImageBase64);
  }

  throw new Error(
    "No vision model configured. Set GEMINI_API_KEY or OPENAI_API_KEY in Edge Function secrets.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as DetectShotRequest;

    if (!body?.imageBase64 || typeof body.imageBase64 !== "string") {
      return jsonResponse({ error: "imageBase64 is required" }, 400);
    }

    const result = await detectShot(body.imageBase64, body.prevImageBase64);
    return jsonResponse(result);
  } catch (error) {
    console.error("detect-shot error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
