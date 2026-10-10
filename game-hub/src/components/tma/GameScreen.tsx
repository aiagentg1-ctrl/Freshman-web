"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Crown, Medal, Sparkles, Trophy, Calculator, Layers, ChevronRight } from "lucide-react";
import { getFlashCard, getFlashCards, isPremiumAccessRequired, type FlashCard, type StreamKey } from "../../lib/api";
import {
  dueCardIds,
  loadDeckProgress,
  parseFlashcardDeck,
  rateFlashCard,
  reviewIntervalLabel,
  saveDeckProgress,
  type CardSchedule,
  type StudyFlashCard,
} from "../../lib/flashcards";
import Leaderboard from "./Leaderboard";
import GPACalculatorScreen from "./GPACalculatorScreen";

type GameView = "tools" | "flashcards" | "leaderboard" | "gpa";

export default function GameScreen({
  stream,
  university,
  isPremium,
  onGetPremium,
}: {
  stream: StreamKey;
  university: string;
  isPremium: boolean;
  onGetPremium: () => void;
}) {
  const [view, setView] = useState<GameView>("tools");
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashCard | null>(null);
  const [studyCards, setStudyCards] = useState<StudyFlashCard[]>([]);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CardSchedule>>({});
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  const [againThisSession, setAgainThisSession] = useState(0);
  const [deckError, setDeckError] = useState("");

  useEffect(() => {
    let active = true;
    getFlashCards()
      .then((data) => active && setCards(data))
      .catch(() => active && setCards([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const activeStudyCard = useMemo(
    () => studyCards.find((studyCard) => studyCard.id === reviewQueue[0]),
    [reviewQueue, studyCards],
  );
  const newCardCount = studyCards.filter((studyCard) => !schedules[studyCard.id]).length;

  const openDeck = async (deck: FlashCard) => {
    if (deck.is_premium && !isPremium) {
      onGetPremium();
      return;
    }
    setLoadingDeck(true);
    setDeckError("");
    try {
      const detail = await getFlashCard(deck.id);
      const parsedCards = parseFlashcardDeck(detail.html_content || "");
      const savedSchedules = loadDeckProgress(deck.id);
      setActiveDeck(deck);
      setStudyCards(parsedCards);
      setSchedules(savedSchedules);
      setReviewQueue(dueCardIds(parsedCards, savedSchedules));
      setReviewedThisSession(0);
      setAgainThisSession(0);
      setRevealed(false);
      setBrowseOpen(false);
    } catch (error) {
      if (isPremiumAccessRequired(error)) onGetPremium();
      else {
        console.error("Could not load flashcard deck:", error);
        setDeckError(error instanceof Error ? error.message : "Could not load this deck. Please try again.");
      }
    } finally {
      setLoadingDeck(false);
    }
  };

  const rateCurrentCard = (rating: "again" | "hard" | "good" | "easy") => {
    if (!activeStudyCard || !activeDeck) return;
    const nextSchedule = rateFlashCard(schedules[activeStudyCard.id], rating);
    const nextSchedules = { ...schedules, [activeStudyCard.id]: nextSchedule };
    try {
      saveDeckProgress(activeDeck.id, nextSchedules);
    } catch (error) {
      console.error("Could not save flashcard progress:", error);
      alert("Your rating could not be saved on this device. Check available browser storage and try again.");
      return;
    }
    setSchedules(nextSchedules);
    setReviewQueue((queue) => {
      const remaining = queue.slice(1);
      return rating === "again" ? [...remaining, activeStudyCard.id] : remaining;
    });
    setReviewedThisSession((count) => count + 1);
    if (rating === "again") setAgainThisSession((count) => count + 1);
    setRevealed(false);
  };

  if (view === "gpa") {
    return <GPACalculatorScreen onClose={() => setView("tools")} />;
  }

  if (view === "leaderboard") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => setView("tools")}
            className="flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" /> Back to Tools
          </button>
          <h1 className="mt-2 text-xl font-bold text-slate-900">University Leaderboard</h1>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <Leaderboard stream={stream} university={university} />
        </div>
      </div>
    );
  }

  if (view === "flashcards") {
    const nextDueAt = Object.values(schedules)
      .map((schedule) => schedule.dueAt)
      .filter((dueAt) => dueAt > Date.now())
      .sort((left, right) => left - right)[0];

    return (
      <div className="flex flex-col flex-1 min-h-0">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => {
              if (activeDeck) {
                setActiveDeck(null);
                setStudyCards([]);
                setReviewQueue([]);
                setSchedules({});
              } else {
                setView("tools");
              }
              setDeckError("");
            }}
            className="flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" /> {activeDeck ? "All flashcard decks" : "Back to Tools"}
          </button>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{activeDeck?.title || "Flash Cards"}</h1>
        </header>
        <div className="flex-1 space-y-4 px-4 py-5">
          <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-violet-500 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">Spaced repetition</p>
                  <h2 className="text-base font-black">{activeDeck ? "Review session" : "Choose a deck"}</h2>
                </div>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                {activeDeck ? `${studyCards.length} cards` : `${cards.length} decks`}
              </span>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="py-10 text-center text-sm text-slate-400">Loading flash cards...</div>
              ) : cards.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 py-10 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-violet-400" />
                  <h3 className="mt-2 font-bold text-slate-800">No flash cards yet</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Admin content will appear here after it is published.</p>
                </div>
              ) : (
                <>
                  {deckError && (
                    <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {deckError}
                    </p>
                  )}
                  {activeDeck ? (
                    <>
                      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-violet-50 p-2">
                          <p className="text-lg font-black text-violet-700">{reviewQueue.length}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-2">
                          <p className="text-lg font-black text-emerald-700">{reviewedThisSession}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Reviewed</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 p-2">
                          <p className="text-lg font-black text-rose-700">{againThisSession}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Again</p>
                        </div>
                      </div>

                      {activeStudyCard ? (
                        <>
                          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                            <span>{reviewedThisSession + 1} reviewed this session</span>
                            <span>{activeStudyCard.tag || activeStudyCard.partOfSpeech || "Review"}</span>
                          </div>
                          <div className="min-h-52 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-5">
                            <div className="flex min-h-40 flex-col items-center justify-center text-center">
                              <p className="text-xl font-black leading-snug text-slate-900">{activeStudyCard.front}</p>
                              {activeStudyCard.partOfSpeech && (
                                <p className="mt-2 text-sm italic text-violet-700">{activeStudyCard.partOfSpeech}</p>
                              )}
                              {!revealed && (
                                <button
                                  type="button"
                                  onClick={() => setRevealed(true)}
                                  className="mt-6 min-h-11 rounded-xl bg-violet-600 px-6 text-sm font-bold text-white"
                                >
                                  Show answer
                                </button>
                              )}
                            </div>
                            {revealed && (
                              <div className="mt-2 border-t border-violet-200 pt-4 text-sm leading-6 text-slate-700">
                                <p className="whitespace-pre-wrap font-semibold">{activeStudyCard.back}</p>
                                {activeStudyCard.examples.length > 0 && (
                                  <div className="mt-3">
                                    <p className="font-bold text-slate-800">Examples</p>
                                    <ul className="list-disc space-y-1 pl-5">
                                      {activeStudyCard.examples.map((example, index) => <li key={`${index}-${example}`}>{example}</li>)}
                                    </ul>
                                  </div>
                                )}
                                {activeStudyCard.examTip && (
                                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                                    <strong>Exam tip:</strong> {activeStudyCard.examTip}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {revealed && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {([
                                ["again", "Again", reviewIntervalLabel(schedules[activeStudyCard.id], "again"), "bg-rose-500"],
                                ["hard", "Hard", reviewIntervalLabel(schedules[activeStudyCard.id], "hard"), "bg-orange-500"],
                                ["good", "Good", reviewIntervalLabel(schedules[activeStudyCard.id], "good"), "bg-emerald-600"],
                                ["easy", "Easy", reviewIntervalLabel(schedules[activeStudyCard.id], "easy"), "bg-blue-600"],
                              ] as const).map(([rating, label, interval, color]) => (
                                <button
                                  key={rating}
                                  type="button"
                                  onClick={() => rateCurrentCard(rating)}
                                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl ${color} text-white`}
                                >
                                  <span className="text-sm font-black">{label}</span>
                                  <span className="text-[10px] opacity-90">{interval}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-2xl bg-emerald-50 px-5 py-7 text-center">
                          <Sparkles className="mx-auto h-7 w-7 text-emerald-600" />
                          <h3 className="mt-2 font-black text-slate-900">You&apos;re done for now</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {newCardCount === 0 && nextDueAt
                              ? `Next review: ${new Date(nextDueAt).toLocaleString()}`
                              : "Come back when your next cards are due."}
                          </p>
                          <button
                            type="button"
                            onClick={() => setBrowseOpen((open) => !open)}
                            className="mt-4 min-h-10 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-800"
                          >
                            {browseOpen ? "Hide all cards" : "Browse all cards"}
                          </button>
                        </div>
                      )}

                      {activeStudyCard && (
                        <button
                          type="button"
                          onClick={() => setBrowseOpen((open) => !open)}
                          className="mt-4 min-h-10 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                        >
                          {browseOpen ? "Hide all cards" : "Browse all cards"}
                        </button>
                      )}
                      {browseOpen && (
                        <div className="mt-3 space-y-2">
                          {studyCards.map((studyCard, index) => (
                            <article key={studyCard.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                              <p className="font-bold text-slate-900">{index + 1}. {studyCard.front}</p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-600">{studyCard.back}</p>
                              {studyCard.examTip && <p className="mt-2 text-xs text-amber-800">Exam tip: {studyCard.examTip}</p>}
                            </article>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      {cards.map((deck) => (
                        <button
                          key={deck.id}
                          type="button"
                          disabled={loadingDeck}
                          onClick={() => void openDeck(deck)}
                          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3 text-left disabled:opacity-60"
                        >
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${deck.is_premium ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-600"}`}>
                            {deck.is_premium ? <Crown className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900">{deck.title}</span>
                            <span className="mt-1 block text-[10px] font-bold uppercase text-slate-500">
                              {deck.is_premium ? "Premium deck" : "Free deck"}
                            </span>
                          </span>
                          {loadingDeck ? <span className="text-xs text-slate-500">Loading...</span> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-5 pb-6 pt-7 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-100">Tools & Games</p>
            <h1 className="text-2xl font-black">Study smarter</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-violet-100">GPA calculator, flash cards, and more tools to help you succeed.</p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-5">
        {/* Tools Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setView("gpa")}
            className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 text-white">
              <Calculator className="h-6 w-6" />
            </span>
            <span className="text-sm font-black text-slate-900">GPA Calculator</span>
            <span className="text-xs text-slate-500">Calculate your semester GPA</span>
          </button>

          <button
            type="button"
            onClick={() => setView("flashcards")}
            className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500 text-white">
              <Layers className="h-6 w-6" />
            </span>
            <span className="text-sm font-black text-slate-900">Flash Cards</span>
            <span className="text-xs text-slate-500">{cards.length} decks available</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setView("leaderboard")}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-left shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-white">
            <Medal className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-black text-slate-900">View leaderboard</span>
            <span className="block text-xs text-slate-500">See your university ranking</span>
          </span>
          <Crown className="h-4 w-4 text-amber-500" />
        </button>
      </div>
    </div>
  );
}
