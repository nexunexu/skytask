import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processVoice } from "@/lib/voice.functions";

export type VoiceState = "idle" | "recording" | "transcribing" | "analyzing";

export function useVoice(language: string) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(40).fill(0.2));
  const recRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useServerFn(processVoice);

  async function handleText(text: string, forceMode?: "note" | "task") {
    setTranscript(text);
    setState("analyzing");
    try {
      const r = await run({
        data: { text, now: new Date().toString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, forceMode },
      });
      if (r.mode === "note")
        toast.success(`Note enregistrée${r.tasks.length ? ` · ${r.tasks.length} tâche(s) détectée(s)` : ""}`);
      else toast.success(`${r.tasks.length} tâche(s) créée(s) : ${r.tasks.join(", ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
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
  return { state, transcript, levels, toggle, handleText };
}
