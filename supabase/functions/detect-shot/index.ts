import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CloudShotZone = "paint" | "mid" | "free_throw" | "three" | "corner_three" | null;
type CloudShotSide = "left" | "center" | "right" | null;
type CloudShotEvent = "shot_made" | "shot_missed" | "no_shot";

interface CloudNormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface CloudPlayerBox {
  index: number;
  box: CloudNormalizedBox;
}

interface DetectShotResponse {
  observation: string;
  event: CloudShotEvent;
  zone: CloudShotZone;
  side: CloudShotSide;
  confidence: number;
  ballVisible: boolean;
  hoopVisible: boolean;
  shotPhase: "idle" | "attempt" | "outcome";
  shotActive: boolean;
  ballBox: CloudNormalizedBox | null;
  hoopBox: CloudNormalizedBox | null;
  players: CloudPlayerBox[];
}

interface DetectShotRequest {
  imageBase64: string;
  prevImageBase64?: string;
  prevImage2Base64?: string;
  mode?: "track" | "outcome" | "calibrate";
}

const CALIBRATE_PROMPT = `You are a basketball OBJECT LOCATOR. Find exactly two things in this image.

BASKETBALL (ballBox):
- ANY round/spherical ball — color and size do NOT matter (orange, white, brown, small on TV, large on court).
- May be in a player's hands, bouncing, or in flight.
- Shape is always a circle/sphere. NEVER tag: floor logos, ad boards, heads, or circular graphics.

HOOP (hoopBox):
- Basketball goal = rectangular BACKBOARD + circular RIM (ring) hanging below it.
- Size and color do NOT matter. Tag the backboard+rims area as one box.
- Usually in upper portion of scene. NEVER tag: sideline ads, scoreboards, shot clocks, floor paint.

Return ONLY valid JSON:
{
  "observation": "where you see ball and hoop",
  "ballVisible": boolean,
  "hoopVisible": boolean,
  "ballBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 } or null,
  "hoopBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 } or null,
  "event": "no_shot",
  "shotActive": false,
  "shotPhase": "idle",
  "zone": null,
  "side": null,
  "confidence": number,
  "players": []
}

Coordinates: normalized 0-1 relative to JPEG pixels, top-left origin.
If ballVisible=true → ballBox required. If hoopVisible=true → hoopBox required.`;

const OBJECT_IDENTIFICATION = `
CRITICAL — locate these objects precisely in the IMAGE (not the phone UI):

BASKETBALL (ballBox):
- Small round sphere, orange-brown, diameter usually 1-5% of image width.
- May be in a player's hands, in flight, or on the court.
- NEVER tag: court floor paint, LED ad boards, scoreboard digits, team logos on floor, player heads, or circular graphics on sidelines.

HOOP (hoopBox):
- Orange/red circular RIM + rectangular BACKBOARD above it.
- Usually in the UPPER part of the basketball scene (rim center typically above y=0.25).
- NEVER tag: sideline advertising, "4 million" promos, floor decals, shot clocks, or TV bezels.

PLAYERS (players array) — REQUIRED when people are visible:
- Return up to 8 players with full-body bounding boxes.
- index: 1, 2, 3... for each visible player.
- ALWAYS include players array (empty [] only if zero humans visible).

If filming a TV/laptop: detect objects INSIDE the game on screen; ignore room and TV frame.
Coordinates: normalized 0-1, top-left origin, relative to the JPEG image pixels.`;

