"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { BarChart3, BookOpen, FileText, GraduationCap, Image, Layers, Lock, LogOut, Sparkles, UserRound } from "lucide-react";
import UniversitySelect from "@/components/tma/UniversitySelect";
import {
  adminGetAnalytics,
  adminGetExams,
  adminGetFlashCards,
  adminGetNotes,
  adminGetSubjectSuggestions,
  adminGetUniversityLogo,
  adminCreateExam,
  adminUpdateExam,
  adminDeleteExam,
  adminCreateNote,
  adminUpdateNote,
  adminDeleteNote,
  adminCreateFlashCard,
  adminDeleteFlashCard,
  adminPutUniversityLogo,
  adminReviewSubjectSuggestion,
  type AdminAnalytics,
  type AdminExamMeta,
  type FlashCard,
  type NoteMeta,
  type SubjectSuggestion,
  type UniversityLogo,
} from "@/lib/api";

type Tab = "overview" | "exams" | "notes" | "flash-cards" | "logos" | "suggestions" | "analytics";
type ErrorState = string;

const ADMIN_KEY_STORAGE = "mirkuzAdminKey";
const tabs: { id: Tab; label: string; icon: typeof GraduationCap }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "exams", label: "Exams", icon: FileText },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "flash-cards", label: "Flash Cards", icon: Layers },
  { id: "logos", label: "Logos", icon: Image },
  { id: "suggestions", label: "Suggestions", icon: UserRound },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const examPayload = {
  subject: "",
  year: "",
  title: "",
  university: "",
  custom_tag: "",
  question_count: 100,
  duration_minutes: 120,
  content_type: "html" as "html" | "pdf",
  content_data: "<p>Exam content</p>",
  semester: "all",
  exam_type: "final" as "final" | "mid",
  is_premium: false,
  is_published: false,
};

const notePayload = {
  subject: "",
  grade: 12,
  stream: "",
  chapter_number: 1,
  title: "",
  html_content: "<p>Note content</p>",
  semester: "all",
  is_premium: false,
  is_published: false,
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The admin API returned an unknown error.";
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-bold text-slate-600">{label}</span><input type={type} value={String(value)} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>;
}

function ErrorBanner({ error }: { error: ErrorState }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-blue-600">{value}</p></div>;
}

export default function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [key, setKey] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!stored) return;
    verifyKey(stored).then((ok) => {
      if (ok) setUnlocked(true);
      else sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    });
  }, []);

  async function verifyKey(adminKey: string): Promise<boolean> {
    try {
      const response = await fetch("/api/admin/verify", { headers: { "x-admin-key": adminKey } });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const adminKey = key.trim();
    if (!adminKey) return;
    setAuthenticating(true);
    setAuthError("");
    const ok = await verifyKey(adminKey);
    setAuthenticating(false);
    if (!ok) {
      setAuthError("Invalid admin key.");
      return;
    }
    sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    setUnlocked(true);
  }

  function signOut() {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setUnlocked(false);
    setKey("");
  }

  if (!unlocked) {
    return <main className="min-h-screen bg-slate-950 px-4 py-16 text-white"><section className="mx-auto max-w-md rounded-3xl bg-white p-7 text-slate-900 shadow-2xl"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600"><Lock className="h-7 w-7 text-white" /></div><h1 className="text-2xl font-black">Freshman Admin</h1><p className="mt-2 text-sm leading-6 text-slate-500">Manage the study experience for new Fresho students.</p><form onSubmit={unlock} className="mt-6 space-y-3"><input type="password" value={key} onChange={(event) => setKey(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Admin key" autoFocus />{authError && <p className="text-sm font-semibold text-red-600">{authError}</p>}<button disabled={authenticating} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50">{authenticating ? "Verifying..." : "Open Dashboard"}</button></form></section></main>;
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b bg-white px-4 py-5 sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Fresho Control Center</p><h1 className="text-2xl font-black">Freshman Learning Dashboard</h1></div><button onClick={signOut} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"><LogOut className="h-4 w-4" /> Sign out</button></div></header><div className="mx-auto max-w-7xl px-4 py-6 sm:px-8"><nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</nav>{activeTab === "overview" && <Overview />}{activeTab === "exams" && <ExamsManager />}{activeTab === "notes" && <NotesManager />}{activeTab === "flash-cards" && <FlashCardsManager />}{activeTab === "logos" && <LogosManager />}{activeTab === "suggestions" && <SuggestionsManager />}{activeTab === "analytics" && <AnalyticsManager />}</div></main>;
}

function Overview() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { adminGetAnalytics().then(setData).catch((value) => setError(message(value))); }, []);
  return <div className="space-y-6">{error && <ErrorBanner error={error} />}<div className="grid gap-4 md:grid-cols-3"><Metric label="Students" value={data?.total_students ?? 0} /><Metric label="Exam attempts" value={data?.total_attempts ?? 0} /><Metric label="Average score" value={data?.avg_score ? `${data.avg_score.toFixed(1)}%` : "—"} /></div><section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Freshman study resources</h2><p className="mt-2 text-sm text-slate-500">Review exams, notes, flash cards, university logos, and student suggestions from one workspace.</p></section></div>;
}

