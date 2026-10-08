"use client";

import { Check, Crown, Sparkles, X } from "lucide-react";

const PLAN = [
  "Personalized study plan every day",
  "Detailed clean notes explained like a teacher",
  "Timed and untimed mid-exam practice",
  "Final exam preparation for 10+ universities",
  "Chapter-based questions generated after every note",
  "AAU Student special preparation space",
  "Semester video updates and study sessions",
];

export default function PremiumDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="premium-title" className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-6 pb-7 pt-8 text-center text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            aria-label="Close premium offer"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Crown className="h-8 w-8" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-100">
            <Sparkles className="h-4 w-4" /> Limited subscription
          </div>
          <h2 id="premium-title" className="mt-2 text-2xl font-black">Fresho Premium</h2>
          <p className="mt-2 text-sm text-violet-100">One subscription. Every study resource you need.</p>
        </div>

        <div className="p-5">
          <div className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">5 month subscription</p>
            <div className="mt-1 flex items-end justify-center gap-2">
              <span className="text-4xl font-black text-slate-900">199 ETB</span>
              <span className="pb-1 text-sm font-bold text-slate-400 line-through decoration-2">300 ETB</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">The 300 ETB price is crossed out. Only 199 ETB is available.</p>
          </div>

          <ul className="mt-5 space-y-3">
            {PLAN.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm leading-5 text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-700">
            AAU students receive a special preparation space with online AAU final and mid-exam resources that are not available elsewhere.
          </div>

          <button
            type="button"
            className="mt-5 min-h-12 w-full rounded-xl bg-[#1D70F5] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 active:scale-[0.98]"
            onClick={onClose}
          >
            Continue with Premium
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-400">You can be promoted randomly while using the app or downloading study material.</p>
        </div>
      </section>
    </div>
  );
}
