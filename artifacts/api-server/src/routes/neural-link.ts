import { Router, type IRouter } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are Neural Link, a calm, helpful, and precise AI assistant.

You may freely answer any question using your general knowledge — technical, creative, or casual — just like a normal conversational AI. Be concise and conversational (usually under 150 words).

Optional context: you are the assistant for Asiful Islam's personal portfolio. Asiful is a Network Administrator / Network Engineer and IT professional with creative work in graphic design, photo editing, photography, and video editing; his technical areas include MikroTik, Cisco, routing/switching, Linux, and cybersecurity interest; he is a Computer Science and Engineering (CSE) student with CCNA and Adobe Visual Design certificates. You may mention these details naturally when relevant, but you are not restricted to them and should answer any topic the user raises.

Never claim to be a human or imitate any actor's voice. You are an AI interface.`;

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  return key;
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide at least one valid message." });
    return;
  }

  try {
    const openRouterModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
    const apiKey = getApiKey();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:5000",
        "X-Title": "Neural Link Portfolio",
      },
      body: JSON.stringify({
        model: openRouterModel,
        max_tokens: 320,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
      }),
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "OpenRouter chat request failed");
      res.status(502).json({ error: "The neural core is temporarily unavailable." });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      res.status(502).json({ error: "The neural core returned an empty response." });
      return;
    }

    res.json(SendChatMessageResponse.parse({
      answer,
      grounded: false,
    }));
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
    const apiKey = getApiKey();
    const ttsModel =
      process.env.OPENROUTER_TTS_MODEL || "fish-audio/s2.1-pro-free:free";
    // Fish Audio selects voices by `reference_id` (a voice UUID), not by a name.
    // Default to a MALE voice (Jarvis): https://fish.audio/m/14129c3e320149449d6bada6862f7338/
    // Override with any male Fish voice UUID via OPENROUTER_TTS_VOICE.
    const voiceRef =
      process.env.OPENROUTER_TTS_VOICE || "14129c3e320149449d6bada6862f7338";

    // Fish Audio expresses emotion by embedding bracket tags in the text
    // (e.g. [happy], [excited], [sad], [calm]) — there is no separate "tags"
    // parameter. Pick a tone from the message so the voice sounds emotional
    // and realistic instead of flat.
    const tone = pickEmotion(text);
    const spoken = tone ? `[${tone}] ${text}` : text;

    const body: Record<string, unknown> = {
      model: ttsModel,
      input: spoken,
      response_format: "mp3",
    };
    if (/^[a-f0-9]{32}$/i.test(voiceRef)) {
      body.reference_id = voiceRef;
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:5000",
        "X-Title": "Neural Link Portfolio",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok || !upstream.body) {
      req.log.error({ status: upstream.status }, "OpenRouter TTS request failed");
      res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    // Pipe the upstream audio bytes straight to the client.
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
  } catch (error) {
    req.log.error({ err: error }, "Neural Link TTS failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Voice synthesis is temporarily unavailable." });
    }
  }
});

export default router;