function ExamsManager() {
  const [items, setItems] = useState<AdminExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(examPayload);
  const [editing, setEditing] = useState<AdminExamMeta | null>(null);
  const load = () => { setLoading(true); setError(""); adminGetExams().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function reset() { setEditing(null); setForm({ ...examPayload }); }
  async function save(event: FormEvent) { event.preventDefault(); if (!form.university) { setError("Select a university."); return; } try { if (editing) await adminUpdateExam(editing.id, form); else await adminCreateExam(form); reset(); load(); } catch (value) { setError(message(value)); } }
  async function remove(id: number) { if (!window.confirm("Delete this exam?")) return; try { await adminDeleteExam(id); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="Exam management" subtitle="Create and publish freshman-level past exams." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: `${item.title} · ${item.year}`, status: item.is_published ? "Published" : "Draft" }))} onDelete={remove} form={<form onSubmit={save} className="grid gap-3 md:grid-cols-2"><Field label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><Field label="Year" value={form.year} onChange={(value) => setForm({ ...form, year: value })} /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} className="md:col-span-2" /><label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">University</span><UniversitySelect value={form.university} onChange={(value) => setForm({ ...form, university: value })} allowCustom={false} /></label><select className="rounded-xl border border-slate-200 px-3 py-2" value={form.exam_type} onChange={(event) => setForm({ ...form, exam_type: event.target.value as "final" | "mid" })}><option value="final">Final exam</option><option value="mid">Mid exam</option></select><Field label="Questions" type="number" value={form.question_count} onChange={(value) => setForm({ ...form, question_count: Number(value) })} /><Field label="Minutes" type="number" value={form.duration_minutes} onChange={(value) => setForm({ ...form, duration_minutes: Number(value) })} /><select className="rounded-xl border border-slate-200 px-3 py-2" value={form.content_type} onChange={(event) => setForm({ ...form, content_type: event.target.value as "html" | "pdf" })}><option value="html">HTML</option><option value="pdf">PDF URL or data URI</option></select><textarea className="min-h-24 rounded-xl border border-slate-200 p-3 md:col-span-2" value={form.content_data} onChange={(event) => setForm({ ...form, content_data: event.target.value })} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish immediately</label><div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">{editing ? "Save changes" : "Create exam"}</button>{editing && <button type="button" onClick={reset} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">Cancel</button>}</div></form>} />;
}

function NotesManager() {
  const [items, setItems] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(notePayload);
  const load = () => { setLoading(true); setError(""); adminGetNotes().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  async function save(event: FormEvent) { event.preventDefault(); try { await adminCreateNote({ ...form }); setForm({ ...notePayload }); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="Notes management" subtitle="Publish clear freshman study notes." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: `${item.title} · Grade ${item.grade}`, status: item.is_published ? "Published" : "Draft" }))} onDelete={(id) => adminDeleteNote(id).then(load).catch((value) => setError(message(value)))} form={<form onSubmit={save} className="grid gap-3 md:grid-cols-2"><Field label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} /><Field label="Grade" type="number" value={form.grade} onChange={(value) => setForm({ ...form, grade: Number(value) })} /><Field label="Stream" value={form.stream} onChange={(value) => setForm({ ...form, stream: value })} /><Field label="Chapter" type="number" value={form.chapter_number} onChange={(value) => setForm({ ...form, chapter_number: Number(value) })} /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} className="md:col-span-2" /><textarea className="min-h-32 rounded-xl border border-slate-200 p-3 md:col-span-2" value={form.html_content} onChange={(event) => setForm({ ...form, html_content: event.target.value })} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_premium} onChange={(event) => setForm({ ...form, is_premium: event.target.checked })} /> Premium only</label><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">Save note</button></form>} />;
}

