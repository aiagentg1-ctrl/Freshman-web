"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ClipboardList, GraduationCap, Sparkles, Target, TrendingUp, XCircle, Award, Flame, Zap, Shield, Crown } from "lucide-react";
import { ExamMeta, ExamReviewQuestion, getInProgressExam, getRecentExamAttempts, getUserProgress, getUserStats, RecentExamAttempt, StreamKey, UserProgress, UserStats } from "../../lib/api";
import { streamLabel, subjectLabel } from "../../lib/subjects";
import { TelegramUser } from "../../lib/telegram";
import FlashCards from "./FlashCards";
import Leaderboard from "./Leaderboard";
import MathContent from "./MathContent";
import PremiumBanner from "./PremiumBanner";

export default function HomeScreen({
  telegramUser,
  fullName,
  grade,
  stream,
  university,
  selectedSubjects,
  isPremium,
  onContinueExam,
  onGoToPractice,
  onGetPremium,
}: {
  telegramUser: TelegramUser | null;
  fullName: string;
  grade: number;
  stream: StreamKey;
  university: string;
  selectedSubjects: string[];
  isPremium: boolean;
  onContinueExam: (exam: ExamMeta) => void;
  onGoToPractice: () => void;
  onGetPremium: () => void;
}) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [inProgressExam, setInProgressExam] = useState<ExamMeta | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentExamAttempt[]>([]);
  const [reviewAttempt, setReviewAttempt] = useState<RecentExamAttempt | null>(null);
  const [showRecentAttempts, setShowRecentAttempts] = useState(false);

  useEffect(() => {
    const refreshRecentAttempts = () => setRecentAttempts(getRecentExamAttempts());
    const refreshInProgressExam = () => setInProgressExam(getInProgressExam());
    const refreshProgress = () => {
      if (telegramUser) {
        console.log("Loading progress for user:", telegramUser.id);
        getUserProgress(telegramUser.id)
          .then((data) => {
            console.log("Progress loaded:", data);
            setProgress(data);
          })
          .catch((error) => {
            console.error("Failed to load student progress:", error);
            setProgress(null);
          });
      }
    };
    const refreshAll = () => {
      console.log("Refreshing all data...");
      refreshRecentAttempts();
      refreshInProgressExam();
      refreshProgress();
      if (telegramUser) getUserStats(telegramUser.id).then(setStats);
    };
    refreshAll();
    window.addEventListener("mirkuz:exam-history-updated", refreshRecentAttempts);
    window.addEventListener("mirkuz:exam-progress-updated", refreshInProgressExam);
    window.addEventListener("mirkuz:progress-updated", refreshProgress);
    window.addEventListener("mirkuz:exam-attempt-saved", refreshAll);
    return () => {
      window.removeEventListener("mirkuz:exam-history-updated", refreshRecentAttempts);
      window.removeEventListener("mirkuz:exam-progress-updated", refreshInProgressExam);
      window.removeEventListener("mirkuz:progress-updated", refreshProgress);
      window.removeEventListener("mirkuz:exam-attempt-saved", refreshAll);
    };
  }, [telegramUser]);

  const firstName = telegramUser?.first_name || fullName.split(" ")[0] || "Student";
  const lastExam =
    inProgressExam ??
    stats?.last_exam ??
    (() => {
      try {
        return JSON.parse(localStorage.getItem("mirkuzLastExam") || "null") as ExamMeta | null;
      } catch {
        return null;
      }
    })();

  const examsTaken = stats?.exams_taken ?? 0;
  const avgScore = stats?.average_score;

  // Latest standardized score payload written by the exam runner.
  const lastResult =
    (() => {
      try {
        return JSON.parse(localStorage.getItem("mirkuzLastResult") || "null") as {
          examId: number;
          subject: string;
          year: string;
          scorePercentage: number;
          correctCount: number;
          totalQuestions: number;
          timeSpent: number;
        } | null;
      } catch {
        return null;
      }
    })() ?? null;
  const lastScore = lastResult?.scorePercentage ?? stats?.last_score ?? null;
  const gpa = lastScore == null ? null : Math.min(4, Math.max(0, lastScore / 25));

  if (reviewAttempt) {
    return <AttemptReview attempt={reviewAttempt} onBack={() => setReviewAttempt(null)} />;
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Greeting header */}
      <div className="px-5 pt-6 pb-5 bg-gradient-to-br from-[#1D70F5] to-[#4C8DFF] text-white rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-blue-100 text-xs">Welcome back,</p>
            <h1 className="text-xl font-bold">{firstName} 👋</h1>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Freshman {streamLabel(stream)}
          </span>
          {isPremium && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-amber-950 shadow-lg shadow-amber-900/10">
              <Crown className="w-3.5 h-3.5" /> Premium Active
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {!isPremium && <PremiumBanner onGetPremium={onGetPremium} />}

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your subjects</p>
              <h2 className="text-lg font-bold text-slate-900">Selected courses</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1D70F5]">{selectedSubjects.length}</span>
          </div>
          {selectedSubjects.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {selectedSubjects.map((subject) => (
                <div key={subject} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm font-semibold text-slate-700">
                  {subjectLabel(subject)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select subjects during onboarding or suggest one using “Other”.</p>
          )}
        </section>

        {/* XP, Level, and Streak Card */}
        {progress ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{progress.xp.toLocaleString()} XP</p>
                    <p className="text-xs text-slate-500">Level {progress.level} • {progress.rank.emoji} {progress.rank.name}</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${progress.progress_to_next_level.percent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right text-[11px] text-slate-500">{progress.progress_to_next_level.percent}% to Level {progress.level + 1}</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl px-3 py-2 border border-orange-200">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-xl font-bold text-orange-600">{progress.daily_streak}</p>
                    <p className="text-[10px] text-orange-400 font-medium">Day Streak</p>
                  </div>
                </div>
                {progress.frozen_streaks > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-cyan-50 rounded-lg px-2 py-1 border border-cyan-200">
                    <Shield className="w-4 h-4 text-cyan-600" />
                    <p className="text-xs font-semibold text-cyan-700">{progress.frozen_streaks} Freezes</p>
                  </div>
                )}
              </div>
            </div>
            {progress.badges.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {progress.badges.slice(0, 4).map((badge) => (
                  <span key={badge.name} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                    {badge.emoji} {badge.name}
                  </span>
                ))}
                {progress.badges.length > 4 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    +{progress.badges.length - 4} more
                  </span>
                )}
              </div>
            )}
          </section>
        ) : (
          /* Loading state or default when progress fails to load */
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">0 XP</p>
                    <p className="text-xs text-slate-500">Level 1 • 🥉 Bronze</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: "0%" }} />
                </div>
                <p className="mt-1.5 text-right text-[11px] text-slate-500">0% to Level 2</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl px-3 py-2 border border-orange-200">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-xl font-bold text-orange-600">0</p>
                    <p className="text-[10px] text-orange-400 font-medium">Day Streak</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {gpa !== null && (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Academic performance</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{gpa.toFixed(2)} <span className="text-base font-semibold text-slate-400">/ 4.00 GPA</span></p>
                <p className="mt-1 text-sm text-slate-500">Calculated from your exam score.</p>
              </div>
              <TrendingUp className="h-7 w-7 text-emerald-600" />
            </div>
          </section>
        )}

        <FlashCards />

        {/* Legacy average score fallback */}
        {grade <= 10 && progress?.average_score && (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Average Score</p>
                <p className="text-2xl font-bold text-slate-900">{progress.average_score.toFixed(1)}%</p>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-3" aria-label="Recently taken exams">
          <button
            type="button"
            aria-expanded={showRecentAttempts}
            onClick={() => setShowRecentAttempts((visible) => !visible)}
            className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Exam history</span>
              <span className="mt-1 block font-bold text-slate-900">Your last exams ({recentAttempts.length})</span>
            </span>
            <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${showRecentAttempts ? "rotate-180" : ""}`} />
          </button>
          {showRecentAttempts && (recentAttempts.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
              Completed exams will appear here for answer review.
            </p>
          ) : recentAttempts.slice(0, 5).map((attempt) => (
              <article key={attempt.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">
                      {subjectLabel(attempt.subject)} EUEE {attempt.year}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(attempt.completedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {attempt.scorePercentage}% • {attempt.correctCount}/{attempt.totalQuestions}
                  </span>
                </div>
                <button
                  onClick={() => setReviewAttempt(attempt)}
                  className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  <BookOpen className="w-4 h-4" /> Review Answers
                </button>
              </article>
          )))}
        </section>

        {/* Recent exam performance */}
        {(lastResult || lastScore != null) && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Recent Exam Performance
            </p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm truncate">
                  {lastResult
                    ? `${subjectLabel(lastResult.subject)} • ${lastResult.year}`
                    : lastExam?.title ?? "Last exam"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lastResult
                    ? `${lastResult.correctCount}/${lastResult.totalQuestions} correct`
                    : "Score recorded"}
                </p>
              </div>
              {lastScore != null && (
                <span className="text-xl font-bold text-[#1D70F5]">{lastScore}%</span>
              )}
            </div>
            {lastScore != null && (
              <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1D70F5] to-emerald-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, lastScore)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Continue hero card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          {lastExam ? (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Continue where you left off
              </p>
              <h3 className="font-bold text-slate-900 mb-1">{lastExam.title}</h3>
              <p className="text-xs text-slate-500 mb-4">
                {lastExam.question_count} questions • {lastExam.duration_minutes} min
              </p>
              <button
                onClick={() => onContinueExam(lastExam)}
                className="w-full bg-[#1D70F5] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Resume Exam <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Start your first exam</h3>
              <p className="text-xs text-slate-500 mb-4">
                Jump into a real EUEE past exam and track your progress.
              </p>
              <button
                onClick={onGoToPractice}
                className="w-full bg-[#1D70F5] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Practice Now <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Leaderboard */}
        <Leaderboard stream={stream} university={university} />
      </div>
    </div>
  );
}

function AttemptReview({ attempt, onBack }: { attempt: RecentExamAttempt; onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-4">
        <button onClick={onBack} className="mb-2 flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600">
          <ChevronLeft className="h-5 w-5" /> Recently Taken Exams
        </button>
        <h1 className="font-bold text-slate-900">{subjectLabel(attempt.subject)} EUEE {attempt.year}</h1>
        <p className="mt-1 text-xs text-slate-500">{attempt.scorePercentage}% • {attempt.correctCount}/{attempt.totalQuestions} correct</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {attempt.answers.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Detailed answer data is not available for this exam attempt.
          </p>
        ) : attempt.answers.map((question, index) => (
          <ReviewQuestion key={`${question.id}-${index}`} question={question} index={index} />
        ))}
      </div>
    </div>
  );
}

function ReviewQuestion({ question, index }: { question: ExamReviewQuestion; index: number }) {
  const isAnswerCorrect = question.selectedAnswer === question.correctAnswer;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{index + 1}</span>
        <MathContent html={question.questionText} className="text-sm font-semibold text-slate-900" />
      </div>
      <div className="space-y-2">
        {question.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === question.correctAnswer;
          const isSelected = optionIndex === question.selectedAnswer;
          return (
            <div key={optionIndex} className={`flex items-center gap-2 rounded-xl border-2 p-3 text-xs ${isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : isSelected ? "border-rose-400 bg-rose-50 text-rose-900" : "border-slate-100 text-slate-600"}`}>
              <span className="font-bold">{String.fromCharCode(65 + optionIndex)}.</span>
              <MathContent html={option} className="flex-1" />
              {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
            </div>
          );
        })}
      </div>
      {question.explanation && (
        <MathContent html={question.explanation} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950" />
      )}
      {!isAnswerCorrect && <p className="mt-2 text-xs font-semibold text-rose-700">Your answer was incorrect.</p>}
    </article>
  );
}
