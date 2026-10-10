"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { BarChart3, BookOpen, CircleDollarSign, ClipboardList, FileText, GraduationCap, Image, Layers, Lock, LogOut, Pencil, Settings, Sparkles, TrendingUp, User, Crown, Megaphone, Trash2 } from "lucide-react";
import UniversitySelect from "@/components/tma/UniversitySelect";
import {
  adminGetAnalytics,
  adminGetExams,
  adminGetExam,
  adminGetFlashCards,
  adminGetNotes,
  adminGetNote,
  adminGetSubjectSuggestions,
  adminGetUniversityLogo,
  adminCreateExam,
  adminToggleExamPremium,
  adminToggleExamPublish,
  adminUpdateExam,
  adminDeleteExam,
  adminCreateNote,
  adminToggleNotePremium,
  adminToggleNotePublish,
  adminDeleteNote,
  adminCreateChapterExam,
  adminGetChapterExams,
  adminGetChapterExam,
  adminUpdateChapterExam,
  adminDeleteChapterExam,
  adminToggleChapterExamPremium,
  adminToggleChapterExamPublish,
  adminCreateFlashCard,
  adminDeleteFlashCard,
  adminToggleFlashCardPremium,
  adminToggleFlashCardPublish,
  adminUpdateFlashCard,
  adminUpdateNote,
  adminPutUniversityLogo,
  adminReviewSubjectSuggestion,
  adminGetSubscriptionConfig,
  adminUpdateSubscriptionConfig,
  adminGetBroadcasts,
  adminCreateBroadcast,
  adminDeleteBroadcast,
  type AdminAnalytics,
  type AdminExamMeta,
  type ChapterExamMeta,
  type FlashCard,
  type NoteMeta,
  type SubjectSuggestion,
  type SubscriptionConfig,
  type UniversityLogo,
  type Broadcast,
} from "@/lib/api";
import { NATURAL_SUBJECTS, SOCIAL_SUBJECTS, SUBJECTS } from "@/lib/subjects";
import { migrateLegacyStorage } from "@/lib/legacyStorage";

type Tab = "overview" | "exams" | "notes" | "chapter-exams" | "flash-cards" | "logos" | "suggestions" | "analytics" | "pricing" | "broadcasts";
type ErrorState = string;

const ADMIN_KEY_STORAGE = "freshoAdminKey";
const tabs: { id: Tab; label: string; icon: typeof GraduationCap }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "exams", label: "Exams", icon: FileText },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "chapter-exams", label: "Chapter Questions", icon: ClipboardList },
  { id: "flash-cards", label: "Flash Cards", icon: Layers },
  { id: "logos", label: "Logos", icon: Image },
  { id: "suggestions", label: "Suggestions", icon: User },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "pricing", label: "Pricing", icon: CircleDollarSign },
  { id: "broadcasts", label: "Broadcasts", icon: Megaphone },
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
  subject: "mathematics",
  stream: "natural",
  chapter_number: 1,
  title: "",
  html_content: "<p>Note content</p>",
  semester: "all",
  is_premium: false,
  is_published: false,
};

