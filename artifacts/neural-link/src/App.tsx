import { useEffect, useRef, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertCircle, ArrowDown, AudioLines, Check, CircleHelp, Cpu, Loader2, Mic, MicOff, Network, Send, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

type Role = 'user' | 'assistant';
type Message = { role: Role; content: string; grounded?: boolean; id: string };

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: { [index: number]: { [index: number]: { transcript: string } } };
  }
}

const queryClient = new QueryClient();
const initialMessages: Message[] = [{
  id: 'welcome',
  role: 'assistant',
  content: 'Hello. I am Asiful’s supplied-profile assistant. Ask about his technical interests, creative work, certifications, or CSE studies.',
  grounded: true,
}];

const knowledge = [
  { n: '01', label: 'TECH / SYSTEMS', title: 'Networks with a human pulse.', text: 'Network administration, ISP operations, MikroTik, Cisco networking, routing, switching, Linux, and infrastructure troubleshooting.' },
  { n: '02', label: 'SECURITY / INTEREST', title: 'Curiosity with guardrails.', text: 'Cybersecurity and security tooling are part of Asiful’s technical interests. The assistant will not infer experience beyond the supplied profile.' },
  { n: '03', label: 'CREATIVE / VISUAL', title: 'Technical eyes, visual hands.', text: 'Graphic design, photo editing, photography, video editing, and motion-oriented creative work.' },
  { n: '04', label: 'STUDY / CREDENTIALS', title: 'Always still learning.', text: 'Computer Science and Engineering studies, with CCNA and Adobe Visual Design listed among the supplied credentials.' },
];
const prompts = ['What does Asiful work on?', 'Tell me about his certifications', 'What are his creative interests?'];

function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0; let width = 0; let height = 0;
    const points: { x: number; y: number; vx: number; vy: number }[] = [];
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      points.length = 0;
      for (let i = 0; i < Math.min(110, width / 11); i += 1) points.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18 });
    };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.fillStyle = 'rgba(112,156,255,.55)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]; const b = points[j]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) { ctx.strokeStyle = `rgba(89,239,255,${(1 - d / 110) * .11})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      raf = requestAnimationFrame(draw);
    };
    resize(); draw(); window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 -z-20 h-full w-full opacity-70" />;
}

