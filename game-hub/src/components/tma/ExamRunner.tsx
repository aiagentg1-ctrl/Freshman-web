"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Download,
  FileText,
  Flag,
  GraduationCap,
  Home,
  Info,
  LayoutGrid,
  XCircle,
} from "lucide-react";
import { clearExamProgress, Exam, ExamMeta, getSavedExamProgress, RecentExamAttempt, saveExamProgress, saveRecentExamAttempt, submitChapterExamAttempt, submitExamAttempt } from "../../lib/api";
import { subjectLabel } from "../../lib/subjects";
import { getTelegramUser } from "../../lib/telegram";
import HtmlViewer from "./HtmlViewer";
import MathContent from "./MathContent";

// ---------- Standardized exam HTML contract ----------

export interface ExamQuestion {
  id: number;
  questionText: string;
  options: string[];
  correctAnswer: number; // index into options
  explanation?: string;
}

function extractJsonArray(source: string, openBracket: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openBracket; i < source.length; i++) {
    const c = source[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return source.slice(openBracket, i + 1);
    }
  }
  return null;
}

function normalizeQuestions(raw: unknown[]): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  raw.forEach((item, i) => {
    const q = item as Record<string, unknown>;
    const text = q.questionText ?? q.question_text ?? q.question ?? q.text;
    const options = q.options ?? q.choices ?? q.answers;
    if (typeof text !== "string" || !text.trim() || !Array.isArray(options) || options.length < 2) return;

    let correct =
      q.correctAnswer ?? q.correct_answer ?? q.correctIndex ?? q.correct_index ??
      q.answerIndex ?? q.answer_index ?? q.correctOption ?? q.correct_option ?? q.answer ?? q.correct;
    if (typeof correct === "string") {
      const answerText = correct.trim();
      const letter = answerText.match(/^(?:OPTION\s*)?([A-F])(?:[.)])?$/i);
      if (letter) {
        correct = letter[1].toUpperCase().charCodeAt(0) - 65;
      } else if (/^\d+$/.test(answerText)) {
        correct = parseInt(answerText, 10);
      } else {
        correct = options.findIndex(
          (option) => String(option).trim().toLocaleLowerCase() === answerText.toLocaleLowerCase()
        );
      }
    }
    if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 0 || correct >= options.length) return;

    const explanation = q.explanation ?? q.solution ?? q.rationale ?? q.answerExplanation ?? q.answer_explanation;

    out.push({
      id: typeof q.id === "number" ? q.id : i + 1,
      questionText: text,
      options: options.map((o) => String(o)),
      correctAnswer: correct,
      explanation: typeof explanation === "string" ? explanation : explanation == null ? undefined : JSON.stringify(explanation),
    });
  });
  return out;
}

/**
 * Parses the standardized question array embedded in uploaded exam HTML.
 * Supported shapes:
 *  - <script type="application/json" id="exam-questions">[...]</script>
 *  - <script data-exam-questions>[...]</script>
 *  - window.__EXAM_QUESTIONS__ = [...] / window.EXAM_QUESTIONS = [...]
 *  - the entire content being a JSON array or {"questions": [...]}
 */
