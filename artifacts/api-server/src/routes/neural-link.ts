import { Router, type IRouter } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
  SynthesizeSpeechBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PROFILE = `
Supplied profile for Asiful Islam:
- Roles: Network Administrator, Network Engineer, IT professional, Graphic Designer, Video Editor, Photographer, Photo Editor.
- Technical areas: MikroTik, Cisco networking, network administration, ISP operations, routing, switching, Linux, cybersecurity interest, and infrastructure troubleshooting.
- Creative areas: graphic design, photo editing, photography, video editing, and motion-oriented creative work.
- Professional experience supplied: network administration / ISP operations and MikroTik-based customer-network work.
- Certificates supplied: CCNA and Adobe Visual Design.
- Education supplied: Computer Science and Engineering (CSE) student.
`;

const SYSTEM_PROMPT = `You are Neural Link, the calm portfolio assistant for Asiful Islam.
You are helpful, concise, and precise. The user is exploring a personal portfolio.

${PROFILE}

Strict personal-information rule:
1. For any question about Asiful, his identity, background, work, experience, skills, education, certificates, or personal life, use only the supplied profile above.
2. Never infer, embellish, or invent personal facts, employers, dates, locations, projects, achievements, contact details, or credentials.
3. If the supplied profile does not answer a personal question, say clearly that the information was not supplied.
4. You may answer general non-personal technical or creative questions using your general knowledge, but do not turn general knowledge into a claim about Asiful.
5. Never claim to be a human or to imitate any actor's voice. You are a portfolio interface.
Keep responses conversational and usually under 120 words.`;

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

function isProfileQuestion(messages: Array<{ role: "user" | "assistant"; content: string }>): boolean {
  const latest = messages[messages.length - 1]?.content ?? "";
  return /\b(asiful|his|him|about (you|yourself)|your background|your experience|your skills|your work|your education|your certificate|your career|personal)\b/i.test(latest);
}

function profileAnswer(question: string): string | null {
  const q = question.toLowerCase();
  if (!isProfileQuestion([{ role: "user", content: question }])) return null;
  if (/\bname\b/.test(q)) return "His name is Asiful Islam.";
  if (/\b(certificates?|credentials?|ccna|adobe)\b/.test(q)) return "The supplied profile lists CCNA and Adobe Visual Design.";
  if (/\b(education|study|degree|student|cse)\b/.test(q)) return "Asiful is a Computer Science and Engineering (CSE) student.";
  if (/\b(creative|design|video|photo|visual)\b/.test(q)) return "His supplied creative work includes graphic design, photo editing, photography, video editing, and motion-oriented creative work.";
  if (/\b(cyber|security|linux)\b/.test(q)) return "Cybersecurity, Linux, and security tooling are part of Asiful’s supplied technical interests.";
  if (/\b(role|job|work|experience|career|professional)\b/.test(q)) return "The supplied profile describes network administration and ISP operations, including MikroTik-based customer-network work, alongside graphic design and video editing.";
  if (/\b(skill|technical|network|mikrotik|cisco|routing|switching)\b/.test(q)) return "The supplied technical areas include network administration, ISP operations, MikroTik, Cisco networking, routing, switching, Linux, cybersecurity interest, and infrastructure troubleshooting.";
  return "I can answer personal questions only from information Asiful supplied. I don’t have enough supplied information to answer that specific question.";
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide at least one valid message." });
    return;
  }

  try {
    const latestQuestion = parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "";
    const localAnswer = profileAnswer(latestQuestion);
    if (localAnswer) {
      res.json(SendChatMessageResponse.parse({ answer: localAnswer, grounded: true }));
      return;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 320,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
      }),
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "OpenAI chat request failed");
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
      grounded: isProfileQuestion(parsed.data.messages),
    }));
  } catch (error) {
    req.log.error({ err: error }, "Neural Link chat failed");
    res.status(502).json({ error: "The neural core is temporarily unavailable." });
  }
});

router.post("/tts", async (req, res) => {
  const parsed = SynthesizeSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide text to speak." });
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx",
        input: parsed.data.text,
        response_format: "mp3",
        speed: 0.92,
      }),
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "OpenAI speech request failed");
      res.status(502).json({ error: "Voice output is temporarily unavailable." });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    req.log.error({ err: error }, "Neural Link speech failed");
    res.status(502).json({ error: "Voice output is temporarily unavailable." });
  }
});

export default router;