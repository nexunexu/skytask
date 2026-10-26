import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processVoice } from "@/lib/voice.functions";
import { confirmCopilotOperation } from "@/lib/copilot.functions";

export type VoiceState = "idle" | "recording" | "transcribing" | "analyzing";
export type ChatMsg = { role: "user" | "assistant"; content: string };
export type Proposal = { id: string; summary: string; entity: string; action: string; state: "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown"; message?: string };

export function useVoice(language: string) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(40).fill(0.2));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const conversationId = useRef(crypto.randomUUID());
  const recRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useServerFn(processVoice);
  const confirmOp = useServerFn(confirmCopilotOperation);

  async function askCopilot(text: string) {
    const history = messages.slice(-20);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    let reply = "";
    const setReply = (t: string) => setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: t }]);
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ text, conversationId: conversationId.current, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, history }),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `Le copilote n'a pas pu répondre (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.type === "text") { reply += ev.text; setReply(reply); }
        else if (ev.type === "proposal") {
          const op = ev.operation;
          setProposals((p) => p.some((x) => x.id === op.id) ? p : [...p, { id: op.id, summary: op.summary, entity: op.entity, action: op.action, state: "pending" }]);
        } else if (ev.type === "error") throw new Error(ev.error);
      }
    }
    if (!reply) setReply("(aucune réponse)");
  }

  async function decide(id: string, confirm: boolean) {
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, state: "running" } : x)));
    try {
      const r = await confirmOp({ data: { id, confirm } });
      const st = (["succeeded", "failed", "cancelled"].includes(r.status) ? r.status : "unknown") as Proposal["state"];
      setProposals((p) => p.map((x) => (x.id === id ? { ...x, state: st, message: r.message } : x)));
      const summary = proposals.find((x) => x.id === id)?.summary ?? "Action";
      const line = st === "succeeded" ? `✅ ${summary} — ${r.message}` : st === "cancelled" ? `↩️ ${summary} — ${r.message}` : `❌ ${summary} — ${r.message}`;
      setMessages((m) => [...m, { role: "assistant", content: line }]);
      if (st === "succeeded") toast.success(r.message);
      else if (st === "cancelled") toast(r.message);
      else toast.error(r.message);
      window.dispatchEvent(new Event("ultra:reload"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setProposals((p) => p.map((x) => (x.id === id ? { ...x, state: "unknown", message: `Résultat non vérifié : ${msg}` } : x)));
      toast.error(`Résultat non vérifié : ${msg}. Consultez le journal.`);
    }
  }

  async function handleText(text: string, forceMode?: "note" | "task") {
    setTranscript(text);
    setState("analyzing");
    try {
      if (forceMode) {
        const r = await run({
          data: { text, now: new Date().toString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, forceMode },
        });
        if (r.mode === "note")
          toast.success(`Note enregistrée${r.tasks.length ? ` · ${r.tasks.length} tâche(s) détectée(s)` : ""}`);
        else toast.success(`${r.tasks.length} tâche(s) créée(s) : ${r.tasks.join(", ")}`);
        window.dispatchEvent(new Event("ultra:reload"));
      } else {
        await askCopilot(text);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      if (!forceMode) setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `❌ ${msg}` }]);
      toast.error(msg);
    } finally {
      setState("idle");
    }
  }

  async function start() {
    if (state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setLevels(Array.from({ length: 40 }, (_, i) => Math.max(0.12, (buf[i % buf.length] ?? 0) / 255)));
        raf = requestAnimationFrame(tick);
      };
      tick();
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        cancelAnimationFrame(raf);
        ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        setLevels(Array(40).fill(0.2));
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 1000) return setState("idle");
        setState("transcribing");
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const fd = new FormData();
        fd.append("file", new File([blob], `voice.${ext}`, { type: type.split(";")[0] ?? type }));
        fd.append("language", language);
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.text) {
          toast.error(json.error ?? "Aucune parole détectée.");
          return setState("idle");
        }
        handleText(json.text);
      };
      rec.start();
      recRef.current = rec;
      setTranscript("");
      setState("recording");
      stopTimer.current = setTimeout(() => stop(), 90_000);
    } catch {
      toast.error("Micro inaccessible. Autorisez l'accès au micro.");
    }
  }

  function stop() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  const toggle = () => (state === "recording" ? stop() : start());
  const reset = () => { setMessages([]); setProposals([]); conversationId.current = crypto.randomUUID(); };
  return { state, transcript, levels, toggle, handleText, messages, proposals, decide, reset };
}
