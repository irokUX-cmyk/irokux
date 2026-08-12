import { Router, type IRouter } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getNousKey(): string {
  const key = process.env.NOUS_API_KEY;
  if (!key) throw new Error("NOUS_API_KEY is not configured");
  return key;
}

// Fast free Nous models, tried in parallel (Promise.any = first winner).
// Smaller models return first; the quickest reply wins for low latency.
const FAST_NOUS_MODELS = [
  "poolside/laguna-xs-2.1:free",
  "tencent/hy3:free",
  "poolside/laguna-s-2.1:free",
  "upstage/solar-pro4:free",
];

async function tryNous(model: string, apiKey: string, body: object, signal: AbortSignal): Promise<string> {
  const resp = await fetch("https://api.nousresearch.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (NeuralLink/2.0)",
    },
    body: JSON.stringify({ model, ...body }),
    signal,
  });
  if (!resp.ok) throw new Error(`Nous ${model} -> ${resp.status}`);
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error(`Nous ${model} empty`);
  return answer;
}

// Chat via Nous Research Inference API (OpenAI-compatible, free tier).
router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide at least one valid message." });
    return;
  }

  try {
    const apiKey = getNousKey();
    const userMessages = parsed.data.messages;

    const systemPrompt =
      "You are Neural Link, a calm, helpful AI assistant for Asiful Islam's personal portfolio. " +
      "Asiful is a Network Engineer / CSE student (MikroTik, Cisco, Linux, cybersecurity, also graphic/photo/video editing). " +
      "Answer any topic concisely (usually under 150 words). You are an AI interface, not a human.";

    const payload = {
      max_tokens: 320,
      messages: [
        { role: "system", content: systemPrompt },
        ...userMessages,
      ],
    };

    // Race the fast models; first successful reply wins (lowest latency).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const answer = await Promise.any(
        FAST_NOUS_MODELS.map((m) => tryNous(m, apiKey, payload, controller.signal)),
      );
      clearTimeout(timer);
      res.json(SendChatMessageResponse.parse({ answer, grounded: false }));
      return;
    } catch {
      clearTimeout(timer);
      res.status(502).json({ error: "The neural core is temporarily unavailable." });
      return;
    }
  } catch (error) {
    req.log.error({ err: error }, "Neural Link chat failed");
    res.status(502).json({ error: "The neural core is temporarily unavailable." });
  }
});

// Map message tone -> a Fish Audio bracket emotion tag so the voice sounds
// emotional/realistic. Fish Audio has no "tags" parameter; emotion is written
// inline as e.g. "[happy] Hello there". Returns null when no clear tone.
function pickEmotion(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(sad|sorry|unfortunate|regret|miss|lonely|depressed|tragic|cry|tears?)\b/.test(t)) return "sad";
  if (/\b(angry|furious|hate|annoyed|frustrat\w*|damn|wtf|stupid)\b/.test(t)) return "angry";
  if (/\b(excited|awesome|amazing|great news|congrat\w*|yes!|wohoo|lets go|love it)\b/.test(t)) return "excited";
  if (/\b(happy|glad|joy|wonderful|thank you|thanks|pleased|delight\w*)\b/.test(t)) return "happy";
  if (/\b(wow|whoa|really\?|no way|shocked|surpris\w*|omg|incredible)\b/.test(t)) return "surprised";
  if (/\b(calm|relax|peaceful|gentle|quiet|softly|take a breath)\b/.test(t)) return "calm";
  if (/\b(nervous|scared|afraid|worried|anxious|scary|danger|warning)\b/.test(t)) return "nervous";
  return null;
}

// Voice: server-side TTS. Primary = self-hosted Kokoro service (genuinely male,
// deep "Jarvis-like" voice, free & open-source). Fallback = Google Translate
// TTS (free, no token) if the Kokoro service is unavailable. Emotion bracket
// tags from the Fish Audio era are stripped since neither endpoint uses them.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ttsKokoro(text: string): Promise<{ ok: boolean; body?: ReadableStream; status?: number }> {
  const base = (process.env.TTS_SERVICE_URL || "https://irokux-tts.onrender.com").trim();
  if (!base) return { ok: false };
  const voice = (process.env.TTS_VOICE || "bm_george").trim(); // bm_george = deep male British (default)
  try {
    const resp = await fetchWithTimeout(
      `${base.replace(/\/$/, "")}/tts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      },
      10_000,
    );
    if (!resp.ok || !resp.body) return { ok: false, status: resp.status };
    return { ok: true, body: resp.body };
  } catch {
    return { ok: false };
  }
}

async function ttsGoogle(text: string): Promise<{ ok: boolean; body?: ReadableStream; status?: number }> {
  const lang = (process.env.TTS_LANG || "en").trim();
  const voice = (process.env.TTS_VOICE_GOOGLE || "0").trim(); // unused selector (Google has 1 voice)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&tt=${voice}`;
  try {
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": "Mozilla/5.0" } }, 20_000);
    if (!resp.ok || !resp.body) return { ok: false, status: resp.status };
    return { ok: true, body: resp.body };
  } catch {
    return { ok: false };
  }
}

router.post("/tts", async (req, res) => {
  const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!rawText) {
    res.status(400).json({ error: "Please provide text to speak." });
    return;
  }
  if (rawText.length > 4000) {
    res.status(400).json({ error: "Text is too long to speak." });
    return;
  }

  // Strip Fish Audio emotion bracket tags (e.g. "[happy]") — not used here.
  const text = rawText.replace(/\[[a-z]+\]\s*/gi, "").slice(0, 4000);

  const pump = async (body: ReadableStream): Promise<void> => {
    const reader = body.getReader();
    const pipe = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      await pipe();
    };
    await pipe();
  };

  try {
    // Self-hosted Kokoro (male "Jarvis-like" voice) is the preferred primary;
    // fall back to Google if the Kokoro service is unreachable.
    let upstream = await ttsKokoro(text);
    let source = "kokoro";
    if (!upstream.ok) {
      req.log.warn("Kokoro TTS unavailable, falling back to Google");
      upstream = await ttsGoogle(text);
      source = "google";
    }
    if (!upstream.ok || !upstream.body) {
      req.log.error({ status: upstream.status }, "All TTS providers failed");
      res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
      return;
    }

    res.setHeader("Content-Type", source === "kokoro" ? "audio/wav" : "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-TTS-Source", source);
    await pump(upstream.body);
  } catch (error) {
    req.log.error({ err: error }, "Neural Link TTS failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
    }
  }
});

export default router;