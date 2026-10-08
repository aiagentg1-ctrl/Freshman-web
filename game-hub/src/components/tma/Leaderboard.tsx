"use client";

import { useEffect, useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { getLeaderboard, LeaderboardEntry, StreamKey } from "../../lib/api";
import UniversityLogo from "./UniversityLogo";

export default function Leaderboard({ stream, university }: { stream: StreamKey; university: string }) {
  const [period, setPeriod] = useState<"weekly" | "all_time">("all_time");
  const [leaderboardType, setLeaderboardType] = useState<"score" | "xp">("score");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userId, setUserId] = useState<number | undefined>();

  useEffect(() => {
    const savedUserId = Number(localStorage.getItem("mirkuzTelegramUserId"));
    if (Number.isSafeInteger(savedUserId) && savedUserId > 0) setUserId(savedUserId);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      setLoading(true);
      setLoadError(null);
      getLeaderboard(period, leaderboardType, userId, stream, university).then((data) => {
        if (!active) return;
        setEntries(data);
      }).catch((error: unknown) => {
        if (!active) return;
        setEntries([]);
        setLoadError(error instanceof Error ? error.message : "Leaderboard request failed.");
      }).finally(() => {
        if (active) setLoading(false);
      });
    };

    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("mirkuz:exam-attempt-saved", refresh);
    window.addEventListener("mirkuz:profile-updated", refresh);
    window.addEventListener("mirkuz:progress-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("mirkuz:exam-attempt-saved", refresh);
      window.removeEventListener("mirkuz:profile-updated", refresh);
      window.removeEventListener("mirkuz:progress-updated", refresh);
    };
  }, [leaderboardType, period, refreshKey, stream, university, userId]);

  const getRankBadge = (rank: number, isPremium = false) => {
    if (isPremium) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-200">
          <Crown className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-200">
          <Crown className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-md">
          <Medal className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-md">
          <Trophy className="w-4 h-4 text-white" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
        <span className="text-xs font-bold text-slate-600">{rank}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          🏆 {leaderboardType === "xp"
            ? "Global XP Leaderboard"
            : `${stream === "natural" ? "Natural" : stream === "social" ? "Social" : "General"} Score Leaderboard`}
        </p>
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(["score", "xp"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLeaderboardType(type)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${leaderboardType === type ? "bg-white text-[#1D70F5] shadow-sm" : "text-slate-500"}`}
            >
              {type === "score" ? "Scores" : "XP"}
            </button>
          ))}
        </div>
      </div>
      {leaderboardType === "score" && (
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setPeriod("weekly")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              period === "weekly"
                ? "bg-white text-[#1D70F5] shadow-sm"
                : "text-slate-500"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod("all_time")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              period === "all_time"
                ? "bg-white text-[#1D70F5] shadow-sm"
                : "text-slate-500"
            }`}
          >
            All-Time
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-xs">Loading...</div>
      ) : loadError ? (
        <div className="py-6 text-center">
          <p role="alert" className="text-sm text-rose-700">Could not load leaderboard: {loadError}</p>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="mt-3 min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No scores yet. Be the first!
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${entry.is_current_user ? "border-[#1D70F5] bg-blue-50" : "border-slate-100 bg-slate-50"}`}
            >
              {getRankBadge(entry.rank, entry.is_premium)}
              <UniversityLogo university={entry.university || "University"} logo={entry.university_logo} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-semibold text-slate-900">{entry.display_name}</h4>
                  {entry.is_premium && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">Premium</span>
                  )}
                  {entry.is_current_user && <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#1D70F5]">You</span>}
                </div>
                {(entry.university || entry.region) && (
                  <p className="text-xs text-slate-500 truncate">
                    {entry.university && entry.region
                      ? `${entry.university} • ${entry.region}`
                      : entry.university || entry.region}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-[#1D70F5]">
                  {leaderboardType === "xp" ? `${entry.xp ?? 0} XP` : `${entry.best_score ?? entry.avg_score ?? 0}%`}
                </span>
                <p className="text-[10px] text-slate-400">
                  {leaderboardType === "xp"
                    ? `Level ${entry.level ?? 1} • ${entry.rank_info?.name ?? "Bronze"}`
                    : `${entry.attempt_count ?? 0} exams`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