function Core({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_center,rgba(89,239,255,.10),transparent_48%)] ${compact ? 'h-16 w-16' : 'h-[370px] w-full'}`} data-testid="visual-neural-core">
      {!compact && <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent" />}
      {[['w-[190px] h-[92px] border-cyan-300/25', '10s'], ['w-[275px] h-[155px] border-violet-300/25', '15s'], ['w-[350px] h-[250px] border-dashed border-emerald-300/20', '21s']].map(([classes, duration], index) => <span key={classes} className={`absolute left-1/2 top-1/2 rounded-[50%] border -translate-x-1/2 -translate-y-1/2 ${compact ? 'scale-[.27]' : ''} ${classes}`} style={{ animation: `spin-core ${duration} linear infinite ${index === 1 ? 'reverse' : ''}` }} />)}
      <span className="absolute left-1/2 top-1/2 h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fff_2%,#72f5ff_11%,#527cff_38%,transparent_71%)] shadow-[0_0_35px_rgba(89,239,255,.75),0_0_130px_rgba(89,239,255,.15)]" style={{ animation: 'pulse-core 2.4s ease-in-out infinite' }} />
      {!compact && <span className="absolute left-1/2 top-[calc(50%+62px)] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[.18em] text-slate-400">NEURAL CORE / ACTIVE</span>}
      {!compact && [['left-[14%] top-[24%]', 'bg-cyan-300'], ['right-[16%] top-[29%]', 'bg-violet-300'], ['left-[23%] bottom-[17%]', 'bg-emerald-300'], ['right-[23%] bottom-[21%]', 'bg-cyan-300']].map(([pos, color], i) => <i key={i} className={`absolute h-1 w-1 rounded-full shadow-[0_0_13px_currentColor] ${pos} ${color}`} style={{ animation: `drift 4s ease-in-out infinite ${-i}s` }} />)}
    </div>
  );
}

function AppShell() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [heroDraft, setHeroDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isSending]);

  const playAnswer = async (message: Message) => {
    setSpeakingId(message.id);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.content }),
      });
      if (!response.ok) throw new Error('Audio unavailable');
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audio.onended = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(audio.src);
      };
      await audio.play();
    } catch {
      // Fallback to the browser's built-in speech synthesis if TTS fails.
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.rate = 0.92;
        utterance.pitch = 0.82;
        utterance.onend = () => setSpeakingId(null);
        utterance.onerror = () => setSpeakingId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeakingId(null);
        setError('Voice playback is unavailable right now.');
      }
    }
  };

  const sendMessage = async (value: string) => {
    const content = value.trim();
    if (!content || isSending) return;
    setError(''); setDraft('');
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content };
    const next = [...messages, userMessage];
    setMessages(next); setIsSending(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content: text }) => ({ role, content: text })) }) });
      if (!response.ok) throw new Error('The neural link is temporarily unavailable.');
      const data = await response.json() as { answer?: string; grounded?: boolean };
      if (!data.answer) throw new Error('No answer returned.');
      const assistant: Message = { id: crypto.randomUUID(), role: 'assistant', content: data.answer, grounded: Boolean(data.grounded) };
      setMessages((current) => [...current, assistant]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection error. Try again.'); }
    finally { setIsSending(false); }
  };

  const startListening = (target: 'hero' | 'chat') => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setError('Microphone transcription is not supported in this browser. Try Chrome or Edge, or type your question.'); return; }
    const recognition = new Recognition(); recognitionRef.current = recognition;
    recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1; setIsListening(true);
    recognition.onresult = (event) => { const text = event.results[0][0].transcript; if (target === 'hero') setHeroDraft(text); else setDraft(text); };
    recognition.onerror = () => setError('Microphone transcription could not start. You can still type your question.');
    recognition.onend = () => setIsListening(false); recognition.start();
  };
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };
  const handleChatSubmit = (event: FormEvent) => { event.preventDefault(); void sendMessage(draft); };
  const handleHeroSubmit = (event: FormEvent) => { event.preventDefault(); setDraft(heroDraft); document.getElementById('conversation')?.scrollIntoView({ behavior: 'smooth' }); void sendMessage(heroDraft); setHeroDraft(''); };

  return (
    <div className="noise min-h-[100dvh] overflow-hidden bg-[#03050a] text-slate-100">
      <NeuralCanvas />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(33,77,255,.12),transparent_30rem),radial-gradient(circle_at_12%_75%,rgba(89,239,255,.06),transparent_24rem)]" />
      <header className="fixed left-0 right-0 top-0 z-10 border-b border-white/[.06] bg-[#03050acc] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1380px] items-center justify-between px-5 sm:px-[5vw]">
          <a href="#top" className="font-mono text-[11px] font-medium tracking-[.16em] text-slate-200" data-testid="link-brand">ASIFUL <span className="text-cyan-300">/ NEURAL LINK</span></a>
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[.12em] text-slate-500" data-testid="status-online"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#64ffc1]" /> AI CORE ONLINE <span className="hidden text-slate-600 sm:inline">· VOICE READY</span></div>
        </div>
      </header>
      <main id="top" className="mx-auto max-w-[1380px] px-5 pb-14 pt-[112px] sm:px-[5vw]">
        <section className="grid min-h-[calc(100dvh-150px)] items-center gap-10 py-10 lg:grid-cols-[1fr_510px] lg:gap-[6vw]" data-testid="section-hero">
          <div className="page-enter">
            <div className="font-mono text-[10px] tracking-[.2em] text-cyan-300">PERSONAL INTELLIGENCE INTERFACE · V1.0</div>
            <h1 className="mt-5 mb-7 font-serif text-[clamp(4rem,9vw,8.5rem)] font-semibold leading-[.8] tracking-[-.09em] text-slate-100">Meet<br /><span className="text-transparent [-webkit-text-stroke:1px_rgba(223,233,255,.62)]">Asiful.</span></h1>
            <p className="max-w-[670px] text-[1.02rem] leading-[1.9] text-slate-400 sm:text-[1.1rem]">Not a conventional portfolio. A quiet interface for exploring Asiful’s technical interests, professional work, and visual practice through conversation.</p>
            <p className="mt-4 flex items-center gap-2 text-xs leading-6 text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Personal answers are limited to information Asiful has supplied.</p>
            <div className="mt-6 flex flex-wrap gap-2">{['NETWORK ENGINEERING', 'CYBERSECURITY', 'IT SYSTEMS', 'VISUAL WORK'].map((tag) => <span key={tag} className="rounded-full border border-indigo-300/15 bg-indigo-300/[.03] px-3 py-2 font-mono text-[9px] tracking-[.08em] text-slate-400" data-testid={`tag-${tag.toLowerCase().replaceAll(' ', '-')}`}>{tag}</span>)}</div>
          </div>
          <div className="rounded-[25px] border border-indigo-300/15 bg-[#070c15c9] p-4 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-md page-enter [animation-delay:120ms]">
            <div className="flex justify-between px-1 pb-3 font-mono text-[9px] tracking-[.08em] text-slate-500"><span>NEURAL CORE / LIVE</span><span className="text-emerald-300">● CONNECTED</span></div>
            <Core />
            <form onSubmit={handleHeroSubmit} className="mt-2 flex gap-2">
              <input value={heroDraft} onChange={(e) => setHeroDraft(e.target.value)} placeholder="Ask the neural link…" aria-label="Ask the neural link" className="min-w-0 flex-1 rounded-lg border border-indigo-300/15 bg-[#050912] px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20" data-testid="input-hero-question" />
              <button type="button" onClick={() => isListening ? stopListening() : startListening('hero')} className={`rounded-lg border px-3 text-cyan-300 transition hover:bg-cyan-300/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${isListening ? 'border-rose-300/60 text-rose-300' : 'border-cyan-300/20'}`} aria-label={isListening ? 'Stop microphone' : 'Use microphone'} data-testid="button-hero-microphone">{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
              <button type="submit" className="rounded-lg border border-cyan-300/25 bg-cyan-300/[.07] px-3 font-mono text-[10px] text-cyan-300 transition hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/50" data-testid="button-hero-send">ASK</button>
            </form>
          </div>
        </section>

        <section id="knowledge" className="border-t border-white/[.06] py-24" data-testid="section-knowledge">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><h2 className="font-serif text-[clamp(2.8rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.07em]">What it<br /><span className="text-slate-500">knows.</span></h2><p className="max-w-[510px] text-sm leading-7 text-slate-500">The personal layer is deliberately restricted. When something has not been supplied, the assistant says so. No assumptions. No invented biography.</p></div>
          <div className="grid gap-3 md:grid-cols-2">{knowledge.map((item, index) => <article key={item.n} className={`group rounded-2xl border border-white/[.07] bg-[#080d17aa] p-6 transition duration-500 hover:-translate-y-1 hover:border-cyan-300/30 ${index === 0 ? 'md:row-span-2 md:flex md:flex-col md:justify-end md:p-8' : ''}`} data-testid={`card-knowledge-${item.n}`}><div className="mb-10 flex items-center justify-between font-mono text-[9px] tracking-[.16em] text-cyan-300"><span>{item.n} / {item.label}</span><ArrowDown className="h-3 w-3 -rotate-45 opacity-0 transition group-hover:opacity-100" /></div><h3 className="font-serif text-2xl tracking-[-.04em] text-slate-100">{item.title}</h3><p className="mt-3 max-w-[520px] text-sm leading-7 text-slate-500">{item.text}</p></article>)}</div>
        </section>

        <section id="conversation" className="border-t border-white/[.06] py-24" data-testid="section-conversation">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><h2 className="font-serif text-[clamp(2.8rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.07em]">Talk<br /><span className="text-slate-500">to it.</span></h2><p className="max-w-[510px] text-sm leading-7 text-slate-500">A supplied-profile assistant for visitors. Ask directly, explore the signal, and listen when the answer arrives.</p></div>
          <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
            <aside className="rounded-2xl border border-white/[.07] bg-[#080d17aa] p-7">
              <div className="mb-5 flex items-center gap-3"><div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.05] p-2.5 text-cyan-300"><Cpu className="h-5 w-5" /></div><div><div className="font-mono text-[9px] tracking-[.15em] text-cyan-300">INTERFACE / CALM MODE</div><h3 className="mt-1 font-serif text-2xl tracking-[-.05em]">JARVIS-inspired.</h3></div></div>
              <p className="text-sm leading-7 text-slate-500">A calm, cinematic assistant interface for exploring supplied information. It does not imitate any actor’s voice or claim knowledge outside the profile.</p>
              <div className="my-7 h-px bg-white/[.07]" />
              <ul className="space-y-3 text-sm text-slate-400">{['Ask about Asiful', 'Ask technical questions', 'Ask creative questions', 'Use voice input', 'Listen to an answer'].map((item) => <li key={item} className="flex items-center gap-3"><Check className="h-3.5 w-3.5 text-emerald-300" />{item}</li>)}</ul>
              <div className="mt-8 rounded-xl border border-violet-300/10 bg-violet-300/[.03] p-4"><div className="flex items-center gap-2 font-mono text-[9px] tracking-[.12em] text-violet-300"><CircleHelp className="h-3.5 w-3.5" /> TRY A PROMPT</div><p className="mt-2 text-xs leading-5 text-slate-500">Questions about unprovided personal details will receive a clear limitation.</p></div>
            </aside>
            <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/[.07] bg-[#080d17aa]">
              <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-4 font-mono text-[9px] tracking-[.12em] text-slate-500"><span>NEURAL LINK / CONVERSATION</span><span className="flex items-center gap-2 text-emerald-300" data-testid="status-chat"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {isSending ? 'THINKING' : 'LISTENING'}</span></div>
              <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite" data-testid="list-messages">
                {messages.map((message) => <div key={message.id} className={`group max-w-[88%] rounded-xl border px-3.5 py-3 text-sm leading-7 ${message.role === 'assistant' ? 'border-cyan-300/10 bg-[#091321] text-slate-300' : 'ml-auto border-violet-300/15 bg-[#11172a] text-slate-300'}`} data-testid={`message-${message.role}-${message.id}`}><div className={`mb-1 flex items-center gap-2 font-mono text-[9px] tracking-[.1em] ${message.role === 'assistant' ? 'text-cyan-300' : 'justify-end text-violet-300'}`}><span>{message.role === 'assistant' ? 'NEURAL LINK' : 'VISITOR'}</span>{message.grounded && <span className="flex items-center gap-1 text-emerald-300" title="Grounded in supplied profile"><ShieldCheck className="h-3 w-3" /> GROUNDED</span>}</div><p className="whitespace-pre-wrap">{message.content}</p>{message.role === 'assistant' && <button type="button" onClick={() => void playAnswer(message)} className="mt-3 flex items-center gap-1.5 font-mono text-[9px] tracking-[.08em] text-slate-500 transition hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/50" data-testid={`button-play-${message.id}`}>{speakingId === message.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}{speakingId === message.id ? 'PLAYING' : 'PLAY ANSWER'}</button>}</div>)}
                {isSending && <div className="flex items-center gap-2 px-2 py-2 font-mono text-[9px] tracking-[.1em] text-slate-500" data-testid="loading-chat"><Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> NEURAL CORE PROCESSING</div>}
                {error && <div className="flex items-start gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[.04] p-3 text-xs leading-5 text-rose-200" role="alert" data-testid="error-chat"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span><button type="button" onClick={() => setError('')} className="ml-auto text-rose-200/60 hover:text-rose-100" aria-label="Dismiss error" data-testid="button-dismiss-error"><X className="h-4 w-4" /></button></div>}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-white/[.07] px-4 pt-3 sm:px-5">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => void sendMessage(prompt)} disabled={isSending} className="rounded-full border border-indigo-300/15 px-2.5 py-1.5 text-[10px] text-slate-500 transition hover:border-cyan-300/30 hover:text-cyan-300 disabled:opacity-40" data-testid={`button-prompt-${prompt.slice(0, 8).replaceAll(' ', '-').toLowerCase()}`}>{prompt}</button>)}</div>
              <form onSubmit={handleChatSubmit} className="flex gap-2 border-t border-white/[.07] p-4 sm:p-5">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your question…" aria-label="Conversation question" className="min-w-0 flex-1 rounded-lg border border-indigo-300/15 bg-[#050912] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20" data-testid="input-chat-question" />
                <button type="button" onClick={() => isListening ? stopListening() : startListening('chat')} className={`rounded-lg border px-3 text-cyan-300 transition hover:bg-cyan-300/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${isListening ? 'border-rose-300/60 text-rose-300' : 'border-cyan-300/20'}`} aria-label={isListening ? 'Stop microphone' : 'Use microphone'} data-testid="button-chat-microphone">{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                <button type="submit" disabled={isSending || !draft.trim()} className="flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[.07] px-3 font-mono text-[10px] text-cyan-300 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-300/50" data-testid="button-chat-send"><Send className="h-3.5 w-3.5" /> <span className="hidden sm:inline">SEND</span></button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/[.06] px-5 py-12 text-center font-mono text-[9px] tracking-[.14em] text-slate-600"><div className="mb-4 flex justify-center gap-5 text-slate-500"><a href="#conversation" className="transition hover:text-cyan-300" data-testid="link-footer-conversation"><AudioLines className="h-4 w-4" /></a><a href="#knowledge" className="transition hover:text-cyan-300" data-testid="link-footer-knowledge"><Network className="h-4 w-4" /></a><a href="#top" className="transition hover:text-cyan-300" data-testid="link-footer-top"><Sparkles className="h-4 w-4" /></a></div>ASIFUL ISLAM · NEURAL LINK · PERSONAL FACTS ARE LIMITED TO SUPPLIED INFORMATION</footer>
    </div>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><AppShell /></ErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;