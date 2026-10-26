import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Search, LayoutDashboard, CheckSquare, NotebookPen, CalendarDays, Bell, Target, BarChart3, Settings,
  Check, TrendingUp, Flame, Trophy, Briefcase, Plus, ArrowRight, Sparkles, Globe, ChevronDown, Calendar,
  Keyboard, Mic, Paperclip, MessageSquare, History, Navigation, Trash2, LogOut, Menu, X, Square, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData, computeKpis, formatDue, tagClass, type Task } from "@/lib/use-data";
import { useVoice } from "@/lib/use-voice";
import { ProductivityChart, Ring } from "@/components/dash/ProductivityChart";
import { CopilotPanel, JournalView } from "@/components/dash/Copilot";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ultra" },
      { name: "description", content: "Vos tâches, notes, objectifs et KPI de productivité en temps réel." },
      { property: "og:title", content: "Dashboard — Ultra" },
      { property: "og:description", content: "Pilotez vos tâches et notes à la voix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Section = "overview" | "tasks" | "notes" | "calendar" | "reminders" | "goals" | "stats" | "assistant" | "journal" | "settings";
const NAV: { id: Section; label: string; icon: typeof Search }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "tasks", label: "Tâches", icon: CheckSquare },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "calendar", label: "Calendrier", icon: CalendarDays },
  { id: "reminders", label: "Rappels", icon: Bell },
  { id: "goals", label: "Objectifs", icon: Target },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "journal", label: "Journal", icon: History },
  { id: "settings", label: "Paramètres", icon: Settings },
];

const reloadData = () => window.dispatchEvent(new Event("ultra:reload"));
async function toggleTask(t: Task) {
  const { error } = await supabase.from("tasks").update({ done: !t.done, completed_at: t.done ? null : new Date().toISOString() }).eq("id", t.id);
  if (error) return toast.error(`Impossible de modifier la tâche : ${error.message}`);
  toast.success(t.done ? "Tâche rouverte" : "Tâche terminée ✅");
  reloadData();
}
async function deleteRow(table: "tasks" | "notes" | "goals" | "task_lists", id: string, label: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return toast.error(`Suppression impossible : ${error.message}`);
  toast.success(`${label} supprimé(e)`);
  reloadData();
}

function Dashboard() {
  const data = useData();
  const [section, setSection] = useState<Section>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("fr");
  const voice = useVoice(lang);
  const kpi = useMemo(() => computeKpis(data.tasks, data.notes, data.goals), [data.tasks, data.notes, data.goals]);

  const go = (s: Section) => { setSection(s); setMobileNav(false); };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen shrink-0 bg-sidebar/90 backdrop-blur-xl border-r border-sidebar-border flex flex-col transition-all duration-300
        ${collapsed ? "lg:w-20" : "lg:w-56"} w-64 ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="icon-chip chip-purple h-8 w-8"><Sparkles className="h-4 w-4" /></div>
            {!collapsed && <span className="font-bold text-lg">Ultra</span>}
          </div>
          <button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        {!collapsed && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-sidebar-accent/60 border border-sidebar-border px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); if (e.target.value) setSection("tasks"); }}
              placeholder="Rechercher" className="bg-transparent outline-none flex-1 min-w-0 placeholder:text-muted-foreground" />
            <span className="text-xs text-muted-foreground">⌘K</span>
          </div>
        )}
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} title={n.label}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${section === n.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-inner" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50"}`}>
              <n.icon className={`h-5 w-5 shrink-0 ${section === n.id ? "text-neon-blue" : ""}`} />
              {!collapsed && n.label}
            </button>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex flex-col items-center gap-1 py-6 text-xs font-semibold">
          <Navigation className={`h-4 w-4 -rotate-90 transition ${collapsed ? "rotate-90" : ""}`} />
          {collapsed ? "Déplier" : "Replier"}
        </button>
      </aside>
      {mobileNav && <div className="fixed inset-0 z-30 bg-background/60 lg:hidden" onClick={() => setMobileNav(false)} />}

      <main className="flex-1 min-w-0 p-3 sm:p-5 pb-28 lg:pb-5">
        <div className="lg:hidden flex items-center justify-between mb-3">
          <button onClick={() => setMobileNav(true)} className="glass p-2" aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold">{NAV.find((n) => n.id === section)?.label}</span>
          <span className="w-9" />
        </div>

        {section === "overview" && <Overview data={data} kpi={kpi} voice={voice} lang={lang} setLang={setLang} go={go} />}
        {section === "tasks" && <TasksView data={data} query={query} />}
        {section === "notes" && <NotesView data={data} voice={voice} />}
        {section === "calendar" && <CalendarView tasks={data.tasks} />}
        {section === "reminders" && <RemindersView tasks={data.tasks} />}
        {section === "goals" && <GoalsView goals={data.goals} />}
        {section === "stats" && <StatsView kpi={kpi} data={data} />}
        {section === "assistant" && <CopilotPanel voice={voice} />}
        {section === "journal" && <JournalView />}
        {section === "settings" && <SettingsView lang={lang} setLang={setLang} />}
      </main>

      {/* Floating voice button (mobile + other sections) */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 ${section === "overview" ? "lg:hidden" : ""}`}>
        <VoiceButton voice={voice} />
      </div>
    </div>
  );
}

