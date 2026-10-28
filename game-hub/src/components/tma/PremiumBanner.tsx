"use client";

import { Crown, Sparkles } from "lucide-react";

export default function PremiumBanner({
  onGetPremium,
  onRefreshPremiumStatus,
  premiumVerificationError,
  premiumStatusRefreshing,
}: {
  onGetPremium: () => void;
  onRefreshPremiumStatus: () => void;
  premiumVerificationError?: string | null;
  premiumStatusRefreshing: boolean;
}) {
  const needsVerification = Boolean(premiumVerificationError);
  const actionLabel = needsVerification
    ? premiumStatusRefreshing ? "Checking..." : "Already joined? Check"
    : "Get Premium";
  return (
    <section className="premium-offer-banner relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-200">
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Fresho Premium</p>
          </div>
          <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">
            {needsVerification ? "Check your channel membership" : "Unlock your complete study space"}
          </p>
        </div>
        <button
          type="button"
          onClick={needsVerification ? onRefreshPremiumStatus : onGetPremium}
          disabled={needsVerification && premiumStatusRefreshing}
          className="min-h-10 shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      </div>
      {needsVerification && (
        <p role="status" className="mt-2 text-xs leading-5 text-amber-900">
          We could not verify your membership right now. Please try again; you do not need to register again.
        </p>
      )}
      {!needsVerification && (
        <button
          type="button"
          onClick={onRefreshPremiumStatus}
          disabled={premiumStatusRefreshing}
          className="mt-2 text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {premiumStatusRefreshing ? "Checking channel membership..." : "Already joined? Refresh Premium status"}
        </button>
      )}
    </section>
  );
}