function readLocalFile(file: File, contentType: "html" | "pdf"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}.`));
    if (contentType === "pdf") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

function subjectOptions(stream: string): string[] {
  return stream === "social" ? [...SOCIAL_SUBJECTS] : [...NATURAL_SUBJECTS];
}

const allStudentSubjects = [...new Set([...NATURAL_SUBJECTS, ...SOCIAL_SUBJECTS])];

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
    migrateLegacyStorage();
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

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b bg-white px-4 py-5 sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Fresho Control Center</p><h1 className="text-2xl font-black">Freshman Learning Dashboard</h1></div><button onClick={signOut} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"><LogOut className="h-4 w-4" /> Sign out</button></div></header><div className="mx-auto max-w-7xl px-4 py-6 sm:px-8"><nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</nav>{activeTab === "overview" && <Overview />}{activeTab === "exams" && <ExamsManager />}{activeTab === "notes" && <NotesManager />}{activeTab === "chapter-exams" && <ChapterExamsManager />}{activeTab === "flash-cards" && <FlashCardsManager />}{activeTab === "logos" && <LogosManager />}{activeTab === "suggestions" && <SuggestionsManager />}{activeTab === "analytics" && <AnalyticsManager />}{activeTab === "pricing" && <PricingManager />}{activeTab === "broadcasts" && <BroadcastsManager />}</div></main>;
}

function Overview() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { adminGetAnalytics().then(setData).catch((value) => setError(message(value))); }, []);
  const profit = data ? data.monthly_revenue - data.monthly_operating_cost : 0;
  const margin = data && data.monthly_revenue ? (profit / data.monthly_revenue) * 100 : 0;
  return <div className="space-y-6">{error && <ErrorBanner error={error} />}<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Metric label="Students" value={data?.total_students ?? 0} /><Metric label="Active subscribers" value={data?.active_subscribers ?? 0} /><Metric label="Monthly revenue" value={data ? new Intl.NumberFormat().format(data.monthly_revenue) : "—"} /><Metric label="Estimated profit" value={data ? new Intl.NumberFormat().format(profit) : "—"} /></div><div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Freshman study resources</h2><p className="mt-2 text-sm text-slate-500">Review exams, notes, flash cards, university logos, and student suggestions from one workspace.</p></section><section className="rounded-2xl bg-blue-600 p-6 text-white shadow-sm"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /><h2 className="text-xl font-black">Business health</h2></div><p className="mt-4 text-3xl font-black">{margin.toFixed(1)}%</p><p className="mt-1 text-sm text-blue-100">Estimated monthly profit margin</p></section></div></div>;
}

function ExamsManager() {
  const [items, setItems] = useState<AdminExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(examPayload);
  const [editing, setEditing] = useState<AdminExamMeta | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const load = () => { setLoading(true); setError(""); adminGetExams().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function reset() { setEditing(null); setForm({ ...examPayload }); setUploadedFile(null); }
  async function edit(id: number) {
    setError("");
    try {
      const exam = await adminGetExam(id);
      setEditing(items.find((item) => item.id === id) || null);
      setForm({ ...exam, semester: exam.semester ?? "all" });
      setUploadedFile(null);
    } catch (value) { setError(message(value)); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.university) { setError("Select a university."); return; }
    setError("");
    try {
      const payload = uploadedFile
        ? { ...form, content_data: await readLocalFile(uploadedFile, form.content_type) }
        : form;
      if (editing) await adminUpdateExam(editing.id, payload);
      else await adminCreateExam(payload);
      reset();
      load();
    } catch (value) { setError(message(value)); }
  }
  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setForm({ ...form, content_type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "html" });
    }
  }
  async function remove(id: number) { if (!window.confirm("Delete this exam?")) return; try { await adminDeleteExam(id); load(); } catch (value) { setError(message(value)); } }
  return <ResourcePanel title="Exam management" subtitle="Create and publish freshman-level past exams." loading={loading} error={error} items={items.map((item) => ({ id: item.id, name: `${item.title} · ${item.year}`, status: item.is_published ? "Published" : "Draft", is_premium: item.is_premium, is_published: item.is_published }))} onEdit={edit} onTogglePublish={(id) => adminToggleExamPublish(id).then(load).catch((value) => setError(message(value)))} onDelete={remove} onTogglePremium={(id) => adminToggleExamPremium(id).then(load).catch((value) => setError(message(value)))} form={<form onSubmit={save} className="grid gap-3 md:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Subject</span><select required className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}><option value="">Select a subject</option>{allStudentSubjects.map((subject) => <option key={subject} value={subject}>{SUBJECTS[subject].label}</option>)}</select></label><Field label="Year" value={form.year} onChange={(value) => setForm({ ...form, year: value })} /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} className="md:col-span-2" /><label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">University</span><UniversitySelect value={form.university} onChange={(value) => setForm({ ...form, university: value })} allowCustom={false} /></label><select className="rounded-xl border border-slate-200 px-3 py-2" value={form.exam_type} onChange={(event) => setForm({ ...form, exam_type: event.target.value as "final" | "mid" })}><option value="final">Final exam</option><option value="mid">Mid exam</option></select><Field label="Questions" type="number" value={form.question_count} onChange={(value) => setForm({ ...form, question_count: Number(value) })} /><Field label="Minutes" type="number" value={form.duration_minutes} onChange={(value) => setForm({ ...form, duration_minutes: Number(value) })} /><select className="rounded-xl border border-slate-200 px-3 py-2" value={form.content_type} onChange={(event) => setForm({ ...form, content_type: event.target.value as "html" | "pdf" })}><option value="html">HTML</option><option value="pdf">PDF</option></select><label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Upload HTML or PDF from your device</span><input type="file" accept=".html,.htm,.pdf,text/html,application/pdf" onChange={handleFileUpload} className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />{uploadedFile && <span className="mt-1 block text-xs text-slate-500">{uploadedFile.name}</span>}</label><textarea aria-label="Exam HTML or content URL" placeholder="Or paste HTML / PDF URL" className="min-h-24 rounded-xl border border-slate-200 p-3 md:col-span-2" value={form.content_data} onChange={(event) => { setUploadedFile(null); setForm({ ...form, content_data: event.target.value }); }} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_premium} onChange={(event) => setForm({ ...form, is_premium: event.target.checked })} /><Crown className="h-4 w-4 text-amber-500" /> Premium access</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish immediately</label><div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">{editing ? "Save changes" : "Create exam"}</button>{editing && <button type="button" onClick={reset} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">Cancel</button>}</div></form>} />;
}

function NotesManager() {
  const [items, setItems] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(notePayload);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<NoteMeta | null>(null);
  const load = () => { setLoading(true); setError(""); adminGetNotes().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function reset() { setEditing(null); setForm({ ...notePayload }); setUploadedFile(null); }
  async function edit(id: number) {
    setError("");
    try {
      const note = await adminGetNote(id);
      setEditing(items.find((item) => item.id === id) || null);
      setForm({
        subject: note.subject,
        stream: note.stream?.toLowerCase() === "social" ? "social" : "natural",
        chapter_number: note.chapter_number,
        title: note.title,
        html_content: note.html_content,
        semester: note.semester || "all",
        is_premium: note.is_premium,
        is_published: note.is_published,
      });
      setUploadedFile(null);
    } catch (value) { setError(message(value)); }
  }
  function changeStream(stream: "natural" | "social") {
    setForm({ ...form, stream, subject: subjectOptions(stream)[0] });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const html_content = uploadedFile ? await readLocalFile(uploadedFile, "html") : form.html_content;
      const payload = { ...form, html_content };
      if (editing) await adminUpdateNote(editing.id, payload);
      else await adminCreateNote(payload);
      reset();
      load();
    } catch (value) { setError(message(value)); }
  }
  return <ResourcePanel
    title="Notes management"
    subtitle="Publish freshman study notes for the selected stream."
    loading={loading}
    error={error}
    items={items.map((item) => ({ id: item.id, name: `${item.title} · Chapter ${item.chapter_number}`, status: item.is_published ? "Published" : "Draft", is_premium: item.is_premium, is_published: item.is_published }))}
    onEdit={edit}
    onTogglePublish={(id) => adminToggleNotePublish(id).then(load).catch((value) => setError(message(value)))}
    onDelete={(id) => adminDeleteNote(id).then(load).catch((value) => setError(message(value)))}
    onTogglePremium={(id) => adminToggleNotePremium(id).then(load).catch((value) => setError(message(value)))}
    form={<form onSubmit={save} className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Stream</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.stream} onChange={(event) => changeStream(event.target.value as "natural" | "social")}><option value="natural">Natural Science</option><option value="social">Social Science</option></select></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Subject</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>{subjectOptions(form.stream).map((subject) => <option key={subject} value={subject}>{SUBJECTS[subject].label}</option>)}</select></label>
      <Field label="Chapter" type="number" value={form.chapter_number} onChange={(value) => setForm({ ...form, chapter_number: Number(value) })} />
      <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
      <label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Upload an HTML file from your device</span><input type="file" accept=".html,.htm,text/html" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />{uploadedFile && <span className="mt-1 block text-xs text-slate-500">{uploadedFile.name}</span>}</label>
      <textarea aria-label="Note HTML content" placeholder="Or paste note HTML" className="min-h-32 rounded-xl border border-slate-200 p-3 md:col-span-2" value={form.html_content} onChange={(event) => { setUploadedFile(null); setForm({ ...form, html_content: event.target.value }); }} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_premium} onChange={(event) => setForm({ ...form, is_premium: event.target.checked })} /><Crown className="h-4 w-4 text-amber-500" /> Premium access</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish immediately</label>
      <div className="flex gap-2"><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">{editing ? "Save changes" : "Save note"}</button>{editing && <button type="button" onClick={reset} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">Cancel</button>}</div>
    </form>}
  />;
}

function ChapterExamsManager() {
  const [items, setItems] = useState<ChapterExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<ChapterExamMeta | null>(null);
  const [form, setForm] = useState({
    subject: "mathematics",
    stream: "natural" as "natural" | "social",
    chapter_number: 1,
    title: "",
    question_count: 10,
    content_type: "html" as "html" | "pdf",
    content_data: "",
    is_premium: false,
    is_published: false,
  });
  const load = () => { setLoading(true); setError(""); adminGetChapterExams().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function reset() {
    setEditing(null);
    setForm({
      subject: "mathematics",
      stream: "natural",
      chapter_number: 1,
      title: "",
      question_count: 10,
      content_type: "html",
      content_data: "",
      is_premium: false,
      is_published: false,
    });
    setUploadedFile(null);
  }
  async function edit(id: number) {
    setError("");
    try {
      const exam = await adminGetChapterExam(id);
      setEditing(items.find((item) => item.id === id) || null);
      setForm({
        subject: exam.subject,
        stream: exam.stream?.toLowerCase() === "social" ? "social" : "natural",
        chapter_number: exam.chapter_number,
        title: exam.title,
        question_count: exam.question_count,
        content_type: exam.content_type,
        content_data: exam.content_data,
        is_premium: exam.is_premium,
        is_published: exam.is_published,
      });
      setUploadedFile(null);
    } catch (value) { setError(message(value)); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const content_data = uploadedFile
        ? await readLocalFile(uploadedFile, form.content_type)
        : form.content_data;
      const payload = { ...form, content_data };
      if (editing) await adminUpdateChapterExam(editing.id, payload);
      else await adminCreateChapterExam(payload);
      reset();
      load();
    } catch (value) { setError(message(value)); }
  }
  function selectFile(file: File | undefined) {
    if (!file) return;
    const content_type = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "html";
    setUploadedFile(file);
    setForm({ ...form, content_type });
  }
  return <ResourcePanel
    title="Chapter question sets"
    subtitle="Upload stream-specific freshman practice as an HTML or PDF file."
    loading={loading}
    error={error}
    items={items.map((item) => ({ id: item.id, name: `${SUBJECTS[item.subject]?.label || item.subject} · Chapter ${item.chapter_number}: ${item.title}`, status: item.is_published ? "Published" : "Draft", is_premium: item.is_premium, is_published: item.is_published }))}
    onEdit={edit}
    onTogglePublish={(id) => adminToggleChapterExamPublish(id).then(load).catch((value) => setError(message(value)))}
    onDelete={(id) => adminDeleteChapterExam(id).then(load).catch((value) => setError(message(value)))}
    onTogglePremium={(id) => adminToggleChapterExamPremium(id).then(load).catch((value) => setError(message(value)))}
    form={<form onSubmit={save} className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Stream</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.stream} onChange={(event) => { const stream = event.target.value as "natural" | "social"; setForm({ ...form, stream, subject: subjectOptions(stream)[0] }); }}><option value="natural">Natural Science</option><option value="social">Social Science</option></select></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Subject</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>{subjectOptions(form.stream).map((subject) => <option key={subject} value={subject}>{SUBJECTS[subject].label}</option>)}</select></label>
      <Field label="Chapter" type="number" value={form.chapter_number} onChange={(value) => setForm({ ...form, chapter_number: Number(value) })} />
      <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
      <Field label="Question count" type="number" value={form.question_count} onChange={(value) => setForm({ ...form, question_count: Number(value) })} className="md:col-span-2" />
      <label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Upload HTML or PDF from your device</span><input type="file" accept=".html,.htm,.pdf,text/html,application/pdf" onChange={(event) => selectFile(event.target.files?.[0])} className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />{uploadedFile && <span className="mt-1 block text-xs text-slate-500">{uploadedFile.name}</span>}</label>
      <textarea aria-label="Chapter question content" placeholder="Or paste HTML / PDF URL" className="min-h-32 rounded-xl border border-slate-200 p-3 md:col-span-2" value={form.content_data} onChange={(event) => { setUploadedFile(null); setForm({ ...form, content_data: event.target.value }); }} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_premium} onChange={(event) => setForm({ ...form, is_premium: event.target.checked })} /><Crown className="h-4 w-4 text-amber-500" /> Premium access</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish immediately</label>
      <div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">{editing ? "Save changes" : "Create question set"}</button>{editing && <button type="button" onClick={reset} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">Cancel</button>}</div>
    </form>}
  />;
}

function FlashCardsManager() {
  const [items, setItems] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", html_content: "", is_premium: false, is_published: false });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<FlashCard | null>(null);
  const load = () => { setLoading(true); setError(""); adminGetFlashCards().then(setItems).catch((value) => setError(message(value))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  function reset() {
    setEditing(null);
    setForm({ title: "", html_content: "", is_premium: false, is_published: false });
    setUploadedFile(null);
  }
  function edit(id: number) {
    const card = items.find((item) => item.id === id);
    if (!card) {
      setError("Flash card was not found. Refresh the list and try again.");
      return;
    }
    setEditing(card);
    setForm({
      title: card.title,
      html_content: card.html_content || "",
      is_premium: card.is_premium,
      is_published: card.is_published,
    });
    setUploadedFile(null);
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const html_content = uploadedFile ? await readLocalFile(uploadedFile, "html") : form.html_content;
      const payload = { ...form, html_content };
      if (editing) await adminUpdateFlashCard(editing.id, payload);
      else await adminCreateFlashCard(payload);
      reset();
      load();
    } catch (value) { setError(message(value)); }
  }
  return <ResourcePanel
    title="Game flash cards"
    subtitle="Create cards used by the freshman game."
    loading={loading}
    error={error}
    items={items.map((item) => ({ id: item.id, name: item.title, status: item.is_published ? "Published" : "Draft", is_premium: item.is_premium, is_published: item.is_published }))}
    onEdit={edit}
    onTogglePublish={(id) => adminToggleFlashCardPublish(id).then(load).catch((value) => setError(message(value)))}
    onDelete={(id) => adminDeleteFlashCard(id).then(load).catch((value) => setError(message(value)))}
    onTogglePremium={(id) => adminToggleFlashCardPremium(id).then(load).catch((value) => setError(message(value)))}
    form={<form onSubmit={save} className="space-y-3">
      <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Upload an HTML file from your device</span><input type="file" accept=".html,.htm,text/html" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />{uploadedFile && <span className="mt-1 block text-xs text-slate-500">{uploadedFile.name}</span>}</label>
      <textarea aria-label="Flash card HTML content" placeholder="Or paste flash card HTML" className="min-h-40 w-full rounded-xl border border-slate-200 p-3" value={form.html_content} onChange={(event) => { setUploadedFile(null); setForm({ ...form, html_content: event.target.value }); }} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_premium} onChange={(event) => setForm({ ...form, is_premium: event.target.checked })} /><Crown className="h-4 w-4 text-amber-500" /> Premium access</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publish to the game</label>
      <div className="flex gap-2"><button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">{editing ? "Save changes" : "Create flash card"}</button>{editing && <button type="button" onClick={reset} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">Cancel</button>}</div>
    </form>}
  />;
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
  const revenue = data?.monthly_revenue ?? 0;
  const cost = data?.monthly_operating_cost ?? 0;
  const profit = revenue - cost;
  return <div className="space-y-6">{error && <ErrorBanner error={error} />}<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Metric label="Students" value={data?.total_students ?? 0} /><Metric label="Exam attempts" value={data?.total_attempts ?? 0} /><Metric label="Active subscribers" value={data?.active_subscribers ?? 0} /><Metric label="New this month" value={data?.new_subscriptions_this_month ?? 0} /></div><div className="grid gap-4 md:grid-cols-3"><Metric label="Monthly revenue" value={new Intl.NumberFormat().format(revenue)} /><Metric label="Operating cost" value={new Intl.NumberFormat().format(cost)} /><Metric label="Estimated profit" value={new Intl.NumberFormat().format(profit)} /></div><div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">Stream distribution</h2><div className="mt-4 space-y-3">{data?.stream_distribution.map((item) => <div key={item.stream}><div className="flex justify-between text-sm"><span className="capitalize">{item.stream}</span><span>{item.students}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (item.students / Math.max(1, data.total_students)) * 100)}%` }} /></div></div>)}</div></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">Subject performance</h2><div className="mt-4 space-y-3">{data?.subject_performance.map((item) => <div key={item.subject}><div className="flex justify-between text-sm"><span>{item.subject}</span><span>{item.average_score.toFixed(1)}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, item.average_score)}%` }} /></div><p className="mt-1 text-xs text-slate-400">{item.attempts} attempts</p></div>)}</div></section></div><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">Growth and profitability</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Monthly growth</p><p className="mt-2 text-2xl font-black text-emerald-700">{data?.monthly_growth.toFixed(1) ?? "0.0"}%</p></div><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Profit margin</p><p className="mt-2 text-2xl font-black text-blue-700">{revenue ? ((profit / revenue) * 100).toFixed(1) : "0.0"}%</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">Monthly cost</p><p className="mt-2 text-2xl font-black text-amber-700">{new Intl.NumberFormat().format(cost)}</p></div></div></section></div>;
}

