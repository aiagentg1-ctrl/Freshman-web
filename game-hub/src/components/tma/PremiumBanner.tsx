"use client";

import { Crown, Sparkles } from "lucide-react";

export default function PremiumBanner({ onGetPremium }: { onGetPremium: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 shadow-sm">
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-200">
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Fresho Premium</p>
          </div>
          <h2 className="mt-1 text-sm font-extrabold text-slate-900">Study smarter. Prepare with confidence.</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Daily study plans, detailed notes, timed and untimed exams, and generated chapter questions.
          </p>
          <button
            type="button"
            onClick={onGetPremium}
            className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white active:scale-[0.98]"
          >
            Get Premium · 199 ETB / 5 months
          </button>
        </div>
      </div>
    </section>
  );
}
