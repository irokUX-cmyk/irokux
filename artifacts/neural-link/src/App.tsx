import { useEffect, useRef, useState, type FormEvent } from "react";
import { NeuralCore } from "@/components/NeuralCore";
import { Mic, MicOff, Send, Sparkles, Volume2 } from "lucide-react";

type Role = "user" | "assistant";
type Mode = "idle" | "listening" | "generating" | "speaking";
type Message = { role: Role; content: string; id: string };

const initialMessages: Message[] = [
  { id: "welcome", role: "assistant", content: "Neural Link online. I am Asiful's AI core — ask me anything." },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mode]);

  const setGenerating = (v: boolean) => setMode(v ? "generating" : "idle");

  const playAnswer = async (message: Message) => {
    setSpeakingId(message.id);
    setMode("speaking");
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content }),
      });
      if (!response.ok) throw new Error("audio unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // live amplitude -> core energy
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ac = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ac;
      const src = ac.createMediaElementSource(audio);
      const an = ac.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      an.connect(ac.destination);
      analyserRef.current = an;
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        let sum = 0; for (const b of buf) sum += b;
        energyRef.current = Math.min(1, sum / buf.length / 90);
        if (!audio.paused) requestAnimationFrame(tick);
      };
      tick();
      audio.onended = () => {
        energyRef.current = 0; setSpeakingId(null); setMode("idle");
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setSpeakingId(null); setMode("idle");
      // browser fallback
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(message.content);
        u.rate = 0.95; u.pitch = 0.8;
        u.onend = () => { setSpeakingId(null); setMode("idle"); };
        window.speechSynthesis.speak(u);
      }
    }
  };

  const sendMessage = async (value: string) => {
    const content = value.trim();
    if (!content || mode === "generating") return;
    setError(""); setDraft("");
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const next = [...messages, userMessage];
    setMessages(next);
    setGenerating(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content: text }) => ({ role, content: text })) }),
      });
      if (!response.ok) throw new Error("Neural core unavailable.");
      const data = (await response.json()) as { answer?: string };
      if (!data.answer) throw new Error("No answer returned.");
      const assistant: Message = { id: crypto.randomUUID(), role: "assistant", content: data.answer };
      setMessages((c) => [...c, assistant]);
      setGenerating(false);
      playAnswer(assistant);
    } catch (e) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : "Connection error. Try again.");
    }
  };

  const startListening = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setError("Mic not supported in this browser. Try Chrome/Edge."); return; }
    const rec = new Recognition();
    rec.lang = "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (ev: any) => {
      const t = ev.results[ev.results.length - 1][0].transcript;
      setDraft(t);
    };
    rec.onend = () => { setIsListening(false); setMode("idle"); };
    rec.onerror = () => { setIsListening(false); setMode("idle"); };
    recognitionRef.current = rec; rec.start();
    setIsListening(true); setMode("listening");
  };

  return (
    <div className="app">
      <NeuralCore mode={mode} energyRef={energyRef} />
      <div className="scanline" />
      <header className="topbar">
        <div className="brand"><Sparkles size={18} /> NEURAL LINK</div>
        <div className={"status status-" + mode}>
          <span className="dot" /> {mode.toUpperCase()}
        </div>
      </header>

      <main className="stage">
        <section className="chat" ref={scrollRef}>
          {messages.map((m) => (
            <div key={m.id} className={"msg " + m.role}>
              <div className="bubble">
                {m.content}
                {m.role === "assistant" && (
                  <button className="speak" onClick={() => playAnswer(m)} title="Speak">
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {mode === "generating" && <div className="msg assistant"><div className="bubble typing">synthesizing response…</div></div>}
          {error && <div className="err">{error}</div>}
        </section>
      </main>

      <footer className="composer">
        <button className={"mic " + (isListening ? "on" : "")} onClick={() => (isListening ? recognitionRef.current?.stop() : startListening())} title="Voice input">
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(draft); }}
          placeholder="Speak to the core…"
          disabled={mode === "generating"}
        />
        <button className="send" onClick={() => sendMessage(draft)} disabled={mode === "generating"}>
          <Send size={18} />
        </button>
      </footer>
    </div>
  );
}
