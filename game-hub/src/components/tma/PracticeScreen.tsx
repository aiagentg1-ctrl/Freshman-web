"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileQuestion,
  FileText,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import { ChapterExam, ChapterExamMeta, Exam, ExamMeta, getChapterExam, getChapterExams, getExam, getExams, getUniversityLogo, StreamKey } from "../../lib/api";
import { streamLabel, subjectLabel, subjectsForStream } from "../../lib/subjects";
import { universities } from "../../lib/universities";
import ExamRunner, { PdfExamView, HtmlExamView } from "./ExamRunner";
import PremiumBanner from "./PremiumBanner";
import UniversityLogo from "./UniversityLogo";

type View =
  | { kind: "subjectList" }
  | { kind: "subjectExams"; subject: string }
  | { kind: "yearList" }
  | { kind: "yearExams"; year: string; examType?: "mid" | "final" }
  | { kind: "chapterSubjects" }
  | { kind: "chapterGrades"; subject: string }
  | { kind: "chapterList"; subject: string; grade: number }
  | { kind: "chapterExam"; chapterExam: ChapterExam }
  | { kind: "exam"; exam: Exam };

// Years are freeform strings like "2025", "2016 E.C.", "2024 G.C." — sort by
// the leading 4-digit (or first) number, newest first.
function yearSortKey(year: string): number {
  const match = year.match(/\d{3,4}/);
  return match ? parseInt(match[0], 10) : 0;
}

// Get university abbreviation from full name
function getUniversityAbbreviation(universityName: string): string {
  const university = universities.find((u) => u.name === universityName);
  return university?.abbreviation || "";
}

