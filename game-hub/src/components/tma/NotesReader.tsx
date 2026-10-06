"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, FileQuestion, Maximize2, Minimize2 } from "lucide-react";
import { ChapterExamMeta, completeNote, Note } from "../../lib/api";
import { subjectLabel } from "../../lib/subjects";
import HtmlViewer from "./HtmlViewer";

export default function NotesReader({
  note,
  chapterExams,
  telegramUserId,
  onTakeChapterExam,
  onBack,
  onNoteCompleted,
}: {
  note: Note;
  chapterExams: ChapterExamMeta[];
  telegramUserId?: number;
  onTakeChapterExam: (examId: number) => void;
  onBack: () => void;
  onNoteCompleted?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  useEffect(() => {
    if (telegramUserId) {
      setCompleted(localStorage.getItem(`mirkuzNoteComplete:${telegramUserId}:${note.id}`) === "1");
    }
  }, [note.id, telegramUserId]);

  const markComplete = async () => {
    if (!telegramUserId || completed || completing) return;
    setCompleting(true);
    try {
      const result = await completeNote(telegramUserId, note.id);
      localStorage.setItem(`mirkuzNoteComplete:${telegramUserId}:${note.id}`, "1");
      setCompleted(true);
      setCompletionMessage(result.xp_awarded > 0 ? `Chapter completed. +${result.xp_awarded} XP` : "Chapter already completed.");
      window.dispatchEvent(new Event("mirkuz:progress-updated"));
      onNoteCompleted?.();
    } catch (error) {
      console.error("Failed to complete note:", error);
      setCompletionMessage("Could not save completion. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-white">
        <div className="relative min-h-0 flex-1">
          <HtmlViewer
            html={note.html_content}
            preserveDocument
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+12px)] z-10 flex justify-between">
            <button
              onClick={onBack}
              className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur"
              aria-label="Back to chapters"
            >
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur"
              aria-label="Exit fullscreen"
              title="Exit fullscreen"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          className="shrink-0 border-t border-slate-200 bg-white/95 px-3 pt-2 backdrop-blur"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          {chapterExams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {chapterExams.map((chapterExam) => (
                <button
                  key={chapterExam.id}
                  type="button"
                  onClick={() => onTakeChapterExam(chapterExam.id)}
                  className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1D70F5] px-4 py-2 text-sm font-semibold text-white"
                >
                  <FileQuestion className="h-4 w-4" /> {chapterExam.title}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-slate-500">
              Chapter {note.chapter_number}: {note.title}
            </p>
            <button
              type="button"
              onClick={markComplete}
              disabled={!telegramUserId || completed || completing}
              className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60"
            >
              {completed ? <CheckCircle2 className="h-4 w-4" /> : null}
              {completing ? "Saving..." : completed ? "Completed" : "Mark complete · +20 XP"}
            </button>
          </div>
          {completionMessage && <p role="status" className="pt-1 text-center text-xs text-slate-600">{completionMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
        <button onClick={onBack} className="flex min-h-10 items-center gap-1 text-sm font-medium text-slate-500">
          <ChevronLeft className="h-5 w-5" /> Back
        </button>
        <button
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          onClick={() => setFullscreen(true)}
          aria-label="Maximize notes"
          title="Maximize notes"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 pb-2 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          {subjectLabel(note.subject)} • Grade {note.grade}
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Chapter {note.chapter_number}: {note.title}
        </h1>
      </div>

      <div className="w-full min-h-[55dvh] px-0" style={{ height: "calc(100dvh - 250px)" }}>
        <HtmlViewer
          html={note.html_content}
          preserveDocument
          className="block h-full w-full border-0 bg-white"
        />
      </div>

      <div className="space-y-2 px-4 py-4">
        {chapterExams.map((chapterExam) => (
          <button
            key={chapterExam.id}
            type="button"
            onClick={() => onTakeChapterExam(chapterExam.id)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1D70F5] px-4 py-2 text-sm font-semibold text-white"
          >
            <FileQuestion className="h-4 w-4" /> {chapterExam.title}
          </button>
        ))}
        <button
          type="button"
          onClick={markComplete}
          disabled={!telegramUserId || completed || completing}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-60"
        >
          {completed ? <CheckCircle2 className="h-4 w-4" /> : null}
          {completing ? "Saving completion..." : completed ? "Chapter completed" : "Mark chapter complete · +20 XP"}
        </button>
        {completionMessage && <p role="status" className="text-center text-xs text-slate-600">{completionMessage}</p>}
      </div>
    </div>
  );
}
