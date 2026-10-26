import { z } from "zod";

export const entitySchema = z.enum(["tasks", "notes", "task_lists", "goals", "attachments"]);
export type Entity = z.infer<typeof entitySchema>;
export const actionSchema = z.enum(["create", "update", "delete"]);
const schemas = {
  tasks: z.object({ title: z.string().trim().min(1).max(1000).optional(), due_at: z.string().datetime({ offset: true }).nullable().optional(), list_id: z.string().uuid().nullable().optional(), tag: z.enum(["Travail", "Admin", "Santé", "Personnel"]).optional(), done: z.boolean().optional() }).strict(),
  notes: z.object({ content: z.string().trim().min(1).max(50000).optional(), tasks_extracted: z.number().int().min(0).optional() }).strict(),
  task_lists: z.object({ name: z.string().trim().min(1).max(200).optional() }).strict(),
  goals: z.object({ title: z.string().trim().min(1).max(1000).optional(), progress: z.number().int().min(0).max(100).optional() }).strict(),
  attachments: z.object({}).strict(),
};
export function validateChanges(entity: Entity, action: "create" | "update" | "delete", input: unknown) {
  const changes = schemas[entity].parse(input) as Record<string, string | number | boolean | null>;
  if (action === "delete") return {};
  if (entity === "attachments") throw new Error("Utilisez le bouton de pièces jointes pour importer un fichier.");
  if (!Object.keys(changes).length) throw new Error("Aucune modification demandée.");
  const required = entity === "notes" ? "content" : entity === "task_lists" ? "name" : "title";
  if (action === "create" && !changes[required]) throw new Error("Un titre ou un contenu est requis.");
  return changes;
}