type Data = ReturnType<typeof useData>;
type Kpi = ReturnType<typeof computeKpis>;
type Voice = ReturnType<typeof useVoice>;

function VoiceButton({ voice }: { voice: Voice }) {
  const busy = voice.state === "transcribing" || voice.state === "analyzing";
  return (
    <button onClick={voice.toggle} disabled={busy} aria-label="Commande vocale"
      className={`round-btn h-16 w-16 ${voice.state === "recording" ? "rec-active" : ""}`}>
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : voice.state === "recording" ? <Square className="h-5 w-5 text-neon-red" /> : <Mic className="h-6 w-6" />}
    </button>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`glass p-4 fade-up ${className}`}>{children}</section>;
}
function CardHead({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 font-semibold">{icon}{title}</h2>
      {action}
    </div>
  );
}

function Kpis({ kpi }: { kpi: Kpi }) {
  const pct = kpi.todayTotal ? Math.round((kpi.todayDone / kpi.todayTotal) * 100) : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <Card className="flex gap-3">
        <div className="icon-chip chip-purple h-10 w-10 shrink-0"><Check className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Tâches du jour</p>
          <p className="text-2xl font-semibold">{kpi.todayDone} <span className="text-base text-muted-foreground">/ {kpi.todayTotal}</span></p>
          <div className="bar-track h-1.5 mt-1"><div className="bar-fill-purple h-full" style={{ width: `${pct}%` }} /></div>
          <p className="text-[10px] text-muted-foreground mt-1">{pct}% complétées</p>
        </div>
      </Card>
      <Card className="flex gap-3 glow-green">
        <div className="icon-chip chip-green h-10 w-10 shrink-0"><TrendingUp className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">Productivité</p>
          <p className="text-2xl font-semibold">{kpi.productivity}<span className="text-base">%</span></p>
          <p className="text-xs text-neon-green">{kpi.productivity >= 70 ? "Excellent travail !" : kpi.productivity >= 40 ? "Continuez ainsi !" : "On s'y met ?"}</p>
        </div>
      </Card>
      <Card className="flex gap-3">
        <div className="icon-chip chip-blue h-10 w-10 shrink-0"><Flame className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">Série actuelle</p>
          <p className="text-2xl font-semibold">{kpi.streak} <span className="text-base">jours</span></p>
          <p className="text-xs text-muted-foreground">Record personnel 🔥</p>
        </div>
      </Card>
      <Card className="flex gap-3 glow-orange">
        <div className="icon-chip chip-orange h-10 w-10 shrink-0"><Trophy className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">Notes créées</p>
          <p className="text-2xl font-semibold">{kpi.notesWeek}</p>
          <p className="text-xs text-muted-foreground">Cette semaine</p>
        </div>
      </Card>
      <Card className="flex gap-3 items-center glow-purple col-span-2 md:col-span-1">
        <div className="icon-chip chip-pink h-10 w-10 shrink-0 self-start"><Briefcase className="h-5 w-5" /></div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Objectifs</p>
          <p className="text-2xl font-semibold">{kpi.goalsDone} <span className="text-base text-muted-foreground">/ {Math.max(kpi.goalsDone, 0) + 0 || 0}</span></p>
          <p className="text-xs text-muted-foreground">En cours</p>
        </div>
        <Ring value={kpi.goalsAvg} />
      </Card>
    </div>
  );
}

