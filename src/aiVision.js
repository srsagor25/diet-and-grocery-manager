// =================================================================
// aiVision — Claude vision call to estimate macros from a food photo.
// -----------------------------------------------------------------
// The API key is supplied by the user and lives only in their browser's
// localStorage. The request is sent direct from the browser using
// Anthropic's "dangerous direct browser access" header, which is
// appropriate for a personal/local app but not for a public deployment.
// =================================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const PROMPT = (quantity) => `You are a nutrition analyst. A user has shared a photo of food they are about to eat.

Their stated quantity is: ${JSON.stringify(quantity || "as shown in the photo")}.

Estimate the macros for that quantity. Be realistic — if the photo is ambiguous, lean toward typical portion sizes for the cuisine you can identify.

Return ONLY a single JSON object — no markdown, no commentary, no code fences. Use these exact keys:
- name           (string)  : short dish name
- kcal           (integer) : total calories for the stated quantity
- protein_g      (number)  : grams of protein
- fat_g          (number)  : grams of fat
- carbs_g        (number)  : grams of carbohydrates
- confidence     (string)  : one of "low" | "medium" | "high"
- notes          (string, max 1 short sentence) : caveat or assumption

Example output (do not copy values, just the shape):
{"name":"Chicken biryani","kcal":620,"protein_g":34,"fat_g":18,"carbs_g":78,"confidence":"medium","notes":"Assumed 1 plate ≈ 350g."}`;

function extractJson(text) {
  if (!text) return null;
  // Strip code fences if present.
  const stripped = text.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through to greedy match */
  }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function analyzeFoodPhoto({
  apiKey,
  base64,
  mediaType = "image/jpeg",
  quantity = "",
  model = DEFAULT_MODEL,
}) {
  if (!apiKey) throw new Error("Anthropic API key is not set.");
  if (!base64) throw new Error("No image provided.");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPT(quantity) },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 240) || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.content?.find((c) => c.type === "text")?.text || "";
  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error("Could not parse JSON from model response.");
  }

  // Coerce types defensively.
  const out = {
    name: String(parsed.name ?? "Photo meal"),
    kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
    protein_g: Math.max(0, Number(parsed.protein_g) || 0),
    fat_g: Math.max(0, Number(parsed.fat_g) || 0),
    carbs_g: Math.max(0, Number(parsed.carbs_g) || 0),
    confidence: ["low", "medium", "high"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium",
    notes: parsed.notes ? String(parsed.notes) : "",
  };
  return out;
}

// Resize an image File to JPEG base64 with the long side ≤ maxDim.
// 1568px is a sweet spot for Anthropic vision — large enough to read
// fine detail, small enough to keep latency and cost down.
export async function fileToResizedBase64(file, maxDim = 1568, quality = 0.85) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not decode image."));
    i.src = dataUrl;
  });

  const longSide = Math.max(img.width, img.height);
  const scale = longSide > maxDim ? maxDim / longSide : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  const base64 = out.split(",")[1] || "";
  return { base64, mediaType: "image/jpeg", width: w, height: h, dataUrl: out };
}
