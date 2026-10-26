import { useEffect, useState } from "react";
import { Check, History, Loader2, MessageSquare, Send, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { useVoice } from "@/lib/use-voice";

type Voice = ReturnType<typeof useVoice>;
type Activity = Tables<"assistant_activity">;

const STATUS: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "Réussie", cls: "text-neon-green" },
  completed: { label: "Terminée", cls: "text-neon-green" },
  failed: { label: "Échec", cls: "text-neon-red" },
  cancelled: { label: "Annulée", cls: "text-muted-foreground" },
  pending: { label: "En attente de confirmation", cls: "text-neon-orange" },
  running: { label: "En cours", cls: "text-neon-blue" },
  started: { label: "Démarrée", cls: "text-neon-blue" },
};

export function CopilotPanel({ voice }: { voice: Voice }) {
  const [text, setText] = useState("");
  const busy = voice.state !== "idle";
  return (
    <section className="glass p-4 fade-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-neon-blue" />Copilote Ultra</h2>
        {voice.messages.length > 0 && (
          <button onClick={voice.reset} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" />Nouvelle conversation</button>
        )}
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {!voice.messages.length && (
          <p className="text-sm text-muted-foreground">Parlez ou écrivez naturellement : « Déplace la tâche courses à jeudi prochain », « Qu'est-ce que j'ai demain ? », « Marque la réunion comme terminée »…</p>
        )}
        {voice.messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary/20 ml-8" : "bg-secondary/60 mr-8"}`}>
            {m.content || <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        ))}
      </div>
      {voice.proposals.length > 0 && (
        <div className="space-y-2">
          {voice.proposals.map((p) => (
            <div key={p.id} className="rounded-lg border px-3 py-2 text-sm flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-40">{p.summary}</span>
              {p.state === "pending" ? (
                <>
                  <button onClick={() => voice.decide(p.id, true)} className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground flex items-center gap-1"><Check className="h-3 w-3" />Confirmer</button>
                  <button onClick={() => voice.decide(p.id, false)} className="rounded-lg border px-3 py-1 text-xs flex items-center gap-1"><X className="h-3 w-3" />Annuler</button>
                </>
              ) : p.state === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className={`text-xs ${STATUS[p.state]?.cls ?? "text-neon-orange"}`}>{STATUS[p.state]?.label ?? "Non vérifié"}{p.message ? ` — ${p.message}` : ""}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) { voice.handleText(text.trim()); setText(""); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Posez une question ou demandez une action…"
          className="flex-1 rounded-lg bg-input/60 border px-3 py-2 text-sm outline-none focus:border-primary" />
        <button disabled={busy} className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-60" aria-label="Envoyer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}

export function JournalView() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const load = () => supabase.from("assistant_activity").select("*").order("created_at", { ascending: false }).limit(300).then(({ data }) => setRows(data ?? []));
    load();
    const ch = supabase.channel(`journal-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "assistant_activity" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return (
    <section className="glass p-4 fade-up">
      <h2 className="flex items-center gap-2 font-semibold mb-3"><History className="h-4 w-4 text-neon-purple" />Journal des actions de l'assistant</h2>
      {!rows.length && <p className="text-sm text-muted-foreground">Aucune action enregistrée pour le moment.</p>}
      <div className="divide-y divide-border/40">
        {rows.map((r) => {
          const st = STATUS[r.status] ?? { label: r.status, cls: "" };
          return (
            <div key={r.id} className="py-2 text-sm">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full flex flex-wrap items-center gap-3 text-left">
                <span className="text-xs text-muted-foreground w-40 shrink-0">{new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}</span>
                <span className="tag tag-admin">{r.kind}</span>
                <span className="flex-1 min-w-40">{r.summary}</span>
                <span className={`text-xs font-medium ${st.cls}`}>{st.label}</span>
              </button>
              {open === r.id && (
                <pre className="mt-2 rounded-lg bg-secondary/60 p-3 text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.details, null, 2)}</pre>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
