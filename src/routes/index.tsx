import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ultra — Gestion de tâches et notes intelligente" },
      { name: "description", content: "Planifiez vos tâches et notes à la voix grâce à l'IA. Créez votre compte Ultra." },
      { property: "og:title", content: "Ultra — Tâches & notes intelligentes" },
      { property: "og:description", content: "Dites « Note » ou « Tâche » et Ultra s'occupe du reste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fn =
      mode === "signup"
        ? supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await fn;
    setLoading(false);
    if (error) return setError(error.message);
    if (data.session) navigate({ to: "/dashboard" });
    else setError("Compte créé. Connectez-vous.");
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md glass glow-purple p-8 fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-chip chip-purple h-11 w-11"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">Ultra</h1>
            <p className="text-sm text-muted-foreground">Tâches & notes ultra intelligentes</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-secondary mb-6">
          {(["signup", "login"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "signup" ? "Créer un compte" : "Se connecter"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input/60 border px-4 py-3 outline-none focus:border-primary" />
          <input type="password" required minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input/60 border px-4 py-3 outline-none focus:border-primary" />
          {error && <p className="text-sm text-neon-orange">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground shadow-[0_0_24px_-4px_var(--neon-purple)] disabled:opacity-60">
            {loading ? "…" : mode === "signup" ? "Créer mon compte" : "Accéder au dashboard"}
          </button>
        </form>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Mic className="h-4 w-4 text-neon-pink" /> Dites « Note … » ou « Tâche … » pour tout créer à la voix.
        </p>
      </div>
    </main>
  );
}
