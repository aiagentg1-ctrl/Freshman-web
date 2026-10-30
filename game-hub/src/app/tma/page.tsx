"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Lock, RefreshCw, X } from "lucide-react";
import BottomNav, { Tab } from "../../components/tma/BottomNav";
import HomeScreen from "../../components/tma/HomeScreen";
import NotesScreen from "../../components/tma/NotesScreen";
import OnboardingScreen from "../../components/tma/OnboardingScreen";
import PracticeScreen from "../../components/tma/PracticeScreen";
import ProfileScreen from "../../components/tma/ProfileScreen";
import GameScreen from "../../components/tma/GameScreen";
import { DevUserSetup } from "../../components/DevUserSetup";
import { dailyCheckIn, DailyCheckIn, ExamMeta, getSubscriptionPricing, getUser, refreshUser, releaseDeviceSession, startDeviceSession, StreamKey, SubscriptionPricing, updateUser } from "../../lib/api";
import { expandTelegramApp, getTelegramInitData, getTelegramUser, TelegramUser } from "../../lib/telegram";
import { migrateLegacyStorage } from "../../lib/legacyStorage";
import PremiumDialog from "../../components/tma/PremiumDialog";

interface LocalProfile {
  full_name: string;
  custom_name?: string;
  university: string;
  region?: string;
  school?: string;
  city?: string;
  stream: StreamKey;
  selected_subjects: string[];
  is_premium: boolean;
  premium_verification_error?: string | null;
}

const VALID_STREAMS: StreamKey[] = ["natural", "social"];

