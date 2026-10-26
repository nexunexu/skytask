import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Extracted = { title: string; due_at: string | null; list_name: string | null; tag: string };

const PREFIX = /^\s*(note|notes|t[âa]ches?|task)\b[\s,.:;!-]*/i;

export function detectMode(text: string): { mode: "note" | "task" | null; content: string } {
  const m = text.match(PREFIX);
  if (!m) return { mode: null, content: text.trim() };
  const mode = (m[1] ?? "").toLowerCase().startsWith("note") ? "note" : "task";
  return { mode, content: text.slice(m[0].length).trim() };
}

async function extractTasks(content: string, mode: "note" | "task", now: string, tz: string, lists: string[]) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["tasks"],
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "due_at", "list_name", "tag"],
          properties: {
            title: { type: "string" },
            due_at: { type: ["string", "null"] },
            list_name: { type: ["string", "null"] },
            tag: { type: "string", enum: ["Travail", "Admin", "Santé", "Personnel"] },
          },
        },
      },
    },
  };
  const system = `Tu es l'assistant d'une app de gestion de tâches. Date/heure actuelle: ${now} (fuseau ${tz}).
${mode === "task" ? "Le texte dicté décrit une ou plusieurs tâches à créer." : "Le texte est une note. Extrais uniquement les tâches/actions concrètes qu'elle contient (aucune si ce n'est qu'une idée)."}
Pour chaque tâche: titre court et clair en français (garde un emoji pertinent à la fin), due_at en ISO 8601 avec décalage horaire si une date/heure est mentionnée sinon null, list_name seulement si l'utilisateur nomme explicitement une liste (listes existantes: ${lists.join(", ") || "aucune"}) sinon null, tag parmi Travail/Admin/Santé/Personnel.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "tasks", strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const msg = res.status === 402 ? "Crédits IA épuisés." : res.status === 429 ? "Trop de requêtes IA, réessayez." : "Analyse IA impossible.";
    console.error("ai", res.status, await res.text().catch(() => ""));
    throw new Error(msg);
  }
  const raw = await res.text();
  let out = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "response.output_text.delta") out += ev.delta;
    } catch {
      /* ignore */
    }
  }
  try {
    return (JSON.parse(out).tasks ?? []) as Extracted[];
  } catch {
    return [];
  }
}

export const processVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; now: string; tz: string; forceMode?: "note" | "task" | undefined }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const detected = detectMode(data.text);
    const mode = detected.mode ?? data.forceMode ?? "note";
    const content = detected.content;
    if (!content) throw new Error("Rien à enregistrer.");

    const { data: lists } = await supabase.from("task_lists").select("id,name,is_default");
    let all = lists ?? [];
    let def = all.find((l) => l.is_default);
    if (!def) {
      const { data: created } = await supabase
        .from("task_lists")
        .insert({ name: "Par défaut", is_default: true, user_id: userId })
        .select("id,name,is_default")
        .single();
      def = created!;
      all = [...all, def];
    }

    let noteId: string | null = null;
    if (mode === "note") {
      const { data: n } = await supabase.from("notes").insert({ content, user_id: userId }).select("id").single();
      noteId = n?.id ?? null;
    }

    const extracted = await extractTasks(content, mode, data.now, data.tz, all.map((l) => l.name));
    if (mode === "task" && extracted.length === 0)
      extracted.push({ title: content, due_at: null, list_name: null, tag: "Personnel" });

    const rows = [];
    for (const t of extracted) {
      let listId = def.id;
      if (t.list_name) {
        const found = all.find((l) => l.name.toLowerCase() === t.list_name!.toLowerCase());
        if (found) listId = found.id;
        else {
          const { data: nl } = await supabase
            .from("task_lists")
            .insert({ name: t.list_name, user_id: userId })
            .select("id,name,is_default")
            .single();
          if (nl) {
            all.push(nl);
            listId = nl.id;
          }
        }
      }
      const due = t.due_at && !isNaN(Date.parse(t.due_at)) ? new Date(t.due_at).toISOString() : null;
      rows.push({ title: t.title, due_at: due, tag: t.tag, list_id: listId, user_id: userId, source: mode === "note" ? "note" : "voice" });
    }
    if (rows.length) await supabase.from("tasks").insert(rows);
    if (noteId) await supabase.from("notes").update({ tasks_extracted: rows.length }).eq("id", noteId);

    return { mode, content, tasks: rows.map((r) => r.title) };
  });
