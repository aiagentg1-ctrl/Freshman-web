"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, FileQuestion, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  adminGetExams,
  adminGetNotes,
  adminGetAnalytics,
  adminGetSubjectSuggestions,
  adminReviewSubjectSuggestion,
  getExam,
  getNote,
  getChapterExam,
  adminCreateExam,
  adminUpdateExam,
  adminDeleteExam,
  adminToggleExamPublish,
  adminCreateNote,
  adminUpdateNote,
  adminDeleteNote,
  adminCreateChapterExam,
  adminGetChapterExams,
  adminUpdateChapterExam,
  adminDeleteChapterExam,
  getNoteChapterExam,
  adminToggleNotePublish,
  adminGetUniversityLogo,
  adminPutUniversityLogo,
  type AdminExamMeta,
  type NoteMeta,
  type AdminAnalytics,
  type SubjectSuggestion,
  type ChapterExamMeta,
  type Exam,
  type Note,
  type ChapterExam,
  type ChapterExamInput,
  type UniversityLogo,
} from "@/lib/api";
import { inlineHtmlImageAssets } from "@/lib/htmlAssets";
import FlashCardManager from "@/components/tma/FlashCardManager";

const SUBJECTS = [
  { value: "physics", label: "Physics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "biology", label: "Biology" },
  { value: "mathematics", label: "Mathematics" },
  { value: "english", label: "English" },
  { value: "aptitude", label: "Aptitude" },
  { value: "civics", label: "Civics" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "economics", label: "Economics" },
];

const GRADES = [9, 10, 11, 12];
const STREAMS = [
  { value: "general", label: "General" },
  { value: "natural", label: "Natural" },
  { value: "social", label: "Social" },
];

const ADMIN_KEY_STORAGE = "mirkuzAdminKey";

type TabType = "exams" | "notes" | "upload" | "logos" | "flash-cards" | "analytics" | "suggestions";

function handleUnauthorized(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  alert("Invalid admin key. Please sign in again.");
  window.location.reload();
}

const errorMessage = (error: { detail?: unknown; error?: string }): string => {
  if (Array.isArray(error.detail)) {
    return error.detail
      .map((d) => {
        const issue = d as { loc?: (string | number)[]; msg?: string };
        const field = issue.loc?.filter((p) => p !== "body").join(".") || "input";
        return `${field}: ${issue.msg}`;
      })
      .join("; ");
  }
  return (typeof error.detail === "string" && error.detail) || error.error || "Unknown error";
};

const inputClass =
  "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent";
const labelClass = "block text-sm font-medium text-gray-700 mb-2";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("exams");
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verifyKey = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/verify", {
        headers: {
          "x-admin-key": key,
          "X-Admin-Secret": key,
          "X-Admin-Password": key,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!stored) return;
    verifyKey(stored).then((ok) => {
      if (ok) setUnlocked(true);
      else sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    });
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key || verifying) return;
    setVerifying(true);
    setKeyError("");
    const ok = await verifyKey(key);
    setVerifying(false);
    if (!ok) {
      setKeyError("Invalid admin key. Try again.");
      return;
    }
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    setUnlocked(true);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
        >
          <h1 className="text-xl font-bold text-gray-800 mb-1">Admin Access</h1>
          <p className="text-sm text-gray-500 mb-4">Enter the admin key to continue.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setKeyError("");
            }}
            className={inputClass}
            placeholder="Admin key"
            autoFocus
            required
          />
          {keyError && <p className="mt-2 text-sm font-medium text-red-600">{keyError}</p>}
          <button
            type="submit"
            disabled={verifying}
            className="mt-4 w-full bg-[#1D70F5] text-white py-3 rounded-lg font-semibold hover:bg-[#1558D0] transition-all disabled:opacity-60"
          >
            {verifying ? "Verifying..." : "Unlock Dashboard"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage EUEE exams, notes, and student analytics</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem(ADMIN_KEY_STORAGE);
              setUnlocked(false);
            }}
            className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>

        <div className="flex bg-white rounded-xl p-1 mb-6 shadow-sm overflow-x-auto">
          {[
            { id: "exams" as TabType, label: "📝 Manage Exams" },
            { id: "notes" as TabType, label: "📚 Manage Notes" },
            { id: "upload" as TabType, label: "➕ Upload Content" },
            { id: "logos" as TabType, label: "🖼️ University Logos" },
            { id: "flash-cards" as TabType, label: "🎮 Game Flash Cards" },
            { id: "analytics" as TabType, label: "📊 Analytics" },
            { id: "suggestions" as TabType, label: "📥 Subject Suggestions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-[#1D70F5] text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "exams" && <ExamsManager />}
        {activeTab === "notes" && <NotesManager />}
        {activeTab === "upload" && <ContentUploader />}
        {activeTab === "logos" && <UniversityLogoManager />}
        {activeTab === "flash-cards" && <FlashCardManager />}
        {activeTab === "analytics" && <AnalyticsView />}
        {activeTab === "suggestions" && <SubjectSuggestionsManager />}
      </div>
    </div>
  );
}

function UniversityLogoManager() {
  const [logos, setLogos] = useState<UniversityLogo[]>([]);
  const [university, setUniversity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLogos(await adminGetUniversityLogo());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load university logos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!university.trim() || !file) return;
    setSaving(true);
    setError("");
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.readAsDataURL(file);
      });
      await adminPutUniversityLogo({ university: university.trim(), data_uri: dataUri });
      setMessage("University logo saved.");
      setUniversity("");
      setFile(null);
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the logo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-3">Upload University Logo</h2>
        <form onSubmit={submit} className="space-y-4">
          <input
            value={university}
            onChange={(event) => setUniversity(event.target.value)}
            className={inputClass}
            placeholder="University name"
            required
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500"
            required
          />
          <button
            type="submit"
            disabled={saving || loading}
            className="w-full bg-[#1D70F5] text-white py-3 rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Upload Logo"}
          </button>
        </form>
        {message && <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Saved Logos</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : logos.length === 0 ? (
          <p className="text-sm text-gray-500">No university logos have been uploaded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {logos.map((logo) => (
              <div key={logo.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                <img src={logo.data_uri} alt={`${logo.university} logo`} className="h-14 w-14 rounded-lg object-contain p-1" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{logo.university}</p>
                  <p className="text-xs text-gray-500">Updated {new Date(logo.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExamsManager() {
  const [exams, setExams] = useState<AdminExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">("all");
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminExamMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadExams = async () => {
    try {
      const data = await adminGetExams();
      setExams(data);
    } catch (error) {
      console.error("Error loading exams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.year.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.custom_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "published" && exam.is_published) ||
      (filterStatus === "draft" && !exam.is_published);

    return matchesSearch && matchesStatus;
  });

  const handleTogglePublish = async (examId: number) => {
    try {
      await adminToggleExamPublish(examId);
      await loadExams();
    } catch (error) {
      console.error("Error toggling publish:", error);
      alert("Failed to toggle publish status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    const examId = deleteTarget.id;
    const previousExams = exams;
    setDeleteError(null);
    setDeleting(true);
    setExams((prev) => prev.filter((exam) => exam.id !== examId));
    try {
      await adminDeleteExam(examId);
      setDeleteTarget(null);
      setStatusMessage("Exam deleted successfully.");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error) {
      console.error("Error deleting exam:", error);
      setExams(previousExams);
      setDeleteError(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (exam: Exam) => {
    try {
      const updated = await adminUpdateExam(exam.id, exam);
      setExams((prev) => prev.map((item) => (item.id === exam.id ? { ...item, ...updated } : item)));
      setEditingExam(null);
      setStatusMessage("Exam updated successfully.");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error) {
      console.error("Error updating exam:", error);
      alert("Failed to update exam");
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Loading exams...</div>;
  }

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {statusMessage}
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by subject, year, tag, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1D70F5]"
          />
          <div className="flex gap-2">
            {(["all", "published", "draft"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium capitalize ${
                  filterStatus === status
                    ? "bg-[#1D70F5] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subject & Tag</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Year</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Format</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Attempts</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{exam.title}</div>
                    <div className="text-sm text-gray-500">{exam.custom_tag || "No tag"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{exam.year}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {exam.duration_minutes}m • {exam.question_count} Qs
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        exam.content_type === "html"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {exam.content_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        exam.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {exam.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{exam.attempt_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            setEditingExam(await getExam(exam.id));
                          } catch (error) {
                            console.error("Error loading exam for edit:", error);
                            alert("Failed to load exam content");
                          }
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleTogglePublish(exam.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Toggle Status"
                      >
                        🔁
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(exam);
                        }}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        aria-label={`Delete ${exam.title}`}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                      <a
                        href={`/tma?exam=${exam.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Preview"
                      >
                        👁️
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredExams.length === 0 && (
          <div className="p-8 text-center text-gray-500">No exams found</div>
        )}
      </div>

      {editingExam && (
        <EditExamModal
          exam={editingExam}
          onSave={handleSaveEdit}
          onCancel={() => setEditingExam(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          itemType="exam"
          title={deleteTarget.title}
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function NotesManager() {
  const [activeSection, setActiveSection] = useState<"notes" | "questions">("notes");
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingChapterExam, setEditingChapterExam] = useState<ChapterExam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadNotes = async () => {
    try {
      const data = await adminGetNotes();
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  if (activeSection === "questions") {
    return (
      <div className="space-y-4">
        <AdminNotesTabs activeSection={activeSection} onChange={setActiveSection} />
        <ChapterQuestionsManager />
      </div>
    );
  }

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGrade = filterGrade === "all" || note.grade === filterGrade;

    return matchesSearch && matchesGrade;
  });

  const handleTogglePublish = async (noteId: number) => {
    try {
      await adminToggleNotePublish(noteId);
      await loadNotes();
    } catch (error) {
      console.error("Error toggling publish:", error);
      alert("Failed to toggle publish status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    const noteId = deleteTarget.id;
    const previousNotes = notes;
    setDeleteError(null);
    setDeleting(true);
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
    try {
      await adminDeleteNote(noteId);
      setDeleteTarget(null);
      setStatusMessage("Note deleted successfully.");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error) {
      console.error("Error deleting note:", error);
      setNotes(previousNotes);
      setDeleteError(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (note: Note, chapterData: {
    enabled: boolean;
    title: string;
    question_count: number;
    content_data: string;
  } | null) => {
    try {
      await adminUpdateNote(note.id, note);
      if (chapterData) {
        const payload = {
          note_id: note.id,
          title: chapterData.title,
          question_count: chapterData.question_count,
          content_type: "html" as const,
          content_data: chapterData.content_data,
          is_premium: note.is_premium,
          is_published: note.is_published,
        };
        if (editingChapterExam) {
          await adminUpdateChapterExam(editingChapterExam.id, payload);
        } else {
          await adminCreateChapterExam(payload);
        }
      } else if (editingChapterExam) {
        await adminDeleteChapterExam(editingChapterExam.id);
      }
      await loadNotes();
      setEditingNote(null);
      setEditingChapterExam(null);
      setStatusMessage("Note and chapter questions saved.");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error) {
      console.error("Error updating note:", error);
      alert(error instanceof Error ? error.message : "Failed to update note and chapter questions");
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <AdminNotesTabs activeSection={activeSection} onChange={setActiveSection} />
      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {statusMessage}
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by subject or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1D70F5]"
          />
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1D70F5]"
          >
            <option value="all">All Grades</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subject</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Grade</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stream</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Chapter</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((note) => (
                <tr key={note.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{note.title}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{note.subject}</td>
                  <td className="px-4 py-3 text-gray-700">Grade {note.grade}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{note.stream || "N/A"}</td>
                  <td className="px-4 py-3 text-gray-700">{note.chapter_number}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        note.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {note.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const noteData = await getNote(note.id);
                            const chapterMeta = await getNoteChapterExam(note.id);
                            const chapterData = chapterMeta ? await getChapterExam(chapterMeta.id) : null;
                            setEditingNote(noteData);
                            setEditingChapterExam(chapterData);
                          } catch (error) {
                            console.error("Error loading note for edit:", error);
                            alert("Failed to load note content");
                          }
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleTogglePublish(note.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Toggle Status"
                      >
                        🔁
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(note);
                        }}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        aria-label={`Delete ${note.title}`}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                      <a
                        href={`/tma?note=${note.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Preview"
                      >
                        👁️
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredNotes.length === 0 && (
          <div className="p-8 text-center text-gray-500">No notes found</div>
        )}
      </div>

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          chapterExam={editingChapterExam}
          onSave={handleSaveEdit}
          onCancel={() => {
            setEditingNote(null);
            setEditingChapterExam(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          itemType="note"
          title={deleteTarget.title}
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function AdminNotesTabs({
  activeSection,
  onChange,
}: {
  activeSection: "notes" | "questions";
  onChange: (section: "notes" | "questions") => void;
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {([
        { key: "notes", label: "Notes" },
        { key: "questions", label: "Chapter Questions" },
      ] as const).map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            activeSection === tab.key
              ? "border-[#1D70F5] text-[#1D70F5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ChapterQuestionsManager() {
  const [chapterExams, setChapterExams] = useState<ChapterExamMeta[]>([]);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [editingExam, setEditingExam] = useState<ChapterExam | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const loadData = async () => {
    setError("");
    try {
      const [examData, noteData] = await Promise.all([adminGetChapterExams(), adminGetNotes()]);
      setChapterExams(examData);
      setNotes(noteData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load chapter questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveExam = async (input: ChapterExamInput) => {
    setSaving(true);
    try {
      if (editingExam) {
        await adminUpdateChapterExam(editingExam.id, input);
      } else {
        await adminCreateChapterExam(input);
      }
      setEditorOpen(false);
      setEditingExam(null);
      setStatusMessage(editingExam ? "Chapter questions updated." : "Chapter questions added.");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save chapter questions.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExam = async (exam: ChapterExamMeta) => {
    if (!window.confirm(`Delete "${exam.title}" and its saved attempts?`)) return;
    setError("");
    try {
      await adminDeleteChapterExam(exam.id);
      setStatusMessage("Chapter question set deleted.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete chapter questions.");
    }
  };

  const noteTitles = new Map(notes.map((note) => [note.id, note.title]));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-slate-900">Chapter question sets</h2>
          <p className="mt-1 text-sm text-slate-500">Upload, edit, or remove practice sets, with or without a linked note.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingExam(null);
            setEditorOpen(true);
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1D70F5] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add question set
        </button>
      </div>

      {statusMessage && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Loading chapter questions...</div>
      ) : chapterExams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <FileQuestion className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-semibold text-slate-800">No chapter questions yet</p>
          <p className="mt-1 text-sm text-slate-500">Add a set now; a note is optional.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px]">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Question set</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Subject / Grade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Chapter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Note link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {chapterExams.map((exam) => (
                <tr key={exam.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{exam.title}</p>
                    <p className="text-xs text-slate-500">{exam.question_count} questions</p>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-slate-700">{exam.subject} · Grade {exam.grade}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{exam.chapter_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {exam.note_id ? noteTitles.get(exam.note_id) || "Linked note" : "Standalone"}
                  </td>
                  <td className="px-4 py-3 text-sm">{exam.is_published ? "Published" : "Draft"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        title="Edit question set"
                        aria-label={`Edit ${exam.title}`}
                        onClick={async () => {
                          try {
                            setEditingExam(await getChapterExam(exam.id));
                            setEditorOpen(true);
                          } catch (loadError) {
                            setError(loadError instanceof Error ? loadError.message : "Could not load this question set.");
                          }
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete question set"
                        aria-label={`Delete ${exam.title}`}
                        onClick={() => void deleteExam(exam)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <ChapterExamEditorModal
          exam={editingExam}
          notes={notes}
          busy={saving}
          onSave={saveExam}
          onCancel={() => {
            if (!saving) {
              setEditorOpen(false);
              setEditingExam(null);
            }
          }}
        />
      )}
    </section>
  );
}

function ChapterExamEditorModal({
  exam,
  notes,
  busy,
  onSave,
  onCancel,
}: {
  exam: ChapterExam | null;
  notes: NoteMeta[];
  busy: boolean;
  onSave: (input: ChapterExamInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [noteId, setNoteId] = useState(exam?.note_id ? String(exam.note_id) : "");
  const [formData, setFormData] = useState({
    subject: exam?.subject || SUBJECTS[0].value,
    grade: String(exam?.grade || 9),
    stream: exam?.stream || "general",
    chapterNumber: String(exam?.chapter_number || 1),
    title: exam?.title || "",
    questionCount: String(exam?.question_count || ""),
    content: exam?.content_data || "",
    isPremium: exam?.is_premium || false,
    isPublished: exam?.is_published ?? true,
  });
  const [imageAssets, setImageAssets] = useState<File[]>([]);

  const linkedNote = notes.find((note) => note.id === Number(noteId));
  const grade = Number(formData.grade);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormData((previous) => ({ ...previous, content: String(reader.result || "") }));
    reader.readAsText(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onSave({
        note_id: noteId ? Number(noteId) : null,
        subject: linkedNote?.subject || formData.subject,
        grade: linkedNote?.grade || grade,
        stream: linkedNote?.stream ?? (grade < 11 ? "general" : formData.stream),
        chapter_number: linkedNote?.chapter_number || Number(formData.chapterNumber),
        title: formData.title.trim(),
        question_count: Number(formData.questionCount),
        content_type: "html",
        content_data: await inlineHtmlImageAssets(formData.content, imageAssets),
        is_premium: formData.isPremium,
        is_published: formData.isPublished,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not prepare question images.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{exam ? "Edit chapter questions" : "Add chapter questions"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={labelClass}>Link to a note (optional)</label>
            <select
              value={noteId}
              onChange={(event) => {
                const nextId = event.target.value;
                setNoteId(nextId);
                const nextNote = notes.find((item) => item.id === Number(nextId));
                if (nextNote) {
                  setFormData((previous) => ({
                    ...previous,
                    subject: nextNote.subject,
                    grade: String(nextNote.grade),
                    stream: nextNote.stream || "general",
                    chapterNumber: String(nextNote.chapter_number),
                  }));
                }
              }}
              className={inputClass}
            >
              <option value="">Standalone question set</option>
              {notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title} · {note.subject} · Grade {note.grade} · Chapter {note.chapter_number}
                </option>
              ))}
            </select>
          </div>

          {linkedNote ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {linkedNote.subject} · Grade {linkedNote.grade} · Chapter {linkedNote.chapter_number}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Subject</label>
                <select
                  value={formData.subject}
                  onChange={(event) => setFormData((previous) => ({ ...previous, subject: event.target.value }))}
                  className={inputClass}
                  required
                >
                  {SUBJECTS.map((subject) => <option key={subject.value} value={subject.value}>{subject.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Grade</label>
                <select
                  value={formData.grade}
                  onChange={(event) => setFormData((previous) => ({ ...previous, grade: event.target.value }))}
                  className={inputClass}
                  required
                >
                  {GRADES.map((item) => <option key={item} value={item}>Grade {item}</option>)}
                </select>
              </div>
              {grade >= 11 && (
                <div>
                  <label className={labelClass}>Stream</label>
                  <select
                    value={formData.stream}
                    onChange={(event) => setFormData((previous) => ({ ...previous, stream: event.target.value }))}
                    className={inputClass}
                    required
                  >
                    {STREAMS.filter((item) => item.value !== "general").map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass}>Chapter number</label>
                <input
                  type="number"
                  min={1}
                  value={formData.chapterNumber}
                  onChange={(event) => setFormData((previous) => ({ ...previous, chapterNumber: event.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Question set title</label>
              <input
                value={formData.title}
                onChange={(event) => setFormData((previous) => ({ ...previous, title: event.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Question count</label>
              <input
                type="number"
                min={1}
                max={200}
                value={formData.questionCount}
                onChange={(event) => setFormData((previous) => ({ ...previous, questionCount: event.target.value }))}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Upload HTML/JSON or paste content</label>
            <input
              type="file"
              accept=".html,.htm,.json,text/html,application/json"
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
            />
            <label className={`${labelClass} mt-2`}>Images referenced by this HTML</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setImageAssets(Array.from(event.target.files || []))}
              className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
            />
            <textarea
              value={formData.content}
              onChange={(event) => setFormData((previous) => ({ ...previous, content: event.target.value }))}
              rows={12}
              className={`${inputClass} font-mono text-sm`}
              placeholder='Question HTML or JSON, e.g. {"questions":[...]}'
              required
            />
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formData.isPremium} onChange={(event) => setFormData((previous) => ({ ...previous, isPremium: event.target.checked }))} /> Premium
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formData.isPublished} onChange={(event) => setFormData((previous) => ({ ...previous, isPublished: event.target.checked }))} /> Published
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onCancel} disabled={busy} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-[#1D70F5] px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Saving..." : "Save question set"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SubjectSuggestionsManager() {
  const [suggestions, setSuggestions] = useState<SubjectSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const loadSuggestions = async () => {
    try {
      setSuggestions(await adminGetSubjectSuggestions());
    } catch (error) {
      console.error("Error loading subject suggestions:", error);
      setMessage("Failed to load subject suggestions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const reviewSuggestion = async (suggestionId: number, status: "approved" | "rejected") => {
    if (reviewingId !== null) return;
    setReviewingId(suggestionId);
    setMessage(null);
    try {
      await adminReviewSubjectSuggestion(suggestionId, status);
      setSuggestions((current) => current.map((item) => item.id === suggestionId ? { ...item, status, reviewed_at: new Date().toISOString(), reviewed_by: "admin" } : item));
      setMessage(`Suggestion ${status}.`);
    } catch (error) {
      console.error("Error reviewing subject suggestion:", error);
      setMessage("Failed to review the suggestion.");
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Loading suggestions...</div>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          {message}
        </div>
      )}
      {suggestions.length === 0 ? (
        <div className="bg-white rounded-xl p-6 text-center shadow-sm text-gray-500">No subject suggestions are awaiting review.</div>
      ) : suggestions.map((suggestion) => (
        <article key={suggestion.id} className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{suggestion.stream}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${suggestion.status === "pending" ? "bg-amber-50 text-amber-700" : suggestion.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {suggestion.status}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{suggestion.subject_name}</h3>
              <p className="mt-1 text-sm text-slate-500">Requested by user {suggestion.user_id}</p>
              {suggestion.reason && <p className="mt-3 text-sm text-slate-600">Reason: {suggestion.reason}</p>}
              <p className="mt-2 text-xs text-slate-400">{new Date(suggestion.created_at).toLocaleString()}</p>
            </div>
            {suggestion.status === "pending" && (
              <div className="flex gap-2 sm:flex-col">
                <button
                  type="button"
                  onClick={() => reviewSuggestion(suggestion.id, "approved")}
                  disabled={reviewingId !== null}
                  className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reviewSuggestion(suggestion.id, "rejected")}
                  disabled={reviewingId !== null}
                  className="min-h-10 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function ContentUploader() {
  const [uploadType, setUploadType] = useState<"exam" | "note">("exam");

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setUploadType("exam")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            uploadType === "exam" ? "bg-[#1D70F5] text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Upload EUEE Exam
        </button>
        <button
          onClick={() => setUploadType("note")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            uploadType === "note" ? "bg-[#1D70F5] text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Upload Grade Notes
        </button>
      </div>

      {uploadType === "exam" ? <ExamUploader /> : <NotesUploader />}
    </div>
  );
}

function AnalyticsView() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      const data = await adminGetAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Failed to load analytics</div>;
  }

  const largestGradeCount = Math.max(1, ...analytics.grade_distribution.map((item) => item.students));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold text-[#1D70F5]">{analytics.total_students}</div>
          <div className="text-gray-600 mt-1">Total Students</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold text-[#1D70F5]">{analytics.total_attempts}</div>
          <div className="text-gray-600 mt-1">Total Exam Attempts</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold text-[#1D70F5]">{analytics.avg_score}%</div>
          <div className="text-gray-600 mt-1">Average Score</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold text-[#1D70F5]">{analytics.active_students_7d}</div>
          <div className="text-gray-600 mt-1">Active Students · 7 Days</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Students by grade</h2>
          <div className="mt-4 space-y-3">
            {analytics.grade_distribution.map((item) => (
              <div key={item.grade}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">Grade {item.grade}</span>
                  <span className="font-semibold text-slate-900">{item.students}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1D70F5]" style={{ width: `${(item.students / largestGradeCount) * 100}%` }} />
                </div>
              </div>
            ))}
            {analytics.grade_distribution.length === 0 && <p className="text-sm text-slate-500">No student profiles yet.</p>}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm">
            {analytics.stream_distribution.map((item) => (
              <span key={item.stream} className="capitalize text-slate-600">{item.stream}: <strong className="text-slate-900">{item.students}</strong></span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Subject performance</h2>
          <div className="mt-4 space-y-3">
            {analytics.subject_performance.map((item) => (
              <div key={item.subject}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="truncate capitalize text-slate-600">{item.subject} <span className="text-xs text-slate-400">· {item.attempts} attempts</span></span>
                  <span className="font-semibold text-slate-900">{item.average_score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, item.average_score))}%` }} />
                </div>
              </div>
            ))}
            {analytics.subject_performance.length === 0 && <p className="text-sm text-slate-500">No scored attempts yet.</p>}
          </div>
        </section>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">Recent Exam Attempts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Exam</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Completed</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recent_attempts.map((attempt) => (
                <tr key={attempt.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{attempt.user_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{attempt.exam_title}</div>
                    <div className="text-sm text-gray-500 capitalize">{attempt.exam_subject}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {attempt.score !== null ? `${attempt.score}%` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {attempt.time_spent ? `${Math.floor(attempt.time_spent / 60)}m` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {attempt.completed_at
                      ? new Date(attempt.completed_at).toLocaleDateString()
                      : "In progress"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analytics.recent_attempts.length === 0 && (
          <div className="p-8 text-center text-gray-500">No recent attempts</div>
        )}
      </div>
    </div>
  );
}

function SubjectSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Subject</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        required
      >
        <option value="">Select a subject</option>
        {SUBJECTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExamUploader() {
  const [formData, setFormData] = useState({
    subject: "",
    year: "",
    university: "",
    examType: "final" as "final" | "mid",
    customTag: "",
    questionCount: "",
    durationMinutes: "",
    isPremium: false,
    isPublished: true,
    format: "html" as "html" | "pdf",
    htmlContent: "",
    imageAssets: [] as File[],
    pdfUrl: "",
    pdfDataUri: "",
    pdfFileName: "",
  });

  const resetForm = () =>
    setFormData({
      subject: "",
      year: "",
      university: "",
      examType: "final",
      customTag: "",
      questionCount: "",
      durationMinutes: "",
      isPremium: false,
      isPublished: true,
      format: "html",
      htmlContent: "",
      imageAssets: [],
      pdfUrl: "",
      pdfDataUri: "",
      pdfFileName: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawContentData =
      formData.format === "pdf" ? formData.pdfDataUri || formData.pdfUrl.trim() : formData.htmlContent;
    if (!rawContentData) {
      alert(formData.format === "pdf" ? "Provide a PDF file or link." : "Paste or upload the exam HTML.");
      return;
    }
    try {
      const contentData = formData.format === "html"
        ? await inlineHtmlImageAssets(rawContentData, formData.imageAssets)
        : rawContentData;
      await adminCreateExam({
        subject: formData.subject,
        year: formData.year,
        title: `${formData.subject.charAt(0).toUpperCase() + formData.subject.slice(1)} EUEE ${formData.year}`,
        university: formData.university,
        custom_tag: formData.customTag,
        question_count: parseInt(formData.questionCount),
        duration_minutes: parseInt(formData.durationMinutes),
        content_type: formData.format,
        exam_type: formData.examType,
        content_data: contentData,
        is_premium: formData.isPremium,
        is_published: formData.isPublished,
      });
      alert("EUEE exam uploaded successfully!");
      resetForm();
    } catch (error) {
      console.error("Error uploading exam:", error);
      alert("Error uploading exam");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SubjectSelect
        value={formData.subject}
        onChange={(v) => setFormData({ ...formData, subject: v })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Exam Year</label>
          <input
            type="text"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            className={inputClass}
            placeholder="e.g. 2026, 2025, 2016 E.C."
            required
          />
        </div>
        <div>
          <label className={labelClass}>University</label>
          <input
            type="text"
            value={formData.university}
            onChange={(e) => setFormData({ ...formData, university: e.target.value })}
            className={inputClass}
            placeholder="Exact university name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Exam Type</label>
          <select
            value={formData.examType}
            onChange={(e) => setFormData({ ...formData, examType: e.target.value as "final" | "mid" })}
            className={inputClass}
          >
            <option value="final">Final Exam</option>
            <option value="mid">Mid Exam</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Custom Tag</label>
          <input
            type="text"
            value={formData.customTag}
            onChange={(e) => setFormData({ ...formData, customTag: e.target.value })}
            className={inputClass}
            placeholder='e.g. "Pilot Exam", "EUEE Model"'
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Total Questions</label>
          <input
            type="number"
            min={1}
            value={formData.questionCount}
            onChange={(e) => setFormData({ ...formData, questionCount: e.target.value })}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Time Limit (minutes)</label>
          <input
            type="number"
            min={1}
            value={formData.durationMinutes}
            onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <input
            type="checkbox"
            checked={formData.isPremium}
            onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
            className="w-4 h-4 accent-[#1D70F5]"
          />
          <span className="text-sm font-semibold text-amber-800">Premium exam</span>
        </label>
        <label className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="w-4 h-4 accent-[#1D70F5]"
          />
          <span className="text-sm font-semibold text-green-800">Publish immediately</span>
        </label>
      </div>

      <div>
        <label className={labelClass}>Exam Format</label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "html", label: "HTML Exam File / Code" },
              { value: "pdf", label: "PDF File / Link" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer text-sm font-semibold ${
                formData.format === opt.value
                  ? "border-[#1D70F5] bg-blue-50/60 text-[#1D70F5]"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <input
                type="radio"
                name="examFormat"
                value={opt.value}
                checked={formData.format === opt.value}
                onChange={() => setFormData({ ...formData, format: opt.value })}
                className="accent-[#1D70F5]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {formData.format === "html" ? (
        <div>
          <label className={labelClass}>HTML Exam Code</label>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () =>
                setFormData((prev) => ({ ...prev, htmlContent: String(reader.result || "") }));
              reader.readAsText(file);
            }}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1D70F5] mb-2"
          />
          <label className={`${labelClass} mt-2`}>Images referenced by this HTML</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFormData((previous) => ({ ...previous, imageAssets: Array.from(event.target.files || []) }))}
            className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
          />
          <textarea
            value={formData.htmlContent}
            onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
            rows={10}
            className={`${inputClass} font-mono text-sm`}
            placeholder="Paste the full interactive exam HTML..."
            required
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>PDF File Upload</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () =>
                  setFormData((prev) => ({
                    ...prev,
                    pdfDataUri: String(reader.result || ""),
                    pdfFileName: file.name,
                  }));
                reader.readAsDataURL(file);
              }}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1D70F5]"
            />
            {formData.pdfFileName && (
              <p className="text-xs text-emerald-600 mt-1 font-medium">✓ {formData.pdfFileName} attached</p>
            )}
          </div>
          <div>
            <label className={labelClass}>…or PDF Link</label>
            <input
              type="url"
              value={formData.pdfUrl}
              onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
              className={inputClass}
              placeholder="https://example.com/exam-2025.pdf"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-[#1D70F5] text-white py-3 rounded-lg font-semibold hover:bg-[#1558D0] transition-all"
      >
        Upload Exam
      </button>
    </form>
  );
}

function NotesUploader() {
  const [formData, setFormData] = useState({
    subject: "",
    grade: "",
    stream: "",
    chapterNumber: "",
    title: "",
    isPremium: false,
    isPublished: true,
    htmlContent: "",
    addChapterExam: false,
    chapterQuestionSets: [{ title: "", questionCount: "", content: "", imageAssets: [] as File[] }],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const questionSets = formData.chapterQuestionSets.filter((set) => set.content.trim());
    if (formData.addChapterExam && questionSets.length === 0) {
      alert("Upload or paste at least one chapter question set.");
      return;
    }
    if (formData.addChapterExam && questionSets.some((set) => !set.questionCount || Number(set.questionCount) < 1)) {
      alert("Enter a valid question count for every chapter question set.");
      return;
    }

    try {
      const note = await adminCreateNote({
        subject: formData.subject,
        grade: parseInt(formData.grade),
        stream: formData.stream || null,
        chapter_number: parseInt(formData.chapterNumber),
        title: formData.title,
        html_content: formData.htmlContent,
        is_premium: formData.isPremium,
        is_published: formData.isPublished,
      });
      if (formData.addChapterExam) {
        for (const [index, set] of questionSets.entries()) {
          await adminCreateChapterExam({
            note_id: note.id,
            title: set.title.trim() || `${formData.title} EUEE Questions ${index + 1}`,
            question_count: parseInt(set.questionCount, 10),
            content_type: "html",
            content_data: await inlineHtmlImageAssets(set.content, set.imageAssets),
            is_premium: formData.isPremium,
            is_published: formData.isPublished,
          });
        }
      }
      alert("Notes uploaded successfully!");
      setFormData({
        subject: "",
        grade: "",
        stream: "",
        chapterNumber: "",
        title: "",
        isPremium: false,
        isPublished: true,
        htmlContent: "",
        addChapterExam: false,
        chapterQuestionSets: [{ title: "", questionCount: "", content: "", imageAssets: [] }],
      });
    } catch (error) {
      console.error("Error uploading notes:", error);
      const errorMsg = errorMessage(error as { detail?: unknown; error?: string });
      alert(`Error uploading notes: ${errorMsg}`);
    }
  };

  const grade = parseInt(formData.grade);
  const showStream = grade === 11 || grade === 12;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SubjectSelect
        value={formData.subject}
        onChange={(v) => setFormData({ ...formData, subject: v })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Grade</label>
          <select
            value={formData.grade}
            onChange={(e) => {
              setFormData({ ...formData, grade: e.target.value, stream: "" });
            }}
            className={inputClass}
            required
          >
            <option value="">Select grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </div>
        {showStream && (
          <div>
            <label className={labelClass}>Stream</label>
            <select
              value={formData.stream}
              onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Select stream</option>
              {STREAMS.filter((s) => s.value !== "general").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Chapter Number</label>
          <input
            type="number"
            min={1}
            value={formData.chapterNumber}
            onChange={(e) => setFormData({ ...formData, chapterNumber: e.target.value })}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Chapter Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={inputClass}
            placeholder="e.g. Vectors and Motion"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <input
            type="checkbox"
            checked={formData.isPremium}
            onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
            className="w-4 h-4 accent-[#1D70F5]"
          />
          <span className="text-sm font-semibold text-amber-800">Premium chapter</span>
        </label>
        <label className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="w-4 h-4 accent-[#1D70F5]"
          />
          <span className="text-sm font-semibold text-green-800">Publish immediately</span>
        </label>
      </div>

      <div>
        <label className={labelClass}>HTML Notes Body</label>
        <input
          type="file"
          accept=".html,.htm,text/html"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setFormData((prev) => ({ ...prev, htmlContent: String(reader.result || "") }));
            reader.readAsText(file);
          }}
          className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
        />
        <textarea
          value={formData.htmlContent}
          onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
          rows={12}
          className={`${inputClass} font-mono text-sm`}
          placeholder="<h3>1.1 Introduction</h3>&#10;<p>Notes content...</p>"
          required
        />
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.addChapterExam}
            onChange={(e) => setFormData({ ...formData, addChapterExam: e.target.checked })}
            className="h-4 w-4 accent-[#1D70F5]"
          />
          <span className="text-sm font-semibold text-slate-800">Add untimed chapter questions</span>
        </label>
        {formData.addChapterExam && (
          <>
            {formData.chapterQuestionSets.map((set, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Question set {index + 1}</span>
                  {formData.chapterQuestionSets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({
                        ...prev,
                        chapterQuestionSets: prev.chapterQuestionSets.filter((_, setIndex) => setIndex !== index),
                      }))}
                      className="text-xs font-medium text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={set.title}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    chapterQuestionSets: prev.chapterQuestionSets.map((item, setIndex) =>
                      setIndex === index ? { ...item, title: e.target.value } : item
                    ),
                  }))}
                  className={inputClass}
                  placeholder="Question set title"
                />
                <input
                  type="number"
                  min={1}
                  value={set.questionCount}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    chapterQuestionSets: prev.chapterQuestionSets.map((item, setIndex) =>
                      setIndex === index ? { ...item, questionCount: e.target.value } : item
                    ),
                  }))}
                  className={inputClass}
                  placeholder="Number of questions"
                  required
                />
                <input
                  type="file"
                  accept=".html,.htm,.json,text/html,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setFormData((prev) => ({
                      ...prev,
                      chapterQuestionSets: prev.chapterQuestionSets.map((item, setIndex) =>
                        setIndex === index ? { ...item, content: String(reader.result || "") } : item
                      ),
                    }));
                    reader.readAsText(file);
                  }}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
                />
                <label className={`${labelClass} mt-2`}>Images referenced by this question set</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    chapterQuestionSets: prev.chapterQuestionSets.map((item, setIndex) =>
                      setIndex === index ? { ...item, imageAssets: Array.from(e.target.files || []) } : item
                    ),
                  }))}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
                />
                <textarea
                  value={set.content}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    chapterQuestionSets: prev.chapterQuestionSets.map((item, setIndex) =>
                      setIndex === index ? { ...item, content: e.target.value } : item
                    ),
                  }))}
                  rows={8}
                  className={`${inputClass} font-mono text-sm`}
                  placeholder='Upload a file or paste question HTML/JSON, for example: {"questions":[...]}'
                  required
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFormData((prev) => ({
                ...prev,
                chapterQuestionSets: [...prev.chapterQuestionSets, { title: "", questionCount: "", content: "", imageAssets: [] }],
              }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Add another question set
            </button>
          </>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-[#1D70F5] text-white py-3 rounded-lg font-semibold hover:bg-[#1558D0] transition-all"
      >
        Upload Notes
      </button>
    </form>
  );
}

function DeleteConfirmDialog({
  itemType,
  title,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  itemType: "exam" | "note";
  title: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isExam = itemType === "exam";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 pointer-events-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-dialog-title" className="text-lg font-bold text-slate-900">
              Delete this {itemType}?
            </h2>
            <p className="mt-1 break-words text-sm font-semibold text-slate-700">{title}</p>
            <p id="delete-dialog-description" className="mt-2 text-sm leading-relaxed text-slate-600">
              {isExam
                ? "This permanently deletes the exam and its saved student attempts. This cannot be undone."
                : "This permanently deletes this note. This cannot be undone."}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Delete failed: {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
              </span>
            ) : (
              `Delete ${itemType}`
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function EditExamModal({
  exam,
  onSave,
  onCancel,
}: {
  exam: Exam;
  onSave: (exam: Exam) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    subject: exam.subject,
    year: exam.year,
    title: exam.title,
    university: exam.university,
    custom_tag: exam.custom_tag,
    question_count: exam.question_count,
    duration_minutes: exam.duration_minutes,
    content_type: exam.content_type,
    exam_type: exam.exam_type,
    content_data: exam.content_data,
    is_premium: exam.is_premium,
    is_published: exam.is_published,
  });
  const [imageAssets, setImageAssets] = useState<File[]>([]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setFormData((prev) => ({
        ...prev,
        content_type: isPdf ? "pdf" : "html",
        content_data: result,
      }));
    };
    if (isPdf) reader.readAsDataURL(file); else reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSave({
        ...exam,
        ...formData,
        content_data: formData.content_type === "html"
          ? await inlineHtmlImageAssets(formData.content_data, imageAssets)
          : formData.content_data,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not prepare exam images.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pointer-events-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Exam</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Year</label>
              <input
                type="text"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Custom Tag</label>
              <input
                type="text"
                value={formData.custom_tag}
                onChange={(e) => setFormData({ ...formData, custom_tag: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>University</label>
              <input
                type="text"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Exam Type</label>
              <select
                value={formData.exam_type}
                onChange={(e) => setFormData({ ...formData, exam_type: e.target.value as "final" | "mid" })}
                className={inputClass}
              >
                <option value="final">Final Exam</option>
                <option value="mid">Mid Exam</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Questions</label>
              <input
                type="number"
                value={formData.question_count}
                onChange={(e) => setFormData({ ...formData, question_count: parseInt(e.target.value) })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Duration (min)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Content Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(["html", "pdf"] as const).map((value) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    formData.content_type === value ? "border-[#1D70F5] bg-blue-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-content-type"
                    checked={formData.content_type === value}
                    onChange={() => setFormData({ ...formData, content_type: value })}
                  />
                  <span className="text-sm font-medium text-slate-700">{value.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Replace file or paste content</label>
            <input
              type="file"
              accept=".html,.htm,text/html,.pdf,application/pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1D70F5]"
            />
            {formData.content_type === "html" && (
              <>
                <label className={`${labelClass} mt-2`}>Images referenced by this HTML</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setImageAssets(Array.from(event.target.files || []))}
                  className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
                />
              </>
            )}
          </div>

          <div>
            <label className={labelClass}>Content Data</label>
            <textarea
              value={formData.content_data}
              onChange={(e) => setFormData({ ...formData, content_data: e.target.value })}
              rows={8}
              className={`${inputClass} font-mono text-sm`}
              required
            />
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_premium}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
              />
              Premium
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              />
              Published
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-[#1D70F5] text-white py-3 rounded-lg font-semibold hover:bg-[#1558D0]"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditNoteModal({
  note,
  chapterExam,
  onSave,
  onCancel,
}: {
  note: Note;
  chapterExam: ChapterExam | null;
  onSave: (note: Note, chapterData: {
    enabled: boolean;
    title: string;
    question_count: number;
    content_data: string;
  } | null) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    subject: note.subject,
    grade: note.grade,
    stream: note.stream,
    chapter_number: note.chapter_number,
    title: note.title,
    html_content: note.html_content,
    is_premium: note.is_premium,
    is_published: note.is_published,
  });
  const [includeChapterExam, setIncludeChapterExam] = useState(!!chapterExam);
  const [chapterExamTitle, setChapterExamTitle] = useState(chapterExam?.title || `${note.title} EUEE Questions`);
  const [chapterQuestionCount, setChapterQuestionCount] = useState(String(chapterExam?.question_count || ""));
  const [chapterExamContent, setChapterExamContent] = useState(chapterExam?.content_data || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      { ...note, ...formData },
      includeChapterExam
        ? {
            enabled: true,
            title: chapterExamTitle.trim(),
            question_count: parseInt(chapterQuestionCount, 10),
            content_data: chapterExamContent,
          }
        : null
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pointer-events-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Note</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Grade</label>
              <input
                type="number"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Chapter</label>
              <input
                type="number"
                value={formData.chapter_number}
                onChange={(e) => setFormData({ ...formData, chapter_number: parseInt(e.target.value) })}
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>HTML Content</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setFormData((previous) => ({
                  ...previous,
                  html_content: String(reader.result || ""),
                }));
                reader.readAsText(file);
              }}
              className="mb-2 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#1D70F5]"
            />
            <textarea
              value={formData.html_content}
              onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
              rows={8}
              className={`${inputClass} font-mono text-sm`}
              required
            />
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeChapterExam}
                onChange={(event) => setIncludeChapterExam(event.target.checked)}
                className="h-4 w-4 accent-[#1D70F5]"
              />
              <span className="text-sm font-semibold text-slate-800">Chapter questions {chapterExam ? "attached" : "(optional)"}</span>
            </label>
            {includeChapterExam && (
              <>
                <input
                  type="text"
                  value={chapterExamTitle}
                  onChange={(event) => setChapterExamTitle(event.target.value)}
                  className={inputClass}
                  placeholder="Chapter test title"
                />
                <input
                  type="number"
                  min={1}
                  value={chapterQuestionCount}
                  onChange={(event) => setChapterQuestionCount(event.target.value)}
                  className={inputClass}
                  placeholder="Number of questions"
                />
                <textarea
                  value={chapterExamContent}
                  onChange={(event) => setChapterExamContent(event.target.value)}
                  rows={8}
                  className={`${inputClass} font-mono text-sm`}
                  placeholder='Question HTML or JSON, for example: {"questions":[...]}'
                />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_premium}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
              />
              Premium
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              />
              Published
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-[#1D70F5] text-white py-3 rounded-lg font-semibold hover:bg-[#1558D0]"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