export default function PracticeScreen({
  stream,
  grade,
  university,
  telegramUserId,
  telegramFirstName,
  resumeExam,
  isPremium,
  onResumeHandled,
  onGoHome,
  onGetPremium,
}: {
  stream: StreamKey;
  grade: number;
  university: string;
  telegramUserId?: number;
  telegramFirstName?: string;
  resumeExam?: ExamMeta | null;
  isPremium: boolean;
  onResumeHandled?: () => void;
  onGoHome?: () => void;
  onGetPremium: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "subjectList" });
  const [mode, setMode] = useState<"subject" | "year" | "chapter">("subject");
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [chapterExams, setChapterExams] = useState<ChapterExamMeta[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChapterExams, setLoadingChapterExams] = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);
  const [universityLogos, setUniversityLogos] = useState<Map<string, string>>(new Map());

  const subjects = useMemo(() => subjectsForStream(stream), [stream]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExams(undefined, university)
      .then((data) => {
        if (!cancelled) setExams(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [university]);

  // Load university logos for exams
  useEffect(() => {
    let cancelled = false;
    const loadLogos = async () => {
      const uniqueUniversities = [...new Set(exams.map((exam) => exam.university).filter(Boolean))];
      const logoMap = new Map<string, string>();

      await Promise.all(
        uniqueUniversities.map(async (uni) => {
          try {
            const logo = await getUniversityLogo(uni);
            if (logo) {
              logoMap.set(uni, logo.data_uri);
            }
          } catch (error) {
            console.error(`Failed to load logo for ${uni}:`, error);
          }
        })
      );

      if (!cancelled) {
        setUniversityLogos(logoMap);
      }
    };

    loadLogos();
    return () => {
      cancelled = true;
    };
  }, [exams]);

  useEffect(() => {
    let cancelled = false;
    setLoadingChapterExams(true);
    getChapterExams()
      .then((data) => {
        if (!cancelled) setChapterExams(data);
      })
      .catch((error) => console.error("Failed to load chapter exams:", error))
      .finally(() => {
        if (!cancelled) setLoadingChapterExams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grade, stream]);

  // Open an exam handed over by the Home "Continue" card.
  useEffect(() => {
    if (!resumeExam) return;
    openExam(resumeExam.id);
    onResumeHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeExam]);

  const openExam = async (examId: number) => {
    setLoadingExam(true);
    try {
      const exam = await getExam(examId);
      setView({ kind: "exam", exam });
    } catch {
      alert("Could not load this exam. Please try again.");
    } finally {
      setLoadingExam(false);
    }
  };

  const openChapterExam = async (examId: number) => {
    setLoadingExam(true);
    try {
      setView({ kind: "chapterExam", chapterExam: await getChapterExam(examId) });
    } catch (error) {
      console.error("Failed to load chapter exam:", error);
      alert("Could not load chapter questions. Please try again.");
    } finally {
      setLoadingExam(false);
    }
  };

  const downloadPdf = async (examId: number, title: string) => {
    setLoadingExam(true);
    try {
      const exam = await getExam(examId);
      const a = document.createElement("a");
      a.href = exam.content_data;
      a.download = `${title}.pdf`;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.click();
    } catch {
      alert("Could not load this PDF. Please try again.");
    } finally {
      setLoadingExam(false);
    }
  };

  const examsBySubject = useMemo(() => {
    const map = new Map<string, ExamMeta[]>();
    for (const exam of exams) {
      const list = map.get(exam.subject) ?? [];
      list.push(exam);
      map.set(exam.subject, list);
    }
    // newest year first within each subject
    map.forEach((list) => list.sort((a, b) => yearSortKey(b.year) - yearSortKey(a.year)));
    return map;
  }, [exams]);

  const examsByYear = useMemo(() => {
    const map = new Map<string, ExamMeta[]>();
    for (const exam of exams) {
      const list = map.get(exam.year) ?? [];
      list.push(exam);
      map.set(exam.year, list);
    }
    return map;
  }, [exams]);

  const sortedYears = useMemo(
    () => [...examsByYear.keys()].sort((a, b) => yearSortKey(b) - yearSortKey(a)),
    [examsByYear]
  );

  const visibleSubjects = subjectFilter
    ? subjects.filter((s) => s.key === subjectFilter)
    : subjects;
  const chapterExamsForStream = useMemo(
    () => chapterExams
      .filter((chapter) => chapter.grade < 11 || stream === "general" || !chapter.stream || chapter.stream.toLowerCase() === stream)
      .sort((a, b) => a.chapter_number - b.chapter_number || a.id - b.id),
    [chapterExams, stream]
  );
  const chapterSubjects = subjects;

  if (view.kind === "chapterExam") {
    const chapter = view.chapterExam;
    const chapterAsExam: Exam = {
      id: chapter.id,
      subject: chapter.subject,
      year: `Chapter ${chapter.chapter_number}`,
      title: chapter.title,
      university,
      custom_tag: "Chapter Practice",
      question_count: chapter.question_count,
      duration_minutes: 0,
      content_type: chapter.content_type,
      exam_type: "final",
      is_premium: chapter.is_premium,
      is_published: chapter.is_published,
      content_data: chapter.content_data,
    };
    console.log("Starting chapter exam - telegramUserId:", telegramUserId, "telegramFirstName:", telegramFirstName);
    return (
      <ExamRunner
        exam={chapterAsExam}
        chapterExamId={chapter.id}
        telegramUserId={telegramUserId}
        telegramFirstName={telegramFirstName}
        onExit={() => setView({ kind: "chapterList", subject: chapter.subject, grade: chapter.grade })}
      />
    );
  }

  // ---------- Exam / PDF / HTML viewer ----------
  if (view.kind === "exam") {
    if (view.exam.content_type === "pdf") {
      return (
        <PdfExamView
          exam={view.exam}
          onExit={() => {
            if (mode === "year") {
              const year = view.exam.year;
              setView({ kind: "yearExams", year, examType: view.exam.exam_type });
            } else {
              setView({ kind: "subjectList" });
            }
          }}
        />
      );
    }
    if (view.exam.content_type === "html") {
      // Check if it's a standalone HTML exam (not interactive)
      const questions = view.exam.content_data.includes('<script') || view.exam.content_data.includes('EXAM_QUESTIONS');
      if (!questions) {
        return (
          <HtmlExamView
            exam={view.exam}
            onExit={() => {
              if (mode === "year") {
                const year = view.exam.year;
                setView({ kind: "yearExams", year, examType: view.exam.exam_type });
              } else {
                setView({ kind: "subjectList" });
              }
            }}
          />
        );
      }
    }
    console.log("Starting regular exam - telegramUserId:", telegramUserId, "telegramFirstName:", telegramFirstName);
    return (
      <ExamRunner
        exam={view.exam}
        telegramUserId={telegramUserId}
        telegramFirstName={telegramFirstName}
        onGoHome={onGoHome}
        onExit={() => {
          if (mode === "year") {
            const year = view.exam.year;
            setView({ kind: "yearExams", year, examType: view.exam.exam_type });
          } else {
            setView({ kind: "subjectList" });
          }
        }}
      />
    );
  }

  const examRow = (exam: ExamMeta, showSubject: boolean) => (
    <div
      key={exam.id}
      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          {exam.content_type === "pdf" ? (
            <FileText className="w-5 h-5 text-[#1D70F5]" />
          ) : (
            <GraduationCap className="w-5 h-5 text-[#1D70F5]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">
            {showSubject ? subjectLabel(exam.subject) : exam.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[#1D70F5] font-semibold text-[10px]">
              {exam.year}
            </span>
            {exam.custom_tag && (
              <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 font-semibold text-[10px]">
                {exam.custom_tag}
              </span>
            )}
            {exam.is_premium && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-semibold text-[10px]">
                Premium
              </span>
            )}
            {exam.content_type === "pdf" && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 font-semibold text-[10px]">
                PDF
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="w-3.5 h-3.5" /> {exam.question_count} Qs
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {exam.duration_minutes} min
            </span>
          </p>
        </div>
        {exam.content_type === "html" && (
          <button
            onClick={() => openExam(exam.id)}
            disabled={loadingExam}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-[#1D70F5] text-white text-xs font-semibold active:scale-[0.97] transition-transform"
          >
            Start
          </button>
        )}
      </div>
      {exam.content_type === "pdf" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => downloadPdf(exam.id, exam.title)}
            disabled={loadingExam}
            className="flex-1 bg-[#1D70F5] text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button
            onClick={() => openExam(exam.id)}
            disabled={loadingExam}
            className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <FileText className="w-4 h-4" /> Open in Viewer
          </button>
        </div>
      )}
    </div>
  );

  // ---------- By Subject → subject exam years ----------
  if (view.kind === "subjectExams") {
    const subject = view.subject;
    const subjectExams = examsBySubject.get(subject) ?? [];
    return (
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setView({ kind: "subjectList" })}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-xl font-bold text-slate-900">{subjectLabel(subject)}</h1>
          <p className="text-xs text-slate-500 mt-0.5">EUEE Past Exams</p>
        </div>

        <div className="flex-1 px-4 py-4 space-y-3">
          {subjectExams.length === 0 ? (
            <EmptyState
              title="No exams yet"
              subtitle={`${subjectLabel(subject)} past exams will appear here once uploaded.`}
            />
          ) : (
            subjectExams.map((exam) => examRow(exam, false))
          )}
        </div>
      </div>
    );
  }

  // ---------- By Year → subjects for that year ----------
  if (view.kind === "yearExams") {
    const yearExams = examsByYear.get(view.year) ?? [];
    const examType = view.examType ?? "final";
    const filteredExams = yearExams.filter((exam) => exam.exam_type === examType);

    return (
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setView({ kind: "yearList" })}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-xl font-bold text-slate-900">{view.year}</h1>
          <p className="text-xs text-slate-500 mt-0.5">All subjects for this year</p>

          {/* Mid/Final Exam Tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 mt-4">
            {(
              [
                { key: "mid" as const, label: "Mid Exam" },
                { key: "final" as const, label: "Final Exam" },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView({ ...view, examType: tab.key })}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  examType === tab.key
                    ? "bg-white text-[#1D70F5] shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-3">
          {filteredExams.length === 0 ? (
            <EmptyState
              title={`No ${examType} exams yet`}
              subtitle={`${examType === "mid" ? "Mid" : "Final"} exams for ${view.year} will appear here once uploaded.`}
            />
          ) : (
            filteredExams.map((exam) => {
              const universityAbbr = getUniversityAbbreviation(exam.university);
              return (
                <div
                  key={exam.id}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left"
                >
                  <div className="flex items-center gap-4">
                    <UniversityLogo
                      university={exam.university}
                      logo={universityLogos.get(exam.university)}
                      className="w-16 h-16"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {subjectLabel(exam.subject)}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[#1D70F5] font-semibold text-[10px]">
                          {exam.year}
                        </span>
                        {universityAbbr && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            {universityAbbr}
                          </span>
                        )}
                        {exam.custom_tag && (
                          <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 font-semibold text-[10px]">
                            {exam.custom_tag}
                          </span>
                        )}
                        {exam.is_premium && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-semibold text-[10px]">
                            Premium
                          </span>
                        )}
                        {exam.content_type === "pdf" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 font-semibold text-[10px]">
                            PDF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <FileQuestion className="w-3.5 h-3.5" /> {exam.question_count} Qs
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {exam.duration_minutes} min
                        </span>
                      </p>
                    </div>
                    {exam.content_type === "html" && (
                      <button
                        onClick={() => openExam(exam.id)}
                        disabled={loadingExam}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-[#1D70F5] text-white text-xs font-semibold active:scale-[0.97] transition-transform"
                      >
                        Start
                      </button>
                    )}
                  </div>
                  {exam.content_type === "pdf" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => downloadPdf(exam.id, exam.title)}
                        disabled={loadingExam}
                        className="flex-1 bg-[#1D70F5] text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                      >
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button
                        onClick={() => openExam(exam.id)}
                        disabled={loadingExam}
                        className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                      >
                        <FileText className="w-4 h-4" /> Open in Viewer
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ---------- Root: segmented hub ----------
  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-5 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#1D70F5] flex items-center justify-center shadow-md shadow-blue-200">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">EUEE Past Exams</h1>
            <p className="text-xs text-slate-500">Practice real entrance exams</p>
          </div>
        </div>

        {!isPremium && <div className="mt-4"><PremiumBanner onGetPremium={onGetPremium} /></div>}

        {/* Segmented hub toggle */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 mt-4">
          {(
            [
              { key: "subject", label: "Subjects" },
              { key: "year", label: "Years" },
              { key: "chapter", label: "Chapters" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setMode(tab.key);
                setView(tab.key === "subject" ? { kind: "subjectList" } : tab.key === "year" ? { kind: "yearList" } : { kind: "chapterSubjects" });
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === tab.key
                  ? "bg-white text-[#1D70F5] shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {tab.key === "subject" ? "📚 " : tab.key === "year" ? "📅 " : "📝 "}{tab.label}
            </button>
          ))}
        </div>

        {/* Subject filter pills (By Subject mode only) */}
        {mode === "subject" && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4 custom-scrollbar">
            <button
              onClick={() => setSubjectFilter(null)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                subjectFilter === null
                  ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              All
            </button>
            {subjects.map((subject) => (
              <button
                key={subject.key}
                onClick={() =>
                  setSubjectFilter(subjectFilter === subject.key ? null : subject.key)
                }
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  subjectFilter === subject.key
                    ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {subject.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-4">
        {loading || (mode === "chapter" && loadingChapterExams) ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D70F5]" />
          </div>
        ) : mode === "chapter" ? (
          view.kind === "chapterSubjects" ? (
            chapterSubjects.length === 0 ? (
              <EmptyState title="No chapter questions yet" subtitle="Chapter practice will appear here once uploaded." />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {chapterSubjects.map((subject) => {
                  const count = chapterExamsForStream.filter((chapter) => chapter.subject === subject.key).length;
                  const Icon = subject.icon;
                  return (
                    <button
                      key={subject.key}
                      onClick={() => setView({ kind: "chapterGrades", subject: subject.key })}
                      className={`min-h-32 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 ${subject.cardBorder}`}
                    >
                      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${subject.iconBg}`}>
                        <Icon className={`h-5 w-5 ${subject.iconText}`} />
                      </span>
                      <span className="block font-semibold text-slate-900">{subject.label}</span>
                      <span className="mt-1 flex items-center justify-between gap-1 text-xs text-slate-500">
                        {count ? `${count} question sets` : "Browse chapters"}
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : view.kind === "chapterGrades" ? (
            <div className="space-y-3">
              <button
                onClick={() => setView({ kind: "chapterSubjects" })}
                className="flex items-center gap-1 text-sm font-medium text-slate-500"
              >
                <ChevronLeft className="h-5 w-5" /> Subjects
              </button>
              <h2 className="pb-1 text-lg font-bold text-slate-900">{subjectLabel(view.subject)} chapters</h2>
              <button
                onClick={() => setView({ kind: "chapterList", subject: view.subject, grade })}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm"
              >
                <GraduationCap className="h-5 w-5 shrink-0 text-violet-600" />
                <span className="flex-1 font-semibold text-slate-900">Chapter sets</span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </button>
            </div>
          ) : view.kind === "chapterList" ? (
            <div className="space-y-3">
              <button
                onClick={() => setView({ kind: "chapterGrades", subject: view.subject })}
                className="flex items-center gap-1 text-sm font-medium text-slate-500"
              >
                <ChevronLeft className="h-5 w-5" /> Subjects
              </button>
              <h2 className="pb-1 text-lg font-bold text-slate-900">{subjectLabel(view.subject)} chapters</h2>
              {chapterExamsForStream.filter(
                (chapter) => chapter.subject === view.subject && chapter.grade === view.grade
              ).length === 0 ? (
                <EmptyState title="No questions yet" subtitle="Chapter questions will appear here once uploaded." />
              ) : (
                chapterExamsForStream
                  .filter((chapter) => chapter.subject === view.subject && chapter.grade === view.grade)
                  .map((chapter) => (
                    <article key={chapter.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                        Chapter {chapter.chapter_number}
                      </p>
                      <h3 className="mt-1 font-bold text-slate-900">{chapter.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{chapter.question_count} questions · Untimed</p>
                      <button
                        type="button"
                        onClick={() => openChapterExam(chapter.id)}
                        disabled={loadingExam}
                        className="mt-3 min-h-10 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Practice questions
                      </button>
                    </article>
                  ))
              )}
            </div>
          ) : null
        ) : mode === "subject" ? (
          <div className="grid grid-cols-2 gap-3">
            {visibleSubjects.map((subject) => {
              const count = (examsBySubject.get(subject.key) ?? []).length;
              const Icon = subject.icon;
              return (
                <button
                  key={subject.key}
                  onClick={() => setView({ kind: "subjectExams", subject: subject.key })}
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${subject.cardBorder} text-left active:scale-[0.97] transition-transform`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${subject.iconBg} flex items-center justify-center mb-3`}
                  >
                    <Icon className={`w-5 h-5 ${subject.iconText}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{subject.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <ListChecks className="w-3.5 h-3.5" />
                    {count > 0 ? `${count} exam${count === 1 ? "" : "s"}` : "No exams yet"}
                  </p>
                </button>
              );
            })}
          </div>
        ) : sortedYears.length === 0 ? (
          <EmptyState
            title="No exams yet"
            subtitle="Uploaded exams will appear here grouped by year."
          />
        ) : (
          <div className="space-y-3">
            {sortedYears.map((year) => {
              const list = examsByYear.get(year) ?? [];
              return (
                <button
                  key={year}
                  onClick={() => setView({ kind: "yearExams", year, examType: "final" })}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{year}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <ListChecks className="w-3.5 h-3.5" />
                      {list.length} exam{list.length === 1 ? "" : "s"} •{" "}
                      {list.map((e) => subjectLabel(e.subject)).join(", ")}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-14">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileQuestion className="w-9 h-9 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 px-8">{subtitle}</p>
    </div>
  );
}
