"use client";

import { useEffect, useState } from "react";
import { Flame, Lock, RefreshCw, X } from "lucide-react";
import BottomNav, { Tab } from "../../components/tma/BottomNav";
import HomeScreen from "../../components/tma/HomeScreen";
import NotesScreen from "../../components/tma/NotesScreen";
import OnboardingScreen from "../../components/tma/OnboardingScreen";
import PracticeScreen from "../../components/tma/PracticeScreen";
import ProfileScreen from "../../components/tma/ProfileScreen";
import { DevUserSetup } from "../../components/DevUserSetup";
import { dailyCheckIn, DailyCheckIn, ExamMeta, getUser, releaseDeviceSession, startDeviceSession, StreamKey, updateUser } from "../../lib/api";
import { expandTelegramApp, getTelegramInitData, getTelegramUser, TelegramUser } from "../../lib/telegram";
import PremiumDialog from "../../components/tma/PremiumDialog";

interface LocalProfile {
  full_name: string;
  custom_name?: string;
  university?: string;
  region?: string;
  school?: string;
  city?: string;
  grade: number;
  stream: StreamKey;
  selected_subjects: string[];
  premium_expires_at?: string | null;
}

const VALID_STREAMS: StreamKey[] = ["general", "natural", "social"];

function isCompleteProfile(
  p: { grade?: number | null; stream?: string | null; selected_subjects?: string[] } | null
): p is LocalProfile {
  return (
    !!p &&
    p.grade === 12 &&
    VALID_STREAMS.includes((p.stream || "").toLowerCase() as StreamKey) &&
    Array.isArray(p.selected_subjects) &&
    p.selected_subjects.length > 0
  );
}