function TaskRow({ t }: { t: Task }) {
  const overdue = !t.done && t.due_at && new Date(t.due_at) < new Date();
  const today = t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString();
  return (
    <div className="group flex items-center gap-3 py-2">
      <button onClick={() => toggleTask(t)} aria-label="Terminer"
        className={`h-5 w-5 shrink-0 rounded-full border-2 grid place-items-center transition ${t.done ? "bg-neon-green border-neon-green" : "border-muted-foreground/60 hover:border-neon-green"}`}>
        {t.done && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
        <p className={`text-[11px] flex items-center gap-1 ${t.done ? "text-neon-green" : overdue ? "text-neon-red" : today ? "text-neon-purple" : "text-muted-foreground"}`}>
          <Calendar className="h-3 w-3" />{formatDue(t.due_at)}
        </p>
      </div>
      <span className={`tag ${tagClass(t.tag)}`}>{t.tag}</span>
      <button onClick={() => deleteRow("tasks", t.id, "Tâche")} className="lg:opacity-0 lg:group-hover:opacity-100 text-muted-foreground hover:text-neon-red" aria-label="Supprimer">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuickAdd({ data, listId }: { data: Data; listId?: string | undefined }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [tag, setTag] = useState("Personnel");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const def = data.lists.find((l) => l.is_default);
    const { error } = await supabase.from("tasks").insert({ title: title.trim(), due_at: due ? new Date(due).toISOString() : null, tag, list_id: listId ?? def?.id ?? null });
    if (error) return toast.error(`Tâche non enregistrée : ${error.message}`);
    toast.success("Tâche enregistrée");
    setTitle(""); setDue(""); reloadData();
  }
  return (
    <form onSubmit={add} className="flex flex-wrap gap-2 mb-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche…" className="flex-1 min-w-40 rounded-lg bg-input/50 border px-3 py-2 text-sm outline-none focus:border-primary" />
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg bg-input/50 border px-2 py-2 text-sm" />
      <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-lg bg-input/50 border px-2 py-2 text-sm">
        {["Travail", "Admin", "Santé", "Personnel"].map((x) => <option key={x}>{x}</option>)}
      </select>
      <button className="rounded-lg bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button>
    </form>
  );
}

function Overview({ data, kpi, voice, lang, setLang, go }: { data: Data; kpi: Kpi; voice: Voice; lang: string; setLang: (l: string) => void; go: (s: Section) => void }) {
  const [adding, setAdding] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upcoming = data.tasks.filter((t) => !t.done || (t.completed_at && Date.now() - new Date(t.completed_at).getTime() < 864e5)).slice(0, 4);
  const todayList = data.tasks
    .filter((t) => t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString())
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const dotColor = (tag: string) => (tag === "Santé" ? "bg-neon-orange" : tag === "Admin" ? "bg-neon-green" : tag === "Personnel" ? "bg-neon-blue" : "bg-neon-purple");
  const statusText = { idle: voice.transcript ? "Dernière dictée" : "Prêt à vous écouter", recording: "Dictée en cours...", transcribing: "Transcription...", analyzing: "Analyse intelligente..." }[voice.state];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    if (!text.trim()) { toast.error("Fichier vide ou non lisible (utilisez .txt / .md)."); return; }
    voice.handleText(text.slice(0, 8000), "note");
  }

  return (
    <div className="space-y-4">
      <Kpis kpi={kpi} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardHead icon={<span className="icon-chip chip-blue h-6 w-6"><Check className="h-3.5 w-3.5" /></span>} title="Tâches à venir"
            action={<button onClick={() => setAdding(!adding)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>} />
          {adding && <QuickAdd data={data} />}
          <div className="divide-y divide-border/40">
            {upcoming.length ? upcoming.map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-sm text-muted-foreground py-6 text-center">Aucune tâche. Dites « Tâche … » 🎙️</p>}
          </div>
          <button onClick={() => go("tasks")} className="mt-3 w-full flex justify-between text-sm text-muted-foreground hover:text-foreground">Voir toutes les tâches <ArrowRight className="h-4 w-4" /></button>
        </Card>

        <Card className="glow-blue flex flex-col">
          <CardHead icon={<Sparkles className="h-4 w-4 text-neon-blue" />} title="prise de note intelligente" />
          <div className="flex items-center justify-center gap-[3px] h-16">
            {voice.levels.map((l, i) => {
              const center = 1 - Math.abs(i - 20) / 22;
              return <div key={i} className={`wave-bar ${voice.state === "recording" ? "" : "wave-idle"}`}
                style={{ height: `${(voice.state === "recording" ? l : 0.5) * center * 56 + 4}px`, animationDelay: `${i * 40}ms` }} />;
            })}
          </div>
          <p className="text-center text-sm mt-3">{statusText}</p>
          <p className="text-sm text-foreground/85 mt-3 leading-relaxed min-h-16 line-clamp-4">
            {voice.transcript || "Dites « Note » puis votre idée, ou « Tâche » puis ce qu'il faut faire. L'IA détecte et planifie les tâches automatiquement."}
          </p>
          <label className="mt-auto pt-3 inline-flex">
            <span className="relative inline-flex items-center gap-2 rounded-lg border bg-secondary/60 px-3 py-1.5 text-xs">
              <Globe className="h-3.5 w-3.5 text-neon-blue" />
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-transparent outline-none appearance-none pr-4">
                <option value="fr">Français (France)</option>
                <option value="en">English (US)</option>
                <option value="es">Español</option>
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 pointer-events-none" />
            </span>
          </label>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHead icon={<CalendarDays className="h-4 w-4 text-neon-purple" />} title="Aujourd'hui"
            action={<button onClick={() => go("calendar")} className="text-xs rounded-lg border bg-secondary/60 px-3 py-1.5">Voir le calendrier</button>} />
          <div className="relative">
            {todayList.length > 0 && <div className="absolute left-[63px] top-3 bottom-3 w-px bg-gradient-to-b from-neon-purple via-neon-blue to-neon-orange" />}
            {todayList.length ? todayList.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-4 py-3">
                <span className="w-12 text-sm text-muted-foreground">{new Date(t.due_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className={`h-2 w-2 rounded-full ${dotColor(t.tag)} shadow-[0_0_8px_currentColor] relative z-10`} />
                <span className={`flex-1 text-sm font-medium truncate ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                <span className={`tag ${tagClass(t.tag)}`}>{t.tag}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground py-8 text-center">Rien de planifié aujourd'hui.</p>}
          </div>
        </Card>

        <Card className="glow-purple">
          <CardHead icon={<span className="icon-chip chip-pink h-6 w-6"><Target className="h-3.5 w-3.5" /></span>} title="Objectifs"
            action={<button onClick={() => go("goals")} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>} />
          <GoalBars goals={data.goals.slice(0, 3)} />
        </Card>

        {/* Orb */}
        <div className="relative flex flex-col items-center justify-center py-6 min-h-64 fade-up">
          <div className="absolute bottom-6 h-24 w-72 orb-ring" />
          <div className="flex items-center gap-8 sm:gap-12">
            <button onClick={() => setTyping(!typing)} className="round-btn h-12 w-12" aria-label="Clavier"><Keyboard className="h-5 w-5" /></button>
            <button onClick={voice.toggle} aria-label="Parler" className="relative h-36 w-36">
              <div className={`orb absolute inset-0 ${voice.state === "recording" ? "scale-110" : ""}`} />
              <div className="orb-surface absolute inset-2" />
              {voice.state !== "idle" && voice.state !== "recording" && <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary-foreground" />}
            </button>
            <button onClick={voice.toggle} className={`round-btn h-12 w-12 ${voice.state === "recording" ? "rec-active" : ""}`} aria-label="Micro">
              {voice.state === "recording" ? <Square className="h-4 w-4 text-neon-red" /> : <Mic className="h-5 w-5" />}
            </button>
          </div>
          <div className="relative w-full flex justify-center mt-6">
            <p className="text-center text-sm text-gradient-cta font-medium">
              {voice.state === "recording" ? "Je vous écoute… touchez pour arrêter" : <>Cliquez et dites "Note" ou "Tâche"<br />pour commencer</>}
            </p>
            <button onClick={() => fileRef.current?.click()} className="absolute right-0 sm:right-4 -top-4 flex flex-col items-center text-[10px] font-semibold">
              <Paperclip className="h-5 w-5 -rotate-45" />Importer<br />fichier
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={onFile} />
          </div>
          {typing && (
            <form className="mt-4 flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { voice.handleText(typed); setTyped(""); setTyping(false); } }}>
              <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder='Ex : "Tâche appeler Paul demain 10h"'
                className="flex-1 rounded-lg bg-input/60 border px-3 py-2 text-sm outline-none focus:border-primary" />
              <button className="rounded-lg bg-primary px-3 text-primary-foreground text-sm">OK</button>
            </form>
          )}
        </div>

        <Card>
          <CardHead icon={<BarChart3 className="h-4 w-4 text-neon-blue" />} title="Analyse de productivité"
            action={<span className="text-xs rounded-lg border bg-secondary/60 px-3 py-1.5">7 derniers jours</span>} />
          <ProductivityChart series={kpi.series} />
        </Card>
      </div>
    </div>
  );
}

function GoalBars({ goals }: { goals: Data["goals"] }) {
  const fills = ["bar-fill-purple", "bar-fill-blue", "bar-fill-green"];
  if (!goals.length) return <p className="text-sm text-muted-foreground py-6 text-center">Ajoutez votre premier objectif.</p>;
  return (
    <div className="space-y-5 py-2">
      {goals.map((g, i) => (
        <div key={g.id}>
          <div className="flex justify-between text-sm mb-2"><span>{g.title}</span><span>{g.progress}%</span></div>
          <div className="bar-track h-1.5"><div className={`${fills[i % 3]} h-full`} style={{ width: `${g.progress}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function TasksView({ data, query }: { data: Data; query: string }) {
  const [listId, setListId] = useState<string | "all">("all");
  const [newList, setNewList] = useState("");
  const [showDone, setShowDone] = useState(true);
  const filtered = data.tasks.filter((t) => (listId === "all" || t.list_id === listId) && (showDone || !t.done) && t.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card>
        <CardHead icon={<CheckSquare className="h-4 w-4 text-neon-purple" />} title="Listes" />
        <div className="space-y-1">
          <button onClick={() => setListId("all")} className={`w-full text-left rounded-lg px-3 py-2 text-sm ${listId === "all" ? "bg-accent" : "hover:bg-accent/50"}`}>Toutes ({data.tasks.length})</button>
          {data.lists.map((l) => (
            <div key={l.id} className={`group flex items-center rounded-lg ${listId === l.id ? "bg-accent" : "hover:bg-accent/50"}`}>
              <button onClick={() => setListId(l.id)} className="flex-1 text-left px-3 py-2 text-sm truncate">
                {l.name} {l.is_default && <span className="text-[10px] text-muted-foreground">(défaut)</span>} ({data.tasks.filter((t) => t.list_id === l.id).length})
              </button>
              {!l.is_default && <button onClick={() => deleteRow("task_lists", l.id, "Liste")} className="px-2 lg:opacity-0 lg:group-hover:opacity-100 text-muted-foreground hover:text-neon-red"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
        <form className="flex gap-2 mt-3" onSubmit={async (e) => { e.preventDefault(); if (newList.trim()) { const { error } = await supabase.from("task_lists").insert({ name: newList.trim() }); if (error) toast.error(`Liste non créée : ${error.message}`); else { toast.success("Liste créée"); setNewList(""); reloadData(); } } }}>
          <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Nouvelle liste" className="flex-1 min-w-0 rounded-lg bg-input/50 border px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-2 text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </form>
      </Card>
      <Card>
        <CardHead icon={<Check className="h-4 w-4 text-neon-green" />} title={listId === "all" ? "Toutes les tâches" : data.lists.find((l) => l.id === listId)?.name ?? ""}
          action={<label className="text-xs flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Terminées</label>} />
        <QuickAdd data={data} listId={listId === "all" ? undefined : listId} />
        <div className="divide-y divide-border/40">
          {filtered.length ? filtered.map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-sm text-muted-foreground py-8 text-center">Aucune tâche ici.</p>}
        </div>
      </Card>
    </div>
  );
}

function NotesView({ data, voice }: { data: Data; voice: Voice }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <Card className="glow-blue">
        <CardHead icon={<NotebookPen className="h-4 w-4 text-neon-blue" />} title="Nouvelle note" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Écrivez une note… l'IA détectera les tâches."
          className="w-full rounded-lg bg-input/50 border px-3 py-2 text-sm outline-none focus:border-primary" />
        <button onClick={() => { if (text.trim()) { voice.handleText(text, "note"); setText(""); } }} disabled={voice.state !== "idle"}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">Enregistrer & analyser</button>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.notes.map((n) => (
          <Card key={n.id} className="group">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{n.content}</p>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>{new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className="flex items-center gap-2">
                {n.tasks_extracted > 0 && <span className="tag tag-admin">{n.tasks_extracted} tâche(s)</span>}
                <button onClick={() => deleteRow("notes", n.id, "Note")} aria-label="Supprimer" className="lg:opacity-0 lg:group-hover:opacity-100 hover:text-neon-red"><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          </Card>
        ))}
        {!data.notes.length && <p className="text-sm text-muted-foreground">Aucune note. Dites « Note … » 🎙️</p>}
      </div>
    </div>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {days.map((d) => {
        const list = tasks.filter((t) => t.due_at && new Date(t.due_at).toDateString() === d.toDateString());
        return (
          <Card key={d.toISOString()}>
            <CardHead icon={<CalendarDays className="h-4 w-4 text-neon-purple" />} title={d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} />
            {list.length ? list.map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-xs text-muted-foreground">Libre</p>}
          </Card>
        );
      })}
    </div>
  );
}

function RemindersView({ tasks }: { tasks: Task[] }) {
  const now = Date.now();
  const overdue = tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < now);
  const soon = tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() >= now && new Date(t.due_at).getTime() < now + 2 * 864e5);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="glow-orange">
        <CardHead icon={<Bell className="h-4 w-4 text-neon-red" />} title={`En retard (${overdue.length})`} />
        {overdue.length ? overdue.map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-sm text-muted-foreground">Rien en retard 🎉</p>}
      </Card>
      <Card className="glow-purple">
        <CardHead icon={<Bell className="h-4 w-4 text-neon-purple" />} title={`Prochaines 48 h (${soon.length})`} />
        {soon.length ? soon.map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-sm text-muted-foreground">Aucun rappel proche.</p>}
      </Card>
    </div>
  );
}

function GoalsView({ goals }: { goals: Data["goals"] }) {
  const [title, setTitle] = useState("");
  return (
    <Card className="glow-purple max-w-2xl">
      <CardHead icon={<Target className="h-4 w-4 text-neon-pink" />} title="Objectifs" />
      <form className="flex gap-2 mb-4" onSubmit={async (e) => { e.preventDefault(); if (title.trim()) { const { error } = await supabase.from("goals").insert({ title: title.trim() }); if (error) toast.error(`Objectif non créé : ${error.message}`); else { toast.success("Objectif enregistré"); setTitle(""); reloadData(); } } }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Lire 12 livres cette année 📚" className="flex-1 rounded-lg bg-input/50 border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </form>
      <div className="space-y-5">
        {goals.map((g) => (
          <div key={g.id} className="group">
            <div className="flex justify-between text-sm mb-2">
              <span>{g.title}</span>
              <span className="flex items-center gap-2">{g.progress}%
                <button onClick={() => deleteRow("goals", g.id, "Objectif")} className="lg:opacity-0 lg:group-hover:opacity-100 text-muted-foreground hover:text-neon-red"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
            <input type="range" min={0} max={100} defaultValue={g.progress} className="w-full accent-primary"
              onMouseUp={(e) => supabase.from("goals").update({ progress: +(e.target as HTMLInputElement).value }).eq("id", g.id)}
              onTouchEnd={(e) => supabase.from("goals").update({ progress: +(e.target as HTMLInputElement).value }).eq("id", g.id)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatsView({ kpi, data }: { kpi: Kpi; data: Data }) {
  const done = data.tasks.filter((t) => t.done).length;
  const byTag = ["Travail", "Admin", "Santé", "Personnel"].map((tag) => ({ tag, n: data.tasks.filter((t) => t.tag === tag).length }));
  return (
    <div className="space-y-4">
      <Kpis kpi={kpi} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHead icon={<BarChart3 className="h-4 w-4 text-neon-blue" />} title="Taux de complétion (7 j)" /><ProductivityChart series={kpi.series} /></Card>
        <Card>
          <CardHead icon={<TrendingUp className="h-4 w-4 text-neon-green" />} title="Répartition" />
          <p className="text-sm mb-4">{done} tâches terminées sur {data.tasks.length} · {data.notes.length} notes</p>
          <div className="space-y-4">
            {byTag.map((b) => (
              <div key={b.tag}>
                <div className="flex justify-between text-sm mb-1"><span className={`tag ${tagClass(b.tag)}`}>{b.tag}</span><span>{b.n}</span></div>
                <div className="bar-track h-1.5"><div className="bar-fill-purple h-full" style={{ width: `${data.tasks.length ? (b.n / data.tasks.length) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SettingsView({ lang, setLang }: { lang: string; setLang: (l: string) => void }) {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  return (
    <Card className="max-w-lg space-y-4">
      <CardHead icon={<Settings className="h-4 w-4" />} title="Paramètres" />
      <p className="text-sm text-muted-foreground">Connecté : <span className="text-foreground">{user.email}</span></p>
      <label className="block text-sm">Langue de dictée
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 block w-full rounded-lg bg-input/50 border px-3 py-2">
          <option value="fr">Français</option><option value="en">English</option><option value="es">Español</option>
        </select>
      </label>
      <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
        className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-destructive/20"><LogOut className="h-4 w-4" />Se déconnecter</button>
    </Card>
  );
}
