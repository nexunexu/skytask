import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const confirmCopilotOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), confirm: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("run_audited_copilot_operation", { operation_id: data.id, confirmed: data.confirm });
    if (error) return { status: "unknown", result: null, message: `Résultat non vérifié : ${error.message}. Consultez le journal avant de recommencer.` };
    if (!result || typeof result !== "object" || Array.isArray(result)) return { status: "unknown", result: null, message: "Aucun résultat vérifiable reçu. Consultez le journal." };
    return { status: String(result['status']), result: result['result'] ?? null, message: String(result['message'] ?? "Résultat non vérifié.") };
  });