export default function TMAPage() {
  const browserDemoMode = process.env.NEXT_PUBLIC_BROWSER_DEMO_MODE === "true";
  const browserDemoUserId = Number(process.env.NEXT_PUBLIC_BROWSER_DEMO_USER_ID || "900000001");
  const [activeTab, setActiveTab] = useState<Tab>("practice");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [resumeExam, setResumeExam] = useState<ExamMeta | null>(null);
  const [streakPrompt, setStreakPrompt] = useState<DailyCheckIn | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<"checking" | "active" | "locked" | "auth_required" | "signed_out" | "error">("checking");
  const [deviceError, setDeviceError] = useState("");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  useEffect(() => {
    expandTelegramApp();
    const tgUser = getTelegramUser();
    const demoUser = browserDemoMode
      ? { id: browserDemoUserId, first_name: "Demo Student" }
      : null;
    const effectiveUser = tgUser || demoUser;
    setTelegramUser(effectiveUser);
    const initData = getTelegramInitData();
    if (browserDemoMode && !initData) {
      localStorage.setItem("freshoTelegramUserId", String(browserDemoUserId));
      setDeviceStatus("active");
      setBooting(false);
      return;
    }
    if (!tgUser?.id || !initData) {
      setDeviceStatus("auth_required");
      setDeviceError("Open the app using the Study for Final/mid exam button in the Telegram bot.");
      setBooting(false);
      return;
    }

    let cancelled = false;
    const claimSession = async () => {
      setBooting(true);
      setDeviceStatus("checking");
      setDeviceError("");
      try {
        let deviceId = localStorage.getItem("freshoDeviceId");
        if (!deviceId) {
          deviceId = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem("freshoDeviceId", deviceId);
        }

        const session = await startDeviceSession({
          init_data: initData,
          device_id: deviceId,
          session_token: localStorage.getItem("freshoDeviceSessionToken") || undefined,
        });
        if (cancelled) return;
        localStorage.setItem("freshoDeviceSessionToken", session.session_token);
        localStorage.setItem("freshoTelegramUserId", String(session.user_id));
        setDeviceStatus("active");

        const remote = await getUser(session.user_id);
        if (remote && isCompleteProfile({ grade: remote.grade, stream: remote.stream })) {
          setProfile({
            full_name: remote.full_name,
            custom_name: remote.custom_name || undefined,
            university: remote.university || "",
            region: remote.region || "",
            school: remote.school || "",
            city: remote.city || "",
            grade: remote.grade,
            stream: remote.stream.toLowerCase() as StreamKey,
            selected_subjects: remote.selected_subjects || [],
            premium_expires_at: remote.premium_expires_at || null,
          });
        } else {
          try {
            const saved = JSON.parse(localStorage.getItem("freshoProfile") || "null") as LocalProfile | null;
            if (isCompleteProfile(saved)) setProfile(saved);
            else setProfile(null);
          } catch {
            setProfile(null);
          }
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not verify this Fresho session.";
        if (message.includes("FRESHO_DEVICE_ACTIVE_ON_ANOTHER_DEVICE")) {
          setDeviceStatus("locked");
          setDeviceError("This Fresho account is active on another device. Sign out there before using Fresho here.");
        } else {
          setDeviceStatus("error");
          setDeviceError(message);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    void claimSession();
    return () => {
      cancelled = true;
    };
  }, [sessionRetry]);

  useEffect(() => {
    const userId = telegramUser?.id;
    if (!userId || !profile) return;

    let cancelled = false;
    dailyCheckIn(userId)
      .then((checkIn) => {
        if (cancelled) return;
        window.dispatchEvent(new Event("mirkuz:progress-updated"));
        if (!checkIn.is_new_day) return;

        const popupKey = `mirkuzStreakPopup:${userId}:${checkIn.checked_in_date}`;
        if (sessionStorage.getItem(popupKey) !== "1") {
          sessionStorage.setItem(popupKey, "1");
          setStreakPrompt(checkIn);
        }
      })
      .catch((error) => console.error("Daily streak check-in failed:", error));

    return () => {
      cancelled = true;
    };
  }, [telegramUser?.id, profile]);

  const handleOnboardingComplete = async (stream: Exclude<StreamKey, "general">, selected_subjects: string[], university: string, region: string) => {
    const fullName = telegramUser
      ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
      : "";
    const next: LocalProfile = {
      full_name: fullName,
      custom_name: undefined,
      university,
      region,
      school: "",
      city: "",
      grade: 12,
      stream,
      selected_subjects,
      premium_expires_at: null,
    };
    localStorage.setItem("mirkuzProfile", JSON.stringify(next));
    if (telegramUser) {
      try {
        await updateUser(telegramUser.id, {
          first_name: telegramUser.first_name,
          full_name: fullName,
          university,
          region,
          grade: 12,
          stream,
          selected_subjects,
        });
      } catch (error) {
        console.error("Failed to save onboarding profile:", error);
      }
    }
    setProfile(next);
  };

  const handleProfileChange = (next: LocalProfile) => {
    setProfile(next);
  };

  const handleDeviceSignOut = async () => {
    const initData = getTelegramInitData();
    const deviceId = localStorage.getItem("freshoDeviceId");
    const sessionToken = localStorage.getItem("freshoDeviceSessionToken");
    if (initData && deviceId && sessionToken) {
      await releaseDeviceSession({ init_data: initData, device_id: deviceId, session_token: sessionToken });
    }
    localStorage.removeItem("freshoDeviceSessionToken");
    setProfile(null);
    setDeviceStatus("signed_out");
  };

  const handleContinueExam = (exam: ExamMeta) => {
    setResumeExam(exam);
    setActiveTab("practice");
  };

  const isPremium = (() => {
    if (!profile?.premium_expires_at) return false;
    const expiry = new Date(profile.premium_expires_at).getTime();
    return Number.isFinite(expiry) && expiry > Date.now();
  })();

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#F8FAFC] shadow-2xl relative flex flex-col font-sans pb-24 text-slate-900">
      <DevUserSetup />
      {booting ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D70F5]" />
        </div>
      ) : deviceStatus !== "active" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            {deviceStatus === "locked" ? "Fresho is active elsewhere" : deviceStatus === "signed_out" ? "Signed out" : "Fresho needs Telegram"}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{deviceStatus === "signed_out" ? "This device has released the active Fresho session." : deviceError}</p>
          {(deviceStatus === "locked" || deviceStatus === "signed_out" || deviceStatus === "error") && (
            <button
              type="button"
              onClick={() => setSessionRetry((retry) => retry + 1)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          )}
        </div>
      ) : !profile ? (
        // Setup modal always shows before the tabs until grade/stream is chosen.
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (
        <>
          {activeTab === "practice" && (
            <PracticeScreen
              stream={profile.stream}
              grade={profile.grade}
              telegramUserId={telegramUser?.id}
              telegramFirstName={telegramUser?.first_name}
              resumeExam={resumeExam}
              isPremium={isPremium}
              onResumeHandled={() => setResumeExam(null)}
              onGoHome={() => setActiveTab("home")}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "notes" && (
            <NotesScreen
              stream={profile.stream}
              grade={profile.grade}
              telegramUserId={telegramUser?.id}
              isPremium={isPremium}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "home" && (
            <HomeScreen
              telegramUser={telegramUser}
              fullName={profile.custom_name || profile.full_name}
              grade={profile.grade}
              stream={profile.stream}
              isPremium={isPremium}
              onContinueExam={handleContinueExam}
              onGoToPractice={() => setActiveTab("practice")}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "profile" && (
            <ProfileScreen
              telegramUser={telegramUser}
              fullName={profile.full_name}
              customName={profile.custom_name}
              initialUniversity={profile.university}
              initialRegion={profile.region}
              initialSchool={profile.school}
              initialCity={profile.city}
              grade={profile.grade}
              stream={profile.stream}
              selectedSubjects={profile.selected_subjects}
              isPremium={isPremium}
              onProfileChange={handleProfileChange}
              onSignOut={handleDeviceSignOut}
            />
          )}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      )}
      {showPremiumDialog && <PremiumDialog onClose={() => setShowPremiumDialog(false)} />}
      {streakPrompt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-5 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setStreakPrompt(null);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="streak-title" className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-red-600 px-6 pb-7 pt-8 text-center text-white">
              <button
                type="button"
                onClick={() => setStreakPrompt(null)}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Close streak message"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15">
                <Flame className="h-9 w-9" />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-orange-100">New day · check-in saved</p>
              <h2 id="streak-title" className="mt-1 text-3xl font-extrabold">{streakPrompt.daily_streak} day{streakPrompt.daily_streak === 1 ? "" : "s"}</h2>
              <p className="mt-1 text-sm text-white/85">Your learning streak is still burning.</p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Streak freezes</span>
                <span className="text-sm font-bold text-orange-700">{streakPrompt.frozen_streaks}</span>
              </div>
              <button type="button" onClick={() => setStreakPrompt(null)} className="mt-4 min-h-11 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Let&apos;s study
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