const OUTCOME_PROMPT = `You are a basketball SHOT OUTCOME classifier. Ball and hoop are visible.
${OBJECT_IDENTIFICATION}

Your ONLY job: determine if a shot happened between frames and whether it went IN or MISSED.

Analyze frames oldest → newest. Look for:
- Ball release, flight arc toward hoop
- Ball passing DOWN through rim/net = shot_made
- Ball hitting rim and bouncing OUT, airball, or clear miss = shot_missed

RULES:
1. If ball moved toward hoop or is near hoop area → shotActive=true, shotPhase="attempt" or "outcome"
2. When shotActive=true you MUST choose shot_made OR shot_missed — never no_shot
3. no_shot ONLY when players are standing/dribbling with zero shooting motion across ALL frames
4. On TV/laptop screen: ball may be tiny — still classify outcome from motion and net/rim interaction
5. Free throw: player at line with arms up = shotActive=true during release and flight

Return ONLY valid JSON:
{
  "observation": "what happened to the ball relative to the hoop",
  "ballVisible": boolean,
  "hoopVisible": boolean,
  "shotActive": boolean,
  "shotPhase": "idle" | "attempt" | "outcome",
  "event": "shot_made" | "shot_missed" | "no_shot",
  "zone": "paint" | "mid" | "free_throw" | "three" | "corner_three" | null,
  "side": "left" | "center" | "right" | null,
  "confidence": number between 0 and 1,
  "ballBox": { "x": number 0-1, "y": number 0-1, "width": number 0-1, "height": number 0-1, "confidence": number } or null,
  "hoopBox": { "x": number 0-1, "y": number 0-1, "width": number 0-1, "height": number 0-1, "confidence": number } or null,
  "players": [{ "index": number starting at 1, "x": number 0-1, "y": number 0-1, "width": number 0-1, "height": number 0-1, "confidence": number }] — up to 6 visible players

BOUNDING BOX RULES:
- Coordinates are normalized 0-1 relative to image (top-left origin).
- If ballVisible=true → ballBox MUST NOT be null.
- If hoopVisible=true → hoopBox MUST NOT be null.
- Label each visible player with index 1, 2, 3... in players array.}`;

const SCREEN_TRACKING = `
SCREEN / TV MODE (very common):
- Phone films a monitor, laptop, or TV showing a live basketball game.
- IGNORE the room, desk, bezels, and phone UI. Analyze ONLY pixels inside the game display.
- The ball on screen may be TINY (3-20 pixels, 0.5%-2% of image width). You MUST still detect it.
- To find a tiny ball: compare all frames — look for the small round object that MOVED between frames.
- Ball color on TV: orange, brown, white, or tan. A flying ball leaves a motion trail across frames.
- The hoop on TV: backboard rectangle + rim. Re-detect its position in the CURRENT frame every time.
- If the camera shakes slightly, hoop and player boxes MUST move accordingly in the current frame.`;

const TRACK_PROMPT = `You are a real-time basketball OBJECT TRACKER analyzing a sequence of camera frames.
${OBJECT_IDENTIFICATION}
${SCREEN_TRACKING}

PRIMARY TASK: Return accurate bounding boxes for the CURRENT (newest) frame ONLY.

CRITICAL DYNAMIC TRACKING RULES:
1. Compare Frame 1 → Frame 2 → Frame 3 (oldest to newest). Objects MOVE between frames.
2. ALL bounding boxes (ballBox, hoopBox, players) MUST reflect positions in Frame 3 (current) ONLY.
3. NEVER copy box coordinates from older frames. If a player moved right, their box moves right.
4. If a player left the scene, do NOT include them in players array.
5. If ball moved toward hoop, ballBox must be at the ball's NEW position in Frame 3.
6. Re-detect hoop every frame — if camera angle shifted, hoopBox must shift too.

SHOT DETECTION (secondary):
- shotActive=true when ball in flight or shooting motion across frames
- event: shot_made | shot_missed | no_shot

Return ONLY valid JSON:
{
  "observation": "where ball, hoop, players are in CURRENT frame and how they moved",
  "ballVisible": boolean,
  "hoopVisible": boolean,
  "shotActive": boolean,
  "shotPhase": "idle" | "attempt" | "outcome",
  "event": "shot_made" | "shot_missed" | "no_shot",
  "zone": "paint" | "mid" | "free_throw" | "three" | "corner_three" | null,
  "side": "left" | "center" | "right" | null,
  "confidence": number between 0 and 1,
  "ballBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 } or null,
  "hoopBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 } or null,
  "players": [{ "index": 1, "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "confidence": 0-1 }]
}

ballVisible=true → ballBox required. hoopVisible=true → hoopBox required.
Tiny ball on TV: width/height can be 0.005-0.03 (0.5%-3% of image).`;

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

function normalizeShotPhase(value: unknown): DetectShotResponse["shotPhase"] {
  if (value === "idle" || value === "attempt" || value === "outcome") {
    return value;
  }
  return "idle";
}

function normalizeBoolean(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "yes";
  }
  return false;
}

function clamp01(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeBox(value: unknown): CloudNormalizedBox | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const width = clamp01(raw.width);
  const height = clamp01(raw.height);
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    x: clamp01(raw.x),
    y: clamp01(raw.y),
    width,
    height,
    confidence: clampConfidence(raw.confidence),
  };
}

