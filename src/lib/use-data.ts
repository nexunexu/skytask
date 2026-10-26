import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Note = Tables<"notes">;
export type Goal = Tables<"goals">;
export type TaskList = Tables<"task_lists">;

export function useData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [t, n, g, l] = await Promise.all([
      supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("goals").select("*").order("created_at"),
      supabase.from("task_lists").select("*").order("created_at"),
    ]);
    setTasks(t.data ?? []);
    setNotes(n.data ?? []);
    setGoals(g.data ?? []);
    let ls = l.data ?? [];
    if (!ls.some((x) => x.is_default)) {
      const { data } = await supabase.from("task_lists").insert({ name: "Par défaut", is_default: true }).select().single();
      if (data) ls = [...ls, data];
    }
    setLists(ls);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    const ch = supabase.channel(`ultra-${Math.random().toString(36).slice(2)}`);
    for (const table of ["tasks", "notes", "goals", "task_lists"])
      ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    ch.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { tasks, notes, goals, lists, loaded, reload: load };
}

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function computeKpis(tasks: Task[], notes: Note[], goals: Goal[]) {
  const today = day(new Date());
  const todays = tasks.filter((t) => (t.due_at && day(new Date(t.due_at)) === today) || (t.completed_at && day(new Date(t.completed_at)) === today));
  const todayDone = todays.filter((t) => t.done).length;

  const series: { label: string; value: number }[] = [];
  const names = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = day(d);
    const due = tasks.filter((t) => t.due_at && day(new Date(t.due_at)) === k);
    const doneThatDay = tasks.filter((t) => t.completed_at && day(new Date(t.completed_at)) === k);
    const total = new Set([...due, ...doneThatDay].map((t) => t.id)).size;
    const done = new Set([...due.filter((t) => t.done), ...doneThatDay].map((t) => t.id)).size;
    series.push({ label: names[d.getDay()] ?? "", value: total ? Math.round((done / total) * 100) : 0 });
  }
  const weekTotal = tasks.filter((t) => Date.now() - new Date(t.created_at).getTime() < 7 * 864e5 || (t.due_at && Math.abs(Date.now() - new Date(t.due_at).getTime()) < 7 * 864e5));
  const productivity = weekTotal.length ? Math.round((weekTotal.filter((t) => t.done).length / weekTotal.length) * 100) : 0;

  const doneDays = new Set(tasks.filter((t) => t.completed_at).map((t) => day(new Date(t.completed_at!))));
  let streak = 0;
  const c = new Date();
  if (!doneDays.has(day(c))) c.setDate(c.getDate() - 1);
  while (doneDays.has(day(c))) {
    streak++;
    c.setDate(c.getDate() - 1);
  }
  const notesWeek = notes.filter((n) => Date.now() - new Date(n.created_at).getTime() < 7 * 864e5).length;
  const goalsDone = goals.filter((g) => g.progress >= 100).length;
  const goalsAvg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;
  return { todayTotal: todays.length, todayDone, series, productivity, streak, notesWeek, goalsDone, goalsAvg };
}

export function formatDue(iso: string | null) {
  if (!iso) return "Sans date";
  const d = new Date(iso);
  const diff = Math.round((day(d) - day(new Date())) / 864e5);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Aujourd'hui ${time}`;
  if (diff === 1) return `Demain ${time}`;
  if (diff === -1) return `Hier ${time}`;
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ${time}`;
}

export const tagClass = (tag: string) =>
  ({ Travail: "tag-travail", Admin: "tag-admin", Santé: "tag-sante" } as Record<string, string>)[tag] ?? "tag-perso";
