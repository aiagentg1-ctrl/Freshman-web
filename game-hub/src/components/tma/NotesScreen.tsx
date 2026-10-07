"use client";

import { useMemo, useState, useEffect } from "react";
import { BookMarked, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { ChapterExam, ChapterExamMeta, Exam, getChapterExam, getChapterExams, getNote, getNotes, Note, NoteMeta, StreamKey } from "../../lib/api";
import { streamLabel, subjectLabel, subjectsForStream } from "../../lib/subjects";
import NotesReader from "./NotesReader";
import { EmptyState } from "./PracticeScreen";
import ExamRunner from "./ExamRunner";

const GRADES = [9, 10, 11, 12];

type View =
  | { kind: "subjects" }
  | { kind: "grades"; subject: string }
  | { kind: "chapters"; subject: string; grade: number }
  | { kind: "reader"; note: Note; chapterExams: ChapterExamMeta[] }
  | { kind: "chapterExam"; note: Note; chapterExam: ChapterExam; chapterExams: ChapterExamMeta[] };

export default function NotesScreen({
  stream,
  grade,
  telegramUserId,
}: {
  stream: StreamKey;
  grade: number;
  telegramUserId?: number;
}) {
  const [view, setView] = useState<View>({ kind: "subjects" });
  const [chapters, setChapters] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedNotes, setCompletedNotes] = useState<Set<number>>(new Set());

  // Load completed notes from localStorage
  useEffect(() => {
    if (telegramUserId) {
      const completed = new Set<number>();
      chapters.forEach(chapter => {
        if (localStorage.getItem(`mirkuzNoteComplete:${telegramUserId}:${chapter.id}`) === "1") {
          completed.add(chapter.id);
        }
      });
      setCompletedNotes(completed);
    }
  }, [telegramUserId, chapters]);

  const subjects = useMemo(() => subjectsForStream(stream), [stream]);

  const selectGrade = async (subject: string, grade: number) => {
    setLoading(true);
    setView({ kind: "chapters", subject, grade });
    setChapters([]);
    try {
      const notes = await getNotes(subject, grade, stream);
      setChapters(notes.sort((a, b) => a.chapter_number - b.chapter_number || a.id - b.id));
    } catch {
      setChapters([]);
    } finally {
      setLoading(false);
    }
  };

  const openChapter = async (noteId: number) => {
    setLoading(true);
    try {
      const [note, chapterExams] = await Promise.all([
        getNote(noteId),
        getChapterExams({ note_id: noteId }).catch(() => []),
      ]);
      localStorage.setItem(
        "mirkuzLastNote",
        JSON.stringify({ id: note.id, title: note.title, subject: note.subject, grade: note.grade })
      );
      setView({ kind: "reader", note, chapterExams });
    } catch {
      alert("Could not load this chapter. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNoteCompleted = (noteId: number) => {
    setCompletedNotes(prev => new Set([...prev, noteId]));
  };

  const openChapterExam = async (note: Note, chapterExamId: number, chapterExams: ChapterExamMeta[]) => {
    setLoading(true);
    try {
      const chapterExam = await getChapterExam(chapterExamId);
      setView({ kind: "chapterExam", note, chapterExam, chapterExams });
    } catch (error) {
      console.error("Could not load chapter exam:", error);
      alert("Could not load the chapter questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (view.kind === "chapterExam") {
    const exam: Exam = {
      id: view.chapterExam.id,
      subject: view.chapterExam.subject,
      year: `Chapter ${view.chapterExam.chapter_number}`,
      title: view.chapterExam.title,
      custom_tag: "Chapter Practice",
      question_count: view.chapterExam.question_count,
      duration_minutes: 180,
      content_type: view.chapterExam.content_type,
      is_premium: view.chapterExam.is_premium,
      is_published: view.chapterExam.is_published,
      content_data: view.chapterExam.content_data,
    };
    console.log("Starting chapter exam from notes - telegramUserId:", telegramUserId);
    return (
      <ExamRunner
        exam={exam}
        chapterExamId={view.chapterExam.id}
        telegramUserId={telegramUserId}
        onExit={() => setView({ kind: "reader", note: view.note, chapterExams: view.chapterExams })}
      />
    );
  }

  if (view.kind === "reader") {
    const { note } = view;
    return (
      <NotesReader
        note={note}
        chapterExams={view.chapterExams}
        telegramUserId={telegramUserId}
        onTakeChapterExam={(chapterExamId) => openChapterExam(note, chapterExamId, view.chapterExams)}
        onBack={() => setView({ kind: "chapters", subject: note.subject, grade: note.grade })}
        onNoteCompleted={() => handleNoteCompleted(note.id)}
      />
    );
  }

  if (view.kind === "chapters") {
    const completedCount = chapters.filter(c => completedNotes.has(c.id)).length;
    const progressPercent = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;

    return (
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setView({ kind: "subjects" })}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-xl font-bold text-slate-900">{subjectLabel(view.subject)}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{completedCount}/{chapters.length} chapters completed</p>
          {chapters.length > 0 && (
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D70F5]" />
            </div>
          ) : chapters.length === 0 ? (
            <EmptyState
              title="No chapters yet"
              subtitle={`${subjectLabel(view.subject)} notes will appear here once uploaded.`}
            />
          ) : (
            chapters.map((chapter) => {
              const isCompleted = completedNotes.has(chapter.id);
              return (
                <button
                  key={chapter.id}
                  onClick={() => openChapter(chapter.id)}
                  className={`w-full rounded-2xl p-4 shadow-sm border flex items-center gap-3 text-left active:scale-[0.98] transition-transform ${
                    isCompleted ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isCompleted ? "bg-emerald-100" : "bg-violet-50"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <span className="text-sm font-bold text-violet-600">{chapter.chapter_number}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${isCompleted ? "text-emerald-900" : "text-slate-900"}`}>
                      {chapter.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      Chapter {chapter.chapter_number}
                      {isCompleted && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                          Completed
                        </span>
                      )}
                      {chapter.is_premium && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-semibold text-[10px]">
                          Premium
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (view.kind === "grades") {
    return (
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setView({ kind: "subjects" })}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-xl font-bold text-slate-900">{subjectLabel(view.subject)}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Choose a subject to browse its chapters</p>
        </div>

        <div className="px-4 py-4">
          <button
            type="button"
            onClick={() => void selectGrade(view.subject, grade)}
            className="w-full rounded-xl bg-[#1D70F5] py-3 text-sm font-semibold text-white"
          >
            Browse chapters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-5 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-violet-500 flex items-center justify-center shadow-md shadow-violet-200">
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Study Notes</h1>
            <p className="text-xs text-slate-500">
              {streamLabel(stream)} subjects
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {subjects.map((subject) => {
          const Icon = subject.icon;
          return (
            <button
              key={subject.key}
              onClick={() => void selectGrade(subject.key, grade)}
              className={`w-full bg-white rounded-2xl p-4 shadow-sm border ${subject.cardBorder} flex items-center gap-3 text-left active:scale-[0.98] transition-transform`}
            >
              <div
                className={`w-11 h-11 rounded-xl ${subject.iconBg} flex items-center justify-center shrink-0`}
              >
                <Icon className={`w-5 h-5 ${subject.iconText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">{subject.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Open chapters</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