export function parseExamQuestions(html: string): ExamQuestion[] | null {
  const candidates: string[] = [];

  const block = html.match(
    /<script[^>]*(?:id=["']exam-questions["']|data-exam-questions)[^>]*>([\s\S]*?)<\/script>/i
  );
  if (block) candidates.push(block[1]);

  const assign = html.match(/(?:window\.)?__?EXAM_QUESTIONS__?\s*=/i);
  if (assign && assign.index !== undefined) {
    const open = html.indexOf("[", assign.index);
    if (open >= 0) {
      const arr = extractJsonArray(html, open);
      if (arr) candidates.push(arr);
    }
  }

  const trimmed = html.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) candidates.push(trimmed);

  for (const candidate of candidates) {
    try {
      let parsed: unknown = JSON.parse(candidate.trim());
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
        parsed = (parsed as Record<string, unknown>).questions;
      }
      if (Array.isArray(parsed)) {
        const questions = normalizeQuestions(parsed);
        if (questions.length > 0) return questions;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function resolveTelegramUserId(fallbackId?: number): number | undefined {
  const liveId = getTelegramUser()?.id;
  const storedId = Number(localStorage.getItem("mirkuzTelegramUserId"));
  // For development/testing: allow setting a test user ID via localStorage
  const testUserId = Number(localStorage.getItem("mirkuzTestUserId"));
  // Try URL parameter as last resort (for testing)
  const urlId = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("user_id")) : undefined;
  const urlIdValid = urlId !== undefined && Number.isSafeInteger(urlId) && urlId > 0;
  const resolved = fallbackId || liveId || (Number.isSafeInteger(testUserId) && testUserId > 0 ? testUserId : undefined) || (Number.isSafeInteger(storedId) && storedId > 0 ? storedId : undefined) || (urlIdValid ? urlId : undefined);
  console.log("resolveTelegramUserId - fallbackId:", fallbackId, "liveId:", liveId, "storedId:", storedId, "testUserId:", testUserId, "urlId:", urlId, "resolved:", resolved);
  return resolved;
}

// ---------- PDF exam view (download / in-app viewer) ----------

export function PdfExamView({ exam, onExit }: { exam: Exam; onExit: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-lg font-bold text-slate-900">{exam.title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {subjectLabel(exam.subject)}
          {exam.custom_tag ? ` • ${exam.custom_tag}` : ""} • {exam.question_count} questions •{" "}
          {exam.duration_minutes} min
        </p>
      </div>

      <div className="px-4 py-4">
        <a
          href={exam.content_data}
          target="_blank"
          rel="noreferrer"
          download={`${exam.title}.pdf`}
          className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" /> Download PDF
        </a>
      </div>

      <div className="flex-1 px-4 pb-4 min-h-0">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full min-h-[420px]">
          <iframe
            src={exam.content_data}
            title={exam.title}
            className="w-full h-full min-h-[420px]"
          />
        </div>
      </div>
    </div>
  );
}

// ---------- HTML exam iframe view (standalone HTML files) ----------

export function HtmlExamView({ exam, onExit }: { exam: Exam; onExit: () => void }) {
  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-slate-500 text-sm font-medium"
        >
          <ChevronLeft className="w-5 h-5" /> Exit Exam
        </button>
        <h1 className="text-lg font-bold text-slate-900 mt-2">{exam.title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {subjectLabel(exam.subject)}
          {exam.custom_tag ? ` • ${exam.custom_tag}` : ""} • {exam.question_count} questions •{" "}
          {exam.duration_minutes} min
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <iframe
          srcDoc={exam.content_data}
          title={exam.title}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
        />
      </div>
    </div>
  );
}

// ---------- Interactive HTML exam runner (3 stages) ----------

type Stage = "briefing" | "running" | "result";
type SubmissionStatus = "idle" | "saving" | "saved" | "failed" | "missing_user";

interface AttemptSubmission {
  score: number;
  total_questions: number;
  time_spent?: number;
  answers_json: string;
  completed_at: string;
  first_name?: string;
}

function SubmissionNotice({
  status,
  error,
  onRetry,
}: {
  status: SubmissionStatus;
  error: string;
  onRetry: () => void;
}) {
  if (status === "idle") return null;

  const saved = status === "saved";
  const missingUser = status === "missing_user";
  const message = saved
    ? "Score saved. XP and leaderboard updated."
    : status === "saving"
    ? "Saving score and XP..."
    : missingUser
    ? "Telegram did not provide your student ID. Open this from the bot's Mini App, then retry."
    : `Score could not be saved: ${error}`;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${saved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "saving" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p role={saved || status === "saving" ? "status" : "alert"}>{message}</p>
      {!saved && status !== "saving" && (
        <button type="button" onClick={onRetry} className="mt-2 min-h-9 rounded-lg border border-current/20 px-3 text-xs font-semibold">
          Retry saving
        </button>
      )}
    </div>
  );
}

export default function ExamRunner({
  exam,
  chapterExamId,
  telegramUserId,
  telegramFirstName,
  onExit,
  onGoHome,
}: {
  exam: Exam;
  chapterExamId?: number;
  telegramUserId?: number;
  telegramFirstName?: string;
  onExit: () => void;
  onGoHome?: () => void;
}) {
  const questions = useMemo(() => parseExamQuestions(exam.content_data), [exam.content_data]);

  const [stage, setStage] = useState<Stage>("briefing");
  const [restoring, setRestoring] = useState(true);
  const [timed, setTimed] = useState(chapterExamId === undefined);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [flags, setFlags] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(exam.duration_minutes * 60);
  const [elapsed, setElapsed] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [htmlExamResult, setHtmlExamResult] = useState<{ score: number; total: number; percentage: number } | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [submissionError, setSubmissionError] = useState("");
  const startedAt = useRef(0);
  const answersRef = useRef<(number | null)[]>([]);
  const submitted = useRef(false);
  const pendingSubmission = useRef<AttemptSubmission | null>(null);

  const persistSubmission = useCallback(async (attempt: AttemptSubmission) => {
    pendingSubmission.current = attempt;
    const userId = resolveTelegramUserId(telegramUserId);
    if (!userId) {
      setSubmissionStatus("missing_user");
      setSubmissionError("");
      return;
    }

    setSubmissionStatus("saving");
    setSubmissionError("");
    try {
      if (chapterExamId !== undefined) {
        await submitChapterExamAttempt(chapterExamId, {
          user_id: userId,
          score: attempt.score,
          total_questions: attempt.total_questions,
          answers_json: attempt.answers_json,
          completed_at: attempt.completed_at,
        });
      } else {
        await submitExamAttempt(exam.id, {
          user_id: userId,
          first_name: attempt.first_name,
          score: attempt.score,
          time_spent: attempt.time_spent,
          total_questions: attempt.total_questions,
          answers_json: attempt.answers_json,
          completed_at: attempt.completed_at,
        });
      }
      setSubmissionStatus("saved");
      window.dispatchEvent(new Event("mirkuz:exam-attempt-saved"));
      window.dispatchEvent(new Event("mirkuz:progress-updated"));
    } catch (error) {
      console.error("Failed to save exam attempt:", error);
      setSubmissionError(error instanceof Error ? error.message : "The server could not save this attempt.");
      setSubmissionStatus("failed");
    }
  }, [chapterExamId, exam.id, telegramFirstName, telegramUserId]);

  const retrySubmission = () => {
    if (pendingSubmission.current) void persistSubmission(pendingSubmission.current);
  };

  const total = questions?.length ?? exam.question_count;
  const interactive = questions !== null;
  const isHtmlExam = exam.content_type === "html" && !interactive;

  useEffect(() => {
    const saved = chapterExamId === undefined ? getSavedExamProgress(exam.id) : null;
    if (saved && questions) {
      const restoredAnswers = Array.from({ length: total }, (_, index) => {
        const answer = saved.answers[index];
        return typeof answer === "number" && answer >= 0 && answer < questions[index].options.length
          ? answer
          : null;
      });
      const restoredCurrent = Math.min(Math.max(saved.currentQuestion, 0), total - 1);
      const restoredSecondsLeft = Math.max(0, Math.min(saved.secondsLeft, exam.duration_minutes * 60));
      const restoredElapsed = Math.max(0, saved.elapsed);

      answersRef.current = restoredAnswers;
      startedAt.current = Date.now() - (saved.timed
        ? (exam.duration_minutes * 60 - restoredSecondsLeft) * 1000
        : restoredElapsed * 1000);
      submitted.current = false;
      setTimed(saved.timed);
      setAnswers(restoredAnswers);
      setFlags(saved.flags.filter((flag) => flag >= 0 && flag < total));
      setCurrent(restoredCurrent);
      setSecondsLeft(restoredSecondsLeft);
      setElapsed(restoredElapsed);
      setStage("running");
    }
    setRestoring(false);
  }, [chapterExamId, exam.duration_minutes, exam.id, questions, total]);

  useEffect(() => {
    if (restoring || stage !== "running" || !questions || chapterExamId !== undefined) return;
    const examMeta: ExamMeta = {
      id: exam.id,
      subject: exam.subject,
      year: exam.year,
      title: exam.title,
      custom_tag: exam.custom_tag,
      question_count: exam.question_count,
      duration_minutes: exam.duration_minutes,
      content_type: exam.content_type,
      is_premium: exam.is_premium,
      is_published: exam.is_published,
    };
    saveExamProgress({
      exam: examMeta,
      currentQuestion: current,
      answers,
      flags,
      timed,
      secondsLeft,
      elapsed,
    });
  }, [answers, chapterExamId, current, elapsed, exam, flags, questions, restoring, secondsLeft, stage, timed]);

  useEffect(() => {
    if (stage !== "running") return;
    const interval = setInterval(() => {
      if (timed) {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            finish();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setElapsed((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timed]);

  // Listen for HTML exam completion messages
  useEffect(() => {
    const handleExamMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'EXAM_COMPLETED' && !submitted.current) {
        submitted.current = true;
        const { score, total, percentage } = event.data;
        if (chapterExamId === undefined) clearExamProgress(exam.id);
        setHtmlExamResult({ score, total, percentage });
        setStage("result");

        const completedAt = new Date().toISOString();
        void persistSubmission({
          score: percentage,
          total_questions: total,
          answers_json: JSON.stringify({ source: "html", total, score: percentage }),
          completed_at: completedAt,
          first_name: telegramFirstName || getTelegramUser()?.first_name,
        });

        if (chapterExamId === undefined) {
          saveRecentExamAttempt({
            id: `${exam.id}-${completedAt}`,
            examId: exam.id,
            title: exam.title,
            subject: exam.subject,
            year: exam.year,
            scorePercentage: percentage,
            correctCount: score,
            totalQuestions: total,
            timeSpent: 0,
            completedAt,
            answers: [],
          });

          localStorage.setItem("mirkuzLastResult", JSON.stringify({
            examId: exam.id,
            subject: exam.subject,
            year: exam.year,
            scorePercentage: percentage,
            correctCount: score,
            totalQuestions: total,
            timeSpent: 0,
          }));
          localStorage.setItem("mirkuzLastExam", JSON.stringify({
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            year: exam.year,
            custom_tag: exam.custom_tag,
            question_count: exam.question_count,
            duration_minutes: exam.duration_minutes,
            content_type: exam.content_type,
            is_premium: exam.is_premium,
          }));
        }
      }
    };

    window.addEventListener('message', handleExamMessage);
    return () => window.removeEventListener('message', handleExamMessage);
  }, [chapterExamId, exam, persistSubmission, telegramFirstName]);

  const startExam = () => {
    startedAt.current = Date.now();
    submitted.current = false;
    const emptyAnswers = new Array<(number | null)>(total).fill(null);
    answersRef.current = emptyAnswers;
    setAnswers(emptyAnswers);
    setFlags([]);
    setCurrent(0);
    setSecondsLeft(exam.duration_minutes * 60);
    setElapsed(0);
    setStage("running");
  };

  const finish = () => {
    if (submitted.current) return;
    submitted.current = true;
    if (chapterExamId === undefined) clearExamProgress(exam.id);
    setStage("result");
    const finalAnswers = answersRef.current;

    const correctCount = questions
      ? questions.reduce((acc, q, i) => (finalAnswers[i] === q.correctAnswer ? acc + 1 : acc), 0)
      : 0;
    const totalQuestions = questions?.length ?? exam.question_count;
    const scorePercentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const timeSpent = Math.round((Date.now() - (startedAt.current || Date.now())) / 1000);
    const wrongQuestions = questions
      ? questions
          .map((q, i) => ({
            id: q.id,
            question: q.questionText,
            selectedOption: finalAnswers[i] !== null ? q.options[finalAnswers[i] as number] : null,
            correctOption: q.options[q.correctAnswer],
            explanation: q.explanation || "",
            wasCorrect: finalAnswers[i] === q.correctAnswer,
          }))
          .filter((item) => !item.wasCorrect)
      : [];

    const completedAt = new Date().toISOString();
    const reviewAttempt: RecentExamAttempt = {
      id: `${exam.id}-${completedAt}`,
      examId: exam.id,
      title: exam.title,
      subject: exam.subject,
      year: exam.year,
      scorePercentage,
      correctCount,
      totalQuestions,
      timeSpent,
      completedAt,
      answers: questions?.map((q, i) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        selectedAnswer: finalAnswers[i],
        explanation: q.explanation,
      })) ?? [],
    };
    if (chapterExamId === undefined) {
      saveRecentExamAttempt(reviewAttempt);
      localStorage.setItem("mirkuzWeaknesses", JSON.stringify(wrongQuestions));
    }

    // Standardized score bridge → Home "Recent Exam Performance" card.
    // Only written for scored (standardized) exams — a legacy reader run must
    // not overwrite a real score with 0%.
    if (questions && chapterExamId === undefined) {
      const payload = {
        examId: exam.id,
        subject: exam.subject,
        year: exam.year,
        scorePercentage,
        correctCount,
        totalQuestions,
        timeSpent,
      };
      localStorage.setItem("mirkuzLastResult", JSON.stringify(payload));
    }
    if (chapterExamId === undefined) {
      localStorage.setItem(
        "mirkuzLastExam",
        JSON.stringify({
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          year: exam.year,
          custom_tag: exam.custom_tag,
          question_count: exam.question_count,
          duration_minutes: exam.duration_minutes,
          content_type: exam.content_type,
          is_premium: exam.is_premium,
          is_published: exam.is_published,
        })
      );
    }

    const answersJson = JSON.stringify(
      questions?.map((q, i) => ({
        id: q.id,
        question: q.questionText,
        selected: finalAnswers[i] !== null ? q.options[finalAnswers[i] as number] : null,
        correct: q.options[q.correctAnswer],
        isCorrect: finalAnswers[i] === q.correctAnswer,
        explanation: q.explanation || "",
      })) || []
    );
    void persistSubmission({
      score: scorePercentage,
      total_questions: totalQuestions,
      time_spent: timed ? timeSpent : undefined,
      answers_json: answersJson,
      completed_at: completedAt,
      first_name: telegramFirstName || getTelegramUser()?.first_name,
    });
  };

  const correctCount =
    questions?.reduce((acc, q, i) => (answers[i] === q.correctAnswer ? acc + 1 : acc), 0) ?? 0;
  const answeredCount = answers.filter((a) => a !== null).length;
  const timeSpentSoFar = timed
    ? exam.duration_minutes * 60 - secondsLeft
    : elapsed;

  // ---------- Stage 3: Result ----------
  if (restoring) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm font-medium text-slate-500">
        Restoring your exam...
      </div>
    );
  }

  if (stage === "result") {
    // Handle HTML exam results
    if (htmlExamResult) {
      const { score, total: htmlTotal, percentage } = htmlExamResult;
      return (
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-4 pt-6 pb-6 bg-gradient-to-br from-[#1D70F5] to-[#4C8DFF] text-white text-center rounded-b-3xl">
            <p className="text-blue-100 text-xs mb-1">{exam.title}</p>
            <div className="relative w-36 h-36 mx-auto mt-3">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={52} stroke="rgba(255,255,255,0.25)" strokeWidth="10" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r={52}
                  stroke="#fff"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - percentage / 100)}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{percentage}%</span>
                <span className="text-[11px] text-blue-100">Your Score</span>
              </div>
            </div>
            <p className="mt-3 font-semibold">
              {score} / {htmlTotal} correct
            </p>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
              <p className="text-sm font-semibold text-slate-800">
                {percentage >= 70
                  ? `Excellent! You scored ${percentage}% — keep it up!`
                  : percentage >= 40
                  ? "Good effort! Review the exam to improve."
                  : "Don't give up — review and try again."}
              </p>
            </div>

            <SubmissionNotice status={submissionStatus} error={submissionError} onRetry={retrySubmission} />

            <button
              onClick={onGoHome ?? onExit}
              className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" /> Back to Home
            </button>
          </div>
        </div>
      );
    }

    // Original interactive exam result
    const scorePercentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const unanswered = total - answeredCount;
    const incorrect = answeredCount - correctCount;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-4 pt-6 pb-6 bg-gradient-to-br from-[#1D70F5] to-[#4C8DFF] text-white text-center rounded-b-3xl">
          <p className="text-blue-100 text-xs mb-1">{exam.title}</p>
          <div className="relative w-36 h-36 mx-auto mt-3">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth="10" fill="none" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="#fff"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - scorePercentage / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{scorePercentage}%</span>
              <span className="text-[11px] text-blue-100">Your Score</span>
            </div>
          </div>
          <p className="mt-3 font-semibold">
            {correctCount} / {total} correct
          </p>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-900">{correctCount}</p>
              <p className="text-[10px] text-slate-500 font-medium">Correct</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
              <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-900">{incorrect}</p>
              <p className="text-[10px] text-slate-500 font-medium">Incorrect</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
              <Circle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-900">{unanswered}</p>
              <p className="text-[10px] text-slate-500 font-medium">Unanswered</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
            <p className="text-sm font-semibold text-slate-800">
              {scorePercentage >= 70
                ? `Good job! You scored ${scorePercentage}% — keep it up!`
                : scorePercentage >= 40
                ? "Nice effort! Review the explanations below to improve."
                : "Don't give up — review the explanations and try again."}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Time used: {formatTime(timeSpentSoFar)}
            </p>
          </div>

          <SubmissionNotice status={submissionStatus} error={submissionError} onRetry={retrySubmission} />

          {interactive && (
            <button
              onClick={() => setShowAnswers((v) => !v)}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base rounded-2xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all cursor-pointer"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>{showAnswers ? "Hide Detailed Answers & Explanations" : "View Detailed Answers & Explanations"}</span>
              <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${showAnswers ? "rotate-90" : ""}`} />
            </button>
          )}

          {showAnswers && questions && (
            <div className="space-y-3">
              {questions.map((q, i) => {
                const chosen = answers[i];
                const isCorrect = chosen === q.correctAnswer;
                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          isCorrect
                            ? "bg-emerald-100 text-emerald-700"
                            : chosen === null
                            ? "bg-slate-100 text-slate-500"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <MathContent html={q.questionText} className="text-sm font-semibold text-slate-900 flex-1" />
                    </div>
                    <div className="space-y-1.5 ml-8">
                      {q.options.map((opt, oi) => {
                        const isAnswer = oi === q.correctAnswer;
                        const isChosen = oi === chosen;
                        return (
                          <div
                            key={oi}
                            className={`text-xs px-3 py-2 rounded-xl border-2 flex items-center gap-2 ${
                              isAnswer
                                ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 rounded-xl p-3 font-medium"
                                : isChosen
                                ? "border-rose-500 bg-rose-50/70 text-rose-900 rounded-xl p-3"
                                : "border-slate-100 text-slate-600"
                            }`}
                          >
                            <span className="font-bold">{OPTION_LETTERS[oi]}.</span>
                            <MathContent html={opt} className="flex-1" />
                            {isAnswer && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            {isChosen && !isAnswer && <XCircle className="w-4 h-4 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-3 ml-8 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-amber-700 mb-1">EXPLANATION</p>
                        <MathContent html={q.explanation} className="text-xs text-amber-900 leading-relaxed" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={onGoHome ?? onExit}
            className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ---------- Stage 1: Briefing ----------
  if (stage === "briefing") {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium mb-2"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#1D70F5] flex items-center justify-center shadow-md shadow-blue-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {subjectLabel(exam.subject)}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1D70F5] font-semibold text-[10px]">
                  {exam.year}
                </span>
                {exam.custom_tag && (
                  <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 font-semibold text-[10px]">
                    {exam.custom_tag}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total Questions</span>
              <span className="text-sm font-bold text-slate-900">{total}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
              <span className="text-sm text-slate-500">Time Limit</span>
              <span className="text-sm font-bold text-slate-900">
                {chapterExamId !== undefined ? "Untimed practice" : `${exam.duration_minutes} minutes`}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
              <span className="text-sm text-slate-500">Question Type</span>
              <span className="text-sm font-bold text-slate-900">Multiple Choice</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-[#1D70F5] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Instructions</p>
              <p className="text-xs text-blue-800 leading-relaxed">
                Read each question carefully and pick the best answer. You can flag questions to
                review later and jump between them from the question grid. Your score and full
                explanations are shown when you submit.
              </p>
            </div>
          </div>

          {interactive && chapterExamId === undefined && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
              <p className="text-sm font-bold text-slate-900 mb-1">Exam Mode</p>
              {(
                [
                  {
                    key: true,
                    title: "⏱ Timed Exam",
                    desc: `Countdown of ${exam.duration_minutes} minutes — auto-submits when time expires.`,
                  },
                  {
                    key: false,
                    title: "🧘 Untimed Exam",
                    desc: "Self-paced practice — submit whenever you finish.",
                  },
                ] as const
              ).map((mode) => (
                <button
                  key={String(mode.key)}
                  onClick={() => setTimed(mode.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors flex items-center gap-3 ${
                    timed === mode.key
                      ? "border-[#1D70F5] bg-blue-50/60"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      timed === mode.key
                        ? "border-[#1D70F5] bg-[#1D70F5]"
                        : "border-slate-300"
                    }`}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {mode.title}
                    </span>
                    <span className="block text-xs text-slate-500">{mode.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={startExam}
            className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  // ---------- Stage 2: Running ----------
  if (!interactive) {
    // Handle different content types
    if (exam.content_type === "pdf") {
      return <PdfExamView exam={exam} onExit={onExit} />;
    }

    if (exam.content_type === "html" && isHtmlExam) {
      return <HtmlExamView exam={exam} onExit={onExit} />;
    }

    // Fallback for legacy uploads without the standardized question payload.
    return (
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={onExit}
              className="flex items-center gap-1 text-slate-500 text-sm font-medium"
            >
              <ChevronLeft className="w-5 h-5" /> Exit
            </button>
            <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-[#1D70F5]">
              <Clock className="w-3.5 h-3.5" />
              {timed ? formatTime(secondsLeft) : formatTime(elapsed)}
            </div>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-2">{exam.title}</h1>
        </div>
        <div className="flex-1 px-4 py-4">
          <HtmlViewer html={exam.content_data} className="exam-paper" />
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={finish}
            className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform"
          >
            Finish Exam
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const isLast = current === total - 1;
  const lowTime = timed && secondsLeft <= 300;

  return (
    <div className="flex flex-col flex-1">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium"
          >
            <ChevronLeft className="w-5 h-5" /> Exit
          </button>
          <div
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              lowTime ? "bg-red-50 text-red-600" : "bg-blue-50 text-[#1D70F5]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timed ? formatTime(secondsLeft) : formatTime(elapsed)}
          </div>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {current + 1} / {total}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-[#1D70F5] rounded-full transition-all"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question nav drawer */}
      {drawerOpen && (
        <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-3">
          <div className="flex gap-2 text-[11px] font-semibold">
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {answeredCount} Answered
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
              <Circle className="w-3.5 h-3.5" /> {total - answeredCount} Unanswered
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600">
              <Flag className="w-3.5 h-3.5" /> {flags.length} Flagged
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar">
            {questions.map((_, i) => {
              const answered = answers[i] !== null;
              const flagged = flags.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    setCurrent(i);
                    setDrawerOpen(false);
                  }}
                  className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                    i === current
                      ? "bg-[#1D70F5] text-white"
                      : flagged
                      ? "bg-red-50 text-red-600 border border-red-200"
                      : answered
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-50 text-slate-500 border border-slate-100"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={finish}
            className="w-full text-xs font-semibold text-[#1D70F5] py-1.5"
          >
            Submit Exam Now
          </button>
        </div>
      )}

      {/* Question */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#1D70F5]">Question {current + 1}</span>
            {flags.includes(current) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                <Flag className="w-3 h-3" /> FLAGGED
              </span>
            )}
          </div>
          <MathContent html={q.questionText} className="text-[15px] font-semibold text-slate-900 leading-relaxed mb-4" />
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[current] === oi;
              return (
                <button
                  key={oi}
                  onClick={() =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[current] = oi;
                      answersRef.current = next;
                      return next;
                    })
                  }
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors flex items-center gap-3 active:scale-[0.99] ${
                    selected
                      ? "border-[#1D70F5] bg-blue-50/60"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selected ? "bg-[#1D70F5] text-white" : "bg-white text-slate-500 border border-slate-200"
                    }`}
                  >
                    {OPTION_LETTERS[oi]}
                  </span>
                  <span className={`flex-1 text-sm ${selected ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                    <MathContent as="span" html={opt} className="math-option-content" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="px-4 py-3.5 rounded-2xl font-semibold bg-white border border-slate-100 shadow-sm text-slate-600 disabled:opacity-40 text-sm"
        >
          ← Prev
        </button>
        <button
          onClick={() =>
            setFlags((prev) =>
              prev.includes(current) ? prev.filter((f) => f !== current) : [...prev, current]
            )
          }
          className={`px-4 py-3.5 rounded-2xl font-semibold border shadow-sm text-sm flex items-center gap-1.5 ${
            flags.includes(current)
              ? "bg-red-50 border-red-200 text-red-600"
              : "bg-white border-slate-100 text-slate-600"
          }`}
        >
          <Flag className="w-4 h-4" />
          {flags.includes(current) ? "Unflag" : "Flag"}
        </button>
        {isLast ? (
          <button
            onClick={finish}
            className="flex-1 bg-emerald-500 text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform text-sm"
          >
            Submit Exam
          </button>
        ) : (
          <button
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            className="flex-1 bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform text-sm"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