function FlashCardsManager() {
  const [items, setItems] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", html_content: "", is_published: false });
  const load = () => { setLoading(true); setError(""); adminGetFlashCards().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  async function save(event: FormEvent) { event.preventDefault(); try { await adminCreateFlashCard(form); setForm({ title: "", html_content: "", is_published: false }); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="Game flash cards" subtitle="Create cards used by the freshman game." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: item.title, status: item.is_published ? "Published" : "Draft" }))} onDelete={(id) => adminDeleteFlashCard(id).then(load).catch((value) => setError(message(value)))} form={<form onSubmit={save} className="space-y-3"><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} /><textarea className="min-h-40 w-full rounded-xl border border-slate-200 p-3" value={form.html_content} onChange={(event) => setForm({ ...form, html_content: event.target.value })} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish to the game</label><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">Create flash card</button></form>} />;
}

function LogosManager() {
  const [items, setItems] = useState<UniversityLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [university, setUniversity] = useState("");
  const [dataUri, setDataUri] = useState("");
  const load = () => { setLoading(true); setError(""); adminGetUniversityLogo().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function choose(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDataUri(String(reader.result)); reader.readAsDataURL(file); }
  async function save(event: FormEvent) { event.preventDefault(); if (!university) { setError("Select a university."); return; } if (!dataUri.startsWith("data:image/")) { setError("Choose a valid image data URI."); return; } try { await adminPutUniversityLogo({ university, data_uri: dataUri }); setUniversity(""); setDataUri(""); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="University logos" subtitle="Upload a university logo used by student profiles and rankings." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: item.university, status: "Active" }))} form={<form onSubmit={save} className="space-y-3"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">University</span><UniversitySelect value={university} onChange={setUniversity} allowCustom={false} /></label><input type="file" accept="image/*" onChange={choose} className="block w-full" /><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">Save logo</button></form>} />;
}

function SuggestionsManager() {
  const [items, setItems] = useState<SubjectSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => { setLoading(true); setError(""); adminGetSubjectSuggestions().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  async function review(id: number, status: "approved" | "rejected") { try { await adminReviewSubjectSuggestion(id, status); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="Student subject suggestions" subtitle="Review subjects requested by freshman students." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: `${item.stream} · ${item.subject_name}`, status: item.status }))} form={<div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><p className="font-bold">{item.subject_name}</p><p className="mt-1 text-sm text-slate-500">{item.reason || "No reason provided"}</p><div className="mt-3 flex gap-2"><button onClick={() => review(item.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => review(item.id, "rejected")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Reject</button></div></div>)}</div>} />;
}

function AnalyticsManager() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { adminGetAnalytics().then((value) => { setData(value); setLoading(false); }).catch((value) => { setError(message(value)); setLoading(false); }); }, []);
  if (loading) return <p className="rounded-2xl bg-white p-8 text-slate-500">Loading analytics...</p>;
  return <div className="space-y-6">{error && <ErrorBanner error={error} />}<div className="grid gap-4 md:grid-cols-3"><Metric label="Students" value={data?.total_students ?? 0} /><Metric label="Attempts" value={data?.total_attempts ?? 0} /><Metric label="Average score" value={data?.avg_score ? `${data.avg_score.toFixed(1)}%` : "—"} /></div><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">Stream distribution</h2><div className="mt-4 space-y-3">{data?.stream_distribution.map((item) => <div key={item.stream}><div className="flex justify-between text-sm"><span className="capitalize">{item.stream}</span><span>{item.students}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (item.students / Math.max(1, data.total_students)) * 100)}%` }} /></div></div>)}</div></section></div>;
}

function ResourcePanel({ title, subtitle, loading, error, items, onDelete, form }: { title: string; subtitle: string; loading: boolean; error: string; items: { id: number; name: string; status: string }[]; onDelete?: (id: number) => void; form: ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p>{loading ? <p className="mt-5 text-sm text-slate-500">Loading...</p> : error ? <ErrorBanner error={error} /> : <div className="mt-5 space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.status}</p></div>{onDelete && <button onClick={() => onDelete(item.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Delete</button>}</div>)}</div>}</section><section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-black">Create or update</h3><div className="mt-4">{form}</div></section></div>;
}
