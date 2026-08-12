import { Router, type IRouter } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Free, no-key chat via Pollinations (no daily quota, no credits).
router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide at least one valid message." });
    return;
  }

  try {
    const userMessages = parsed.data.messages;

    // Free, no-key chat via Pollinations (no daily quota, no credits).
    const lastUser = userMessages[userMessages.length - 1]?.content || "";
    const systemNote = "You are Neural Link, a calm, helpful AI assistant. " +
      "Answer any topic concisely (under 150 words). " +
      "You are the assistant for Asiful Islam's portfolio (Network Engineer, CSE student, " +
      "MikroTik/Cisco/Linux/cybersecurity, also graphic/photo/video editing).";
    const fullPrompt = `${systemNote}\n\nUser: ${lastUser}\n\nNeural Link:`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      // Free, no-key chat via Pollinations GET endpoint (no daily quota, no credits).
      const url = "https://text.pollinations.ai/" + encodeURIComponent(fullPrompt);
      const resp = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Neural-Link/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        res.status(502).json({ error: "The neural core is temporarily unavailable." });
        return;
      }
      const answer = (await resp.text()).trim();
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

// Voice: server-side TTS via OpenRouter's audio endpoint (Fish Audio).
// OpenRouter exposes an OpenAI-compatible /api/v1/audio/speech endpoint that
// returns raw audio bytes. We default to the free Fish Audio model so no extra
// cost is incurred, and stream the result back to the browser.
router.post("/tts", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Please provide text to speak." });
    return;
  }
  if (text.length > 4000) {
    res.status(400).json({ error: "Text is too long to speak." });
    return;
  }

  try {
    // Free, no-key TTS via HuggingFace Inference API (no payment, no credit).
    // Fish Audio emotion bracket tags are harmless to keep (ignored by HF).
    const tone = pickEmotion(text);
    const spoken = tone ? `[${tone}] ${text}` : text;

    const hfModel = process.env.HF_TTS_MODEL || "espnet/kan-bayashi_ljspeech_vits";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const upstream = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: spoken }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok || !upstream.body) {
        req.log.error({ status: upstream.status }, "HuggingFace TTS request failed");
        res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
        return;
      }

      const contentType = upstream.headers.get("content-type") || "audio/wav";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store");
      const reader = upstream.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        await pump();
      };
      await pump();
    } catch (upErr) {
      clearTimeout(timer);
      req.log.error({ err: upErr }, "HuggingFace TTS upstream failed");
      if (!res.headersSent) {
        res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
      }
    }
  } catch (error) {
    req.log.error({ err: error }, "Neural Link TTS failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
    }
  }
});

export default router;