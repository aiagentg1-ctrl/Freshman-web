"use client";

import { useState } from "react";
import { ChevronLeft, FileQuestion, Maximize2, Minimize2 } from "lucide-react";
import { ChapterExamMeta, Note } from "../../lib/api";
import { subjectLabel } from "../../lib/subjects";
import HtmlViewer from "./HtmlViewer";

export default function NotesReader({
  note,
  chapterExams,
  onTakeChapterExam,
  onBack,
}: {
  note: Note;
  chapterExams: ChapterExamMeta[];
  onTakeChapterExam: (examId: number) => void;
  onBack: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(true);

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
        {chapterExams.length > 0 && (
          <div
            className="shrink-0 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur flex gap-2 overflow-x-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
          >
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
          {subjectLabel(note.subject)} • {note.stream === "social" ? "Social Science" : "Natural Science"}
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

      {chapterExams.length > 0 && (
        <div className="space-y-2 px-4 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Practice Questions</p>
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
        </div>
      )}
    </div>
  );
}