function PricingManager() {
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { adminGetSubscriptionConfig().then((value) => { setConfig(value); setLoading(false); }).catch((value) => { setError(message(value)); setLoading(false); }); }, []);
  async function save(event: FormEvent) { event.preventDefault(); if (!config) return; setSaving(true); setError(""); try { const saved = await adminUpdateSubscriptionConfig(config); setConfig(saved); } catch (value) { setError(message(value)); } finally { setSaving(false); } }
  if (loading) return <p className="rounded-2xl bg-white p-8 text-slate-500">Loading pricing...</p>;
  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><Settings className="h-5 w-5 text-blue-600" /><h2 className="text-xl font-black">Subscription pricing</h2></div><p className="mt-2 text-sm text-slate-500">Set the customer price and monthly operating cost used in the business report.</p>{error && <div className="mt-4"><ErrorBanner error={error} /></div>}<form onSubmit={save} className="mt-6 space-y-4"><Field label="Price per month" type="number" value={config?.price ?? 0} onChange={(value) => setConfig({ ...config!, price: Number(value) })} /><Field label="Currency" value={config?.currency ?? "USD"} onChange={(value) => setConfig({ ...config!, currency: value })} /><Field label="Monthly operating cost" type="number" value={config?.monthly_operating_cost ?? 0} onChange={(value) => setConfig({ ...config!, monthly_operating_cost: Number(value) })} /><button disabled={saving} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save pricing"}</button></form></section><section className="rounded-2xl bg-blue-600 p-6 text-white shadow-sm"><CircleDollarSign className="h-8 w-8" /><h2 className="mt-4 text-2xl font-black">Profit snapshot</h2><p className="mt-3 text-4xl font-black">{new Intl.NumberFormat().format((config?.price ?? 0) - (config?.monthly_operating_cost ?? 0))}</p><p className="mt-1 text-sm text-blue-100">Estimated monthly profit per active subscriber</p><div className="mt-6 rounded-xl bg-white/10 p-4 text-sm"><p className="font-bold">Pricing formula</p><p className="mt-2">Revenue − operating cost = estimated profit</p></div></section></div>;
}

