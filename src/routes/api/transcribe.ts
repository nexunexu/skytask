import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Unauthorized", { status: 401 });

        const form = await request.formData();
        const file = form.get("file");
        const language = String(form.get("language") || "fr");
        if (!(file instanceof File) || !file.size || file.size > 20_000_000)
          return Response.json({ error: "Fichier audio invalide" }, { status: 400 });

        const out = new FormData();
        out.append("model", "openai/gpt-transcribe");
        out.append("file", file, file.name || "audio.webm");
        out.append("response_format", "json");
        out.append("language", language);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}` },
          body: out,
        });
        if (!res.ok) {
          const msg = await res.text();
          const friendly =
            res.status === 402 ? "Crédits IA épuisés." : res.status === 429 ? "Trop de requêtes, réessayez." : "Transcription impossible.";
          console.error("transcribe", res.status, msg);
          return Response.json({ error: friendly }, { status: res.status });
        }
        const json = (await res.json()) as { text?: string };
        return Response.json({ text: json.text ?? "" });
      },
    },
  },
});
