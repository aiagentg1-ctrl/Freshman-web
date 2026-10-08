"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const VOCABULARY = [
  { word: "Curious", pronunciation: "/ˈkjʊəriəs/", definition: "Eager to know or learn something.", example: "Mira is curious about how the universe formed." },
  { word: "Resilient", pronunciation: "/rɪˈzɪliənt/", definition: "Able to recover quickly from difficulty.", example: "The resilient team continued after the setback." },
  { word: "Allocate", pronunciation: "/ˈæləkəteɪt/", definition: "To distribute resources or duties for a particular purpose.", example: "We allocated more time to revision this week." },
  { word: "Evidence", pronunciation: "/ˈevɪdəns/", definition: "Facts or information that support a conclusion.", example: "The experiment provided strong evidence for the theory." },
  { word: "Essential", pronunciation: "/ɪˈsɛnʃəl/", definition: "Absolutely necessary or extremely important.", example: "Regular sleep is essential for concentration." },
  { word: "Perspective", pronunciation: "/pərˈspɛktɪv/", definition: "A particular way of viewing or understanding something.", example: "Travel gave her a new perspective on culture." },
];

export default function FlashCards() {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mirkuzVocabularyProgress") || "[]") as string[];
      setKnown(saved);
    } catch {
      setKnown([]);
    }
  }, []);

  const card = VOCABULARY[index];
  const progress = useMemo(() => Math.round(((index + 1) / VOCABULARY.length) * 100), [index]);

  const saveKnown = (word: string) => {
    const next = Array.from(new Set([...known, word]));
    setKnown(next);
    localStorage.setItem("mirkuzVocabularyProgress", JSON.stringify(next));
  };

  const changeCard = (direction: number) => {
    setIsOpen(false);
    setIndex((current) => (current + direction + VOCABULARY.length) % VOCABULARY.length);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-100">Study Service</p>
            <h2 className="text-base font-black">English Vocabulary</h2>
          </div>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">{known.length}/{VOCABULARY.length} known</span>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span>Card {index + 1} of {VOCABULARY.length}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="mt-4 flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-5 text-center transition-all hover:border-violet-400"
          aria-label="Flip vocabulary card"
        >
          <Sparkles className="mb-2 h-5 w-5 text-violet-500" />
          <span className="text-xl font-black text-slate-900">{isOpen ? card.definition : card.word}</span>
          <span className="mt-1 text-xs font-medium text-slate-500">
            {isOpen ? card.example : card.pronunciation}
          </span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => changeCard(-1)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            type="button"
            onClick={() => changeCard(1)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1D70F5] text-sm font-semibold text-white"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => saveKnown(card.word)}
          disabled={known.includes(card.word)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Check className="h-4 w-4" /> {known.includes(card.word) ? "Known" : "Mark as known"}
        </button>
      </div>
    </section>
  );
}