function ResourcePanel({
  title,
  subtitle,
  loading,
  error,
  items,
  onDelete,
  onEdit,
  onTogglePremium,
  onTogglePublish,
  form,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string;
  items: { id: number; name: string; status: string; is_premium?: boolean; is_published?: boolean }[];
  onDelete?: (id: number) => void;
  onEdit?: (id: number) => void;
  onTogglePremium?: (id: number) => void;
  onTogglePublish?: (id: number) => void;
  form: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        {loading ? <p className="mt-5 text-sm text-slate-500">Loading...</p> : error ? <ErrorBanner error={error} /> : (
          <div className="mt-5 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    {item.status}
                    {item.is_premium !== undefined && (
                      <span className={`rounded-full px-2 py-0.5 font-bold ${item.is_premium ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {item.is_premium ? "Premium" : "Free"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex w-full flex-wrap justify-start gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
                  {onEdit && <button type="button" onClick={() => onEdit(item.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
                  {onTogglePublish && <button type="button" onClick={() => onTogglePublish(item.id)} className="rounded-lg bg-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700">{item.is_published ? "Unpublish" : "Publish"}</button>}
                  {onTogglePremium && <button type="button" onClick={() => onTogglePremium(item.id)} className="rounded-lg bg-violet-50 px-2.5 py-2 text-xs font-bold text-violet-700">Make {item.is_premium ? "Free" : "Premium"}</button>}
                  {onDelete && <button type="button" onClick={() => onDelete(item.id)} className="rounded-lg bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700">Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-black">Create or update</h3>
        <div className="mt-4">{form}</div>
      </section>
    </div>
  );
}

function BroadcastsManager() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    message: "",
    target_audience: "all" as "all" | "premium" | "free",
    expires_at: "",
  });

  const load = () => {
    setLoading(true);
    setError("");
    adminGetBroadcasts()
      .then(setBroadcasts)
      .catch((value) => setError(message(value)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function createBroadcast(event: FormEvent) {
    event.preventDefault();
    if (!form.message.trim()) {
      setError("Message cannot be empty.");
      return;
    }
    setError("");
    try {
      await adminCreateBroadcast({
        message: form.message,
        target_audience: form.target_audience,
        expires_at: form.expires_at || null,
      });
      setForm({ message: "", target_audience: "all", expires_at: "" });
      load();
    } catch (value) {
      setError(message(value));
    }
  }

  async function deleteBroadcast(id: number) {
    if (!confirm("Delete this broadcast?")) return;
    try {
      await adminDeleteBroadcast(id);
      load();
    } catch (value) {
      setError(message(value));
    }
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner error={error} />}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black mb-4">Create New Broadcast</h2>
        <form onSubmit={createBroadcast} className="space-y-4">
          <div>
            <label className="block mb-1 text-xs font-bold text-slate-600">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 min-h-[100px]"
              placeholder="Enter your broadcast message..."
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-bold text-slate-600">Target Audience</label>
            <select
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value as "all" | "premium" | "free" })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Users</option>
              <option value="premium">Premium Users Only</option>
              <option value="free">Free Users Only</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs font-bold text-slate-600">Expires At (Optional)</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Send Broadcast
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black mb-4">Active Broadcasts</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : broadcasts.length === 0 ? (
          <p className="text-sm text-slate-500">No active broadcasts.</p>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50"
              >
                <Megaphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{broadcast.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">
                      Target: <span className="font-semibold">{broadcast.target_audience}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      Created: {new Date(broadcast.created_at).toLocaleString()}
                    </span>
                    {broadcast.expires_at && (
                      <span className="text-xs text-slate-500">
                        Expires: {new Date(broadcast.expires_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteBroadcast(broadcast.id)}
                  className="shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
