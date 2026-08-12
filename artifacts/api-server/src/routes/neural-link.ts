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

    // Free, no-key chat via Pollinations GET endpoint. Pollinations' free tier
    // only serves SHORT prompts on GET (longer ones get pushed to paid POST or
    // rate-limited), so we cap the user message length and keep it simple.
    const lastUser = userMessages[userMessages.length - 1]?.content || "";
    const shortPrompt = lastUser.slice(0, 60);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const url = "https://text.pollinations.ai/" + encodeURIComponent(shortPrompt);
      const resp = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
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

// Voice: server-side TTS via Google Translate's free TTS endpoint.
// No API key, no payment, no credit — works reliably. Supports many
// languages via the `tl` param and a couple of voices via `tt` (0=default, 1=male/alt).
// Emotion bracket tags are stripped since Google TTS doesn't use them.
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

  try {
    // Strip Fish Audio emotion bracket tags (e.g. "[happy]") — not used here.
    const text = rawText.replace(/\[[a-z]+\]\s*/gi, "").slice(0, 4000);
    const lang = (process.env.TTS_LANG || "en").trim();
    const voice = (process.env.TTS_VOICE || "0").trim(); // 0 = default, 1 = alt/male
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&tt=${voice}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const upstream = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok || !upstream.body) {
        req.log.error({ status: upstream.status }, "Google TTS request failed");
        res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
        return;
      }

      res.setHeader("Content-Type", "audio/mpeg");
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
      req.log.error({ err: upErr }, "Google TTS upstream failed");
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