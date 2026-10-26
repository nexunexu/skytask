import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { answerCopilot, ownerClient } from "@/lib/copilot.server";

export const Route = createFileRoute("/api/copilot")({ server: { handlers: { POST: async ({ request }) => {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const sb = ownerClient(process.env['SUPABASE_URL'] ?? "", process.env['SUPABASE_PUBLISHABLE_KEY'] ?? "", token);
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const parsed = z.object({ text: z.string().trim().min(1).max(50000), conversationId: z.string().uuid(), tz: z.string().max(100), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(50000) })).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Demande invalide." }, { status: 400 });
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) return Response.json({ error: "Le service IA n'est pas configuré." }, { status: 401 });
  const encoder = new TextEncoder();
  const body = new ReadableStream({ async start(controller) {
    const emit = (value: object) => controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
    try {
      const { result } = await answerCopilot({ supabase: sb, userId: auth.user.id, conversationId: parsed.data.conversationId, key, messages: [...parsed.data.history, { role: "user", content: parsed.data.text }], signal: request.signal, now: new Date().toISOString(), tz: parsed.data.tz, onProposal: operation => emit({ type: "proposal", operation }) });
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") emit({ type: "text", text: part.text });
        if (part.type === "error") throw part.error;
        if (part.type === "source" && part.sourceType === "url") emit({ type: "source", url: part.url, title: part.title });
      }
      emit({ type: "done" });
    } catch (error) {
      if (!request.signal.aborted) emit({ type: "error", error: error instanceof Error ? error.message : "Le copilote n'a pas pu répondre." });
    } finally { controller.close(); }
  } });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
} } } });