function isCompleteProfile(
  p: {
    stream?: string | null;
    selected_subjects?: string[];
    university?: string | null;
  } | null
): p is LocalProfile {
  return (
    !!p &&
    typeof p.university === "string" &&
    p.university.trim().length > 0 &&
    VALID_STREAMS.includes((p.stream || "").toLowerCase() as StreamKey) &&
    Array.isArray(p.selected_subjects)
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
  const [subscriptionPricing, setSubscriptionPricing] = useState<SubscriptionPricing | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [premiumStatusRefreshing, setPremiumStatusRefreshing] = useState(false);
  const [premiumStatusError, setPremiumStatusError] = useState("");
  const premiumRefreshAt = useRef(0);

  useEffect(() => {
    setDarkMode(localStorage.getItem("freshoTheme") === "dark");
  }, []);

  useEffect(() => {
    getSubscriptionPricing()
      .then(setSubscriptionPricing)
      .catch((error) => console.error("Could not load premium subscription price:", error));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("fresho-dark", darkMode);
    localStorage.setItem("freshoTheme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    migrateLegacyStorage();
    expandTelegramApp();
    const tgUser = getTelegramUser();
    const demoUser = browserDemoMode
      ? { id: browserDemoUserId, first_name: "Demo Student" }
      : null;
    const effectiveUser = tgUser || demoUser;
    setTelegramUser(effectiveUser);
    const initData = getTelegramInitData();

    console.log("=== TMA Page Init ===");
    console.log("Browser Demo Mode:", browserDemoMode);
    console.log("Telegram User:", tgUser);
    console.log("Init Data present:", !!initData);
    console.log("Init Data length:", initData?.length);
    console.log("Demo User:", demoUser);
    console.log("Effective User:", effectiveUser);

    // TEMPORARY: Allow testing without Telegram auth for debugging
    if (!tgUser?.id && !browserDemoMode) {
      console.log("WARNING: No Telegram user - using fallback for testing");
      const testUserId = localStorage.getItem("freshoTelegramUserId");
      if (testUserId) {
        setTelegramUser({ id: Number(testUserId), first_name: "Test User" });
        setDeviceStatus("active");
        setBooting(false);
        return;
      }
    }

    if (browserDemoMode && !initData) {
      localStorage.setItem("freshoTelegramUserId", String(browserDemoUserId));
      setDeviceStatus("active");
      setBooting(false);
      return;
    }
    if (!tgUser?.id || !initData) {
      console.log("Auth required - missing user or init data");
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

        console.log("=== Starting Device Session ===");
        console.log("Init Data (first 100 chars):", initData.substring(0, 100));
        console.log("Device ID:", deviceId);
        console.log("Session Token:", localStorage.getItem("freshoDeviceSessionToken") ? "Present" : "None");

        const session = await startDeviceSession({
          init_data: initData,
          device_id: deviceId,
          session_token: localStorage.getItem("freshoDeviceSessionToken") || undefined,
        });

        console.log("Session response:", session);
        if (cancelled) return;
        localStorage.setItem("freshoDeviceSessionToken", session.session_token);
        localStorage.setItem("freshoTelegramUserId", String(session.user_id));
        setDeviceStatus("active");

        const remote = await getUser(session.user_id);
        if (remote && isCompleteProfile({ stream: remote.stream, university: remote.university, selected_subjects: remote.selected_subjects })) {
          setProfile({
            full_name: remote.full_name,
            custom_name: remote.custom_name || undefined,
            university: remote.university || "",
            region: remote.region || "",
            school: remote.school || "",
            city: remote.city || "",
            stream: remote.stream.toLowerCase() as StreamKey,
            selected_subjects: remote.selected_subjects || [],
            is_premium: remote.is_premium === true,
            premium_verification_error: remote.premium_verification_error ?? null,
          });
        } else {
          let saved: LocalProfile | null = null;
          try {
            saved = JSON.parse(localStorage.getItem("freshoProfile") || "null") as LocalProfile | null;
          } catch {
            saved = null;
          }
          if (isCompleteProfile(saved)) {
            const restored = await updateUser(session.user_id, {
              first_name: tgUser?.first_name,
              full_name: saved.full_name,
              custom_name: saved.custom_name,
              university: saved.university,
              region: saved.region,
              school: saved.school,
              city: saved.city,
              stream: saved.stream,
              selected_subjects: saved.selected_subjects,
            });
            if (cancelled) return;
            setProfile({
              ...saved,
              full_name: restored.full_name,
              custom_name: restored.custom_name || undefined,
              university: restored.university || "",
              region: restored.region || "",
              school: restored.school || "",
              city: restored.city || "",
              stream: restored.stream.toLowerCase() as StreamKey,
              selected_subjects: restored.selected_subjects || [],
              is_premium: restored.is_premium === true,
              premium_verification_error: restored.premium_verification_error ?? null,
            });
          } else {
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
        window.dispatchEvent(new Event("fresho:progress-updated"));
        if (!checkIn.is_new_day) return;

        const popupKey = `freshoStreakPopup:${userId}:${checkIn.checked_in_date}`;
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
      stream,
      selected_subjects,
      is_premium: false,
    };
    if (telegramUser) {
      const savedProfile = await updateUser(telegramUser.id, {
        first_name: telegramUser.first_name,
        full_name: fullName,
        university,
        region,
        stream,
        selected_subjects,
      });
      next.is_premium = savedProfile.is_premium === true;
      next.premium_verification_error = savedProfile.premium_verification_error ?? null;
    }
    localStorage.setItem("freshoProfile", JSON.stringify(next));
    setProfile(next);
  };

  const handleProfileChange = (next: Omit<LocalProfile, "is_premium">) => {
    setProfile((current) => current ? { ...current, ...next } : current);
  };

  const handlePremiumAccessGranted = () => {
    setProfile((current) => current ? {
      ...current,
      is_premium: true,
      premium_verification_error: null,
    } : current);
    setPremiumStatusError("");
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

  const handleDeviceTakeover = async () => {
    const initData = getTelegramInitData();
    if (!initData || !telegramUser?.id) {
      setDeviceError("Open Fresho from your Telegram account before moving the session to this device.");
      return;
    }

    setBooting(true);
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
        take_over: true,
      });
      localStorage.setItem("freshoDeviceSessionToken", session.session_token);
      localStorage.setItem("freshoTelegramUserId", String(session.user_id));
      setSessionRetry((retry) => retry + 1);
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : "Could not move the Fresho session to this device.");
      setBooting(false);
    }
  };

  const refreshPremiumStatus = useCallback(async () => {
    const userId = telegramUser?.id;
    if (!userId || premiumStatusRefreshing) return;
    setPremiumStatusRefreshing(true);
    setPremiumStatusError("");
    try {
      const remote = await refreshUser(userId);
      setProfile((current) => {
        if (!current) return current;
        const isPremium = remote.is_premium === true;
        const verificationError = remote.premium_verification_error ?? null;
        if (
          current.is_premium === isPremium
          && (current.premium_verification_error ?? null) === verificationError
        ) return current;
        return {
          ...current,
          is_premium: isPremium,
          premium_verification_error: verificationError,
        };
      });
      if (remote.premium_verification_error) {
        setPremiumStatusError(remote.premium_verification_error);
      } else {
        setPremiumStatusError("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh Premium status.";
      setPremiumStatusError(message);
    } finally {
      setPremiumStatusRefreshing(false);
    }
  }, [premiumStatusRefreshing, telegramUser?.id]);

  useEffect(() => {
    if (deviceStatus !== "active" || !profile) return;
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - premiumRefreshAt.current < 10_000) return;
      premiumRefreshAt.current = Date.now();
      void refreshPremiumStatus();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [deviceStatus, profile, refreshPremiumStatus]);

  const handleContinueExam = (exam: ExamMeta) => {
    setResumeExam(exam);
    setActiveTab("practice");
  };

  const isPremium = (() => {
    return profile?.is_premium === true;
  })();

  return (
    <div className="tma-desktop-shell">
      <div className={`tma-app-frame min-h-screen w-full mx-auto bg-slate-50 shadow-2xl relative flex flex-col font-sans pb-24 text-slate-900 ${isPremium ? "fresho-premium" : ""}`}>
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
            {deviceStatus === "locked" ? "Fresho session needs recovery" : deviceStatus === "signed_out" ? "Signed out" : "Fresho needs Telegram"}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{deviceStatus === "signed_out" ? "This device has released the active Fresho session." : deviceError}</p>
          {deviceStatus === "locked" && (
            <div className="mt-5 max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
              <p>If you are not using Fresho on another device, move your account session here. This will sign out any other active Fresho session.</p>
              <button
                type="button"
                onClick={() => void handleDeviceTakeover()}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white"
              >
                Use this device instead
              </button>
            </div>
          )}
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
        // Students choose their stream and university during onboarding.
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (
        <>
          {activeTab === "practice" && (
            <PracticeScreen
              stream={profile.stream}
              university={profile.university}
              telegramUserId={telegramUser?.id}
              telegramFirstName={telegramUser?.first_name}
              resumeExam={resumeExam}
              isPremium={isPremium}
              onPremiumAccessGranted={handlePremiumAccessGranted}
              onResumeHandled={() => setResumeExam(null)}
              onGoHome={() => setActiveTab("home")}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "notes" && (
            <NotesScreen
              stream={profile.stream}
              university={profile.university}
              telegramUserId={telegramUser?.id}
              isPremium={isPremium}
              onPremiumAccessGranted={handlePremiumAccessGranted}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "home" && (
            <HomeScreen
              telegramUser={telegramUser}
              fullName={profile.custom_name || profile.full_name}
              stream={profile.stream}
              university={profile.university}
              selectedSubjects={profile.selected_subjects}
              isPremium={isPremium}
              darkMode={darkMode}
              onToggleTheme={() => setDarkMode((value) => !value)}
              onContinueExam={handleContinueExam}
              onGoToPractice={() => setActiveTab("practice")}
              onGetPremium={() => setShowPremiumDialog(true)}
            />
          )}
          {activeTab === "game" && (
            <GameScreen
              stream={profile.stream}
              university={profile.university}
              onPremiumAccessGranted={handlePremiumAccessGranted}
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
              stream={profile.stream}
              selectedSubjects={profile.selected_subjects}
              isPremium={isPremium}
              premiumVerificationError={premiumStatusError || profile.premium_verification_error}
              premiumStatusRefreshing={premiumStatusRefreshing}
              onRefreshPremiumStatus={() => void refreshPremiumStatus()}
              premiumPrice={subscriptionPricing?.price ?? null}
              onProfileChange={handleProfileChange}
              onSignOut={handleDeviceSignOut}
            />
          )}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      )}
      {showPremiumDialog && profile && (
        <PremiumDialog
          fullName={profile.full_name}
          university={profile.university}
          stream={profile.stream}
          price={subscriptionPricing?.price ?? null}
          onClose={() => setShowPremiumDialog(false)}
        />
      )}
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
    </div>
  );
}