function normalizePlayers(value: unknown): CloudPlayerBox[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const players: CloudPlayerBox[] = [];
  let autoIndex = 1;
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as Record<string, unknown>;
    const index = typeof raw.index === "number" && raw.index > 0
      ? Math.floor(raw.index)
      : autoIndex++;
    const box = normalizeBox(raw.box ?? raw);
    if (box) {
      players.push({ index, box });
    }
  }
  return players.slice(0, 8);
}

function boxCenter(box: CloudNormalizedBox): { cx: number; cy: number } {
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

function pointInsideBox(px: number, py: number, box: CloudNormalizedBox): boolean {
  return px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height;
}

function overlapsPlayer(box: CloudNormalizedBox, players: CloudPlayerBox[]): boolean {
  const { cx, cy } = boxCenter(box);
  return players.some((player) => pointInsideBox(cx, cy, player.box));
}

function isValidBallBox(box: CloudNormalizedBox, _players: CloudPlayerBox[]): boolean {
  if (box.width > 0.2 || box.height > 0.2) return false;
  if (box.width < 0.001 && box.height < 0.001) return false;
  return box.confidence >= 0.12;
}

function isValidHoopBox(box: CloudNormalizedBox): boolean {
  const { cy } = boxCenter(box);
  if (cy > 0.92) return false;
  if (box.width < 0.015 || box.height < 0.012) return false;
  if (box.width > 0.6 || box.height > 0.6) return false;
  return box.confidence >= 0.12;
}

function sanitizeBoxes(result: DetectShotResponse): DetectShotResponse {
  const players = result.players ?? [];
  let ballBox = result.ballBox;
  let hoopBox = result.hoopBox;

  if (ballBox && !isValidBallBox(ballBox, players)) {
    ballBox = null;
  }
  if (hoopBox && !isValidHoopBox(hoopBox)) {
    hoopBox = null;
  }

  return {
    ...result,
    players,
    ballBox,
    hoopBox,
    ballVisible: Boolean(ballBox) || result.ballVisible,
    hoopVisible: Boolean(hoopBox) || result.hoopVisible,
  };
}

function postProcessDetection(result: DetectShotResponse): DetectShotResponse {
  const observation = result.observation.toLowerCase();
  const shootingCue = /free throw|shoot|release|shot|arc|ball in|flight|toward hoop|לזרוק|זריקה|עונשין|hands|arms|in the air/.test(
    observation,
  );
  const madeCue = /swish|through|went in|entered|scored|net|down through|made|נכנס|פגיעה|הלך פנימה/.test(
    observation,
  );
  const missCue = /miss|rim out|bounced|airball|blocked|off the rim|החטיא|החמצ|לא נכנס/.test(
    observation,
  );
  const freeThrowCue = result.zone === "free_throw" ||
    /free throw|charity|stripe|עונשין/.test(observation);

  let ballVisible = result.ballVisible;
  let hoopVisible = result.hoopVisible;
  let shotPhase = result.shotPhase;
  let shotActive = result.shotActive;
  let event = result.event;
  let zone = result.zone;
  let confidence = result.confidence;

  if (result.ballBox) {
    ballVisible = true;
  }
  if (result.hoopBox) {
    hoopVisible = true;
  }

  if (result.hoopVisible && shootingCue && !ballVisible) {
    ballVisible = true;
  }

  if (result.hoopVisible && (shootingCue || shotPhase === "attempt" || shotPhase === "outcome")) {
    shotActive = true;
  }

  if (result.hoopVisible && freeThrowCue) {
    zone = "free_throw";
    if (shotPhase === "idle" && shootingCue) {
      shotPhase = "attempt";
      shotActive = true;
    }
  }

  if (shotActive && shotPhase === "idle") {
    shotPhase = madeCue || missCue ? "outcome" : "attempt";
  }

  if (shotActive && event === "no_shot") {
    if (madeCue) {
      event = "shot_made";
      shotPhase = "outcome";
      confidence = Math.max(confidence, 0.6);
    } else if (missCue) {
      event = "shot_missed";
      shotPhase = "outcome";
      confidence = Math.max(confidence, 0.55);
    }
  }

  if (shotPhase === "outcome" && event === "no_shot") {
    if (madeCue) {
      event = "shot_made";
      confidence = Math.max(confidence, 0.55);
    } else if (missCue) {
      event = "shot_missed";
      confidence = Math.max(confidence, 0.5);
    }
  }

  return sanitizeBoxes({
    ...result,
    ballVisible,
    hoopVisible,
    shotPhase,
    shotActive,
    event,
    zone,
    confidence,
  });
}

function parseModelJson(raw: string): DetectShotResponse {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as Partial<DetectShotResponse>;

  return postProcessDetection({
    observation:
      typeof parsed.observation === "string" && parsed.observation.length > 0
        ? parsed.observation
        : "No observation provided",
    event: normalizeEvent(parsed.event),
    zone: normalizeZone(parsed.zone),
    side: normalizeSide(parsed.side),
    confidence: clampConfidence(parsed.confidence),
    ballVisible: normalizeBoolean(parsed.ballVisible),
    hoopVisible: normalizeBoolean(parsed.hoopVisible),
    shotPhase: normalizeShotPhase(parsed.shotPhase),
    shotActive: normalizeBoolean(parsed.shotActive),
    ballBox: normalizeBox(parsed.ballBox),
    hoopBox: normalizeBox(parsed.hoopBox),
    players: normalizePlayers(parsed.players),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<DetectShotResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    const error = new Error(`Gemini API error (${response.status}): ${errorText}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
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

function buildImageParts(
  imageBase64: string,
  prevImageBase64?: string,
  prevImage2Base64?: string,
  mode: "track" | "outcome" | "calibrate" = "track",
): Array<Record<string, unknown>> {
  const prompt = mode === "calibrate"
    ? CALIBRATE_PROMPT
    : mode === "outcome"
    ? OUTCOME_PROMPT
    : TRACK_PROMPT;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  if (mode === "calibrate") {
    parts.push({ text: "Calibration frame — locate ball and hoop precisely:" });
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: imageBase64,
      },
    });
    return parts;
  }

  if (prevImage2Base64) {
    parts.push({ text: "Frame 1 (oldest — start motion comparison here):" });
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: prevImage2Base64,
      },
    });
  }

  if (prevImageBase64) {
    parts.push({ text: "Frame 2 (previous):" });
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: prevImageBase64,
      },
    });
  }

  const frameLabel = prevImageBase64 || prevImage2Base64
    ? "Frame 3 (CURRENT — all boxes MUST match this frame exactly, objects may have moved):"
    : "Current frame:";
  parts.push({ text: frameLabel });
  parts.push({
    inline_data: {
      mime_type: "image/jpeg",
      data: imageBase64,
    },
  });

  return parts;
}

async function callGemini(
  imageBase64: string,
  prevImageBase64?: string,
  prevImage2Base64?: string,
  mode: "track" | "outcome" | "calibrate" = "track",
): Promise<DetectShotResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const parts = buildImageParts(imageBase64, prevImageBase64, prevImage2Base64, mode);

  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await callGeminiModel(model, apiKey, parts);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const status = (err as Error & { status?: number }).status;
      if (status === 429 || status === 503 || status === 404) {
        await delay(status === 429 ? 1000 : 500);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Gemini vision request failed on all models.");
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
    { type: "text", text: TRACK_PROMPT },
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
  prevImage2Base64?: string,
  mode: "track" | "outcome" | "calibrate" = "track",
): Promise<DetectShotResponse> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (geminiKey) {
    try {
      return await callGemini(imageBase64, prevImageBase64, prevImage2Base64, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as Error & { status?: number }).status;
      const quotaExceeded = status === 429 || message.includes("quota");

      if (openaiKey && quotaExceeded) {
        console.warn("Gemini quota exceeded, falling back to OpenAI");
        return callOpenAI(imageBase64, prevImageBase64);
      }

      if (quotaExceeded && message.includes("free_tier")) {
        throw new Error(
          "GEMINI_FREE_TIER: API key is still on free tier. Enable billing at https://aistudio.google.com/apikey and update GEMINI_API_KEY in Supabase secrets.",
        );
      }

      throw error;
    }
  }

  if (openaiKey) {
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

    const resolvedMode = body.mode === "outcome"
      ? "outcome"
      : body.mode === "calibrate"
      ? "calibrate"
      : "track";

    const result = await detectShot(
      body.imageBase64,
      body.prevImageBase64,
      body.prevImage2Base64,
      resolvedMode,
    );
    return jsonResponse(result);
  } catch (error) {
    console.error("detect-shot error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
