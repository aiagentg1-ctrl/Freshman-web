"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, Crown, Medal, Sparkles, Trophy } from "lucide-react";
import { getFlashCards, type FlashCard, type StreamKey } from "../../lib/api";
import HtmlViewer from "./HtmlViewer";
import Leaderboard from "./Leaderboard";

export default function GameScreen({
  stream,
  university,
}: {
  stream: StreamKey;
  university: string;
}) {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [activeCard, setActiveCard] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getFlashCards()
      .then((data) => active && setCards(data))
      .catch(() => active && setCards([]))
      .finally(() => active && setLoading(false));
    try {
      setKnown(JSON.parse(localStorage.getItem("mirkuzGameKnownCards") || "[]") as string[]);
    } catch {
      setKnown([]);
    }
    return () => {
      active = false;
    };
  }, []);

  const card = cards[activeCard];
  const changeCard = (direction: number) => {
    setActiveCard((current) => (current + direction + cards.length) % cards.length);
    setRevealed(false);
  };

  const markKnown = () => {
    if (!card) return;
    const next = Array.from(new Set([...known, String(card.id)]));
    setKnown(next);
    localStorage.setItem("mirkuzGameKnownCards", JSON.stringify(next));
  };

  if (showLeaderboard) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => setShowLeaderboard(false)}
            className="flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" /> Back to Game
          </button>
          <h1 className="mt-2 text-xl font-bold text-slate-900">University Leaderboard</h1>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <Leaderboard stream={stream} university={university} />
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-100">Study Game</p>
            <h1 className="text-2xl font-black">Learn. Play. Rank.</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-violet-100">Practice with admin-authored flash cards and compete with your university.</p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-5">
        <button
          type="button"
          onClick={() => setShowLeaderboard(true)}
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

        <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-violet-500 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">Flash cards</p>
                <h2 className="text-base font-black">Quick review</h2>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">{cards.length} cards</span>
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
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Card {activeCard + 1} of {cards.length}</span>
                  <span>{known.length}/{cards.length} known</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealed((value) => !value)}
                  className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-5 text-center"
                >
                  <Sparkles className="mb-2 h-5 w-5 text-violet-500" />
                  <span className="text-sm font-black text-slate-900">{card.title}</span>
                  <span className="mt-2 max-w-full overflow-hidden text-xs text-slate-500">
                    {revealed ? "Tap to hide the answer" : "Tap to reveal the answer"}
                  </span>
                  {revealed && (
                    <span className="mt-3 h-28 w-full overflow-y-auto rounded-xl bg-white p-3 text-left shadow-sm">
                      <HtmlViewer html={card.html_content} className="text-sm leading-6 text-slate-700" />
                    </span>
                  )}
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => changeCard(-1)} className="min-h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Previous</button>
                  <button type="button" onClick={() => changeCard(1)} className="min-h-11 rounded-xl bg-[#1D70F5] text-sm font-semibold text-white">Next</button>
                </div>
                <button
                  type="button"
                  onClick={markKnown}
                  disabled={known.includes(String(card.id))}
                  className="mt-2 min-h-11 w-full rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {known.includes(String(card.id)) ? "Card marked as known" : "Mark as known"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
