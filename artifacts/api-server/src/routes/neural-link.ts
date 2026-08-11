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

// Local fallback used ONLY when OpenRouter is unavailable (e.g. account
// guardrail / network). This is not a gate — OpenRouter is always tried first
// for every message; this just prevents a hard 502 when the AI backend is down.
function localProfileAnswer(question: string): string | null {
  const q = question.toLowerCase();
  if (!/\b(asiful|his|him|about (you|yourself)|your background|your experience|your skills|your work|your education|your certificate|your career|personal)\b/i.test(q)) {
    return null;
  }
  if (/\bname\b/.test(q)) return "His name is Asiful Islam.";
  if (/\b(certificates?|credentials?|ccna|adobe)\b/.test(q)) return "The supplied profile lists CCNA and Adobe Visual Design.";
  if (/\b(education|study|degree|student|cse)\b/.test(q)) return "Asiful is a Computer Science and Engineering (CSE) student.";
  if (/\b(creative|design|video|photo|visual)\b/.test(q)) return "His supplied creative work includes graphic design, photo editing, photography, video editing, and motion-oriented creative work.";
  if (/\b(cyber|security|linux)\b/.test(q)) return "Cybersecurity, Linux, and security tooling are part of Asiful’s supplied technical interests.";
  if (/\b(role|job|work|experience|career|professional)\b/.test(q)) return "The supplied profile describes network administration and ISP operations, including MikroTik-based customer-network work, alongside graphic design and video editing.";
  if (/\b(skill|technical|network|mikrotik|cisco|routing|switching)\b/.test(q)) return "The supplied technical areas include network administration, ISP operations, MikroTik, Cisco networking, routing, switching, Linux, cybersecurity interest, and infrastructure troubleshooting.";
  return "Asiful is a Network Administrator / Network Engineer and IT professional with creative work in graphic design, photo editing, photography, and video editing; he is a CSE student with CCNA and Adobe Visual Design certificates.";
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide at least one valid message." });
    return;
  }

  try {
    const latestQuestion = parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "";
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
      const fb = localProfileAnswer(latestQuestion);
      if (fb) {
        res.json(SendChatMessageResponse.parse({ answer: fb, grounded: true }));
        return;
      }
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
    const latestQuestion = parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "";
    const fb = localProfileAnswer(latestQuestion);
    if (fb) {
      res.json(SendChatMessageResponse.parse({ answer: fb, grounded: true }));
      return;
    }
    res.status(502).json({ error: "The neural core is temporarily unavailable." });
  }
});

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

    const upstream = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:5000",
        "X-Title": "Neural Link Portfolio",
      },
      body: JSON.stringify({
        model: ttsModel,
        input: text,
        voice: process.env.OPENROUTER_TTS_VOICE || "alloy",
        response_format: "mp3",
      }),
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