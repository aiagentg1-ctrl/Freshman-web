"use client";

import { useState, useEffect } from "react";
import { Check, HelpCircle, LogOut, Pencil, User, GraduationCap, MapPin, TrendingUp, Target, BookOpen, Award, Crown } from "lucide-react";
import { StreamKey, updateUser, getUserProgress, UserProgress } from "../../lib/api";
import { streamLabel } from "../../lib/subjects";
import { getTelegramUser, TelegramUser } from "../../lib/telegram";
import UniversityLogo from "./UniversityLogo";
import UniversitySelect from "./UniversitySelect";

const GRADES = [9, 10, 11, 12];
const SUPPORT_URL = "https://t.me/Mirkuz_support";

export default function ProfileScreen({
  telegramUser,
  fullName,
  customName: savedCustomName,
  initialUniversity,
  initialRegion,
  initialSchool,
  initialCity,
  grade,
  stream,
  selectedSubjects,
  isPremium,
  onProfileChange,
  onSignOut,
}: {
  telegramUser: TelegramUser | null;
  fullName: string;
  customName?: string | null;
  initialUniversity?: string;
  initialRegion?: string;
  initialSchool?: string;
  initialCity?: string;
  grade: number;
  stream: StreamKey;
  selectedSubjects: string[];
  isPremium: boolean;
  onProfileChange: (profile: {
    full_name: string;
    custom_name?: string;
    university: string;
    region: string;
    school: string;
    city: string;
    grade: number;
    stream: StreamKey;
    selected_subjects: string[];
  }) => void;
  onSignOut: () => Promise<void>;
}) {
  const [customName, setCustomName] = useState(savedCustomName || fullName || "");
  const [university, setUniversity] = useState(initialUniversity || "");
  const [region, setRegion] = useState(initialRegion || "");
  const [school, setSchool] = useState(initialSchool || "");
  const [city, setCity] = useState(initialCity || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasEdits, setHasEdits] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [universityLogo, setUniversityLogo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProgress = async () => {
      const storedId = Number(localStorage.getItem("mirkuzTelegramUserId"));
      const userId = telegramUser?.id || getTelegramUser()?.id || (Number.isSafeInteger(storedId) && storedId > 0 ? storedId : undefined);
      if (userId) {
        try {
          const progress = await getUserProgress(userId);
          if (active) setUserProgress(progress);
        } catch (error) {
          console.error("Failed to load user progress:", error);
        }
      }
    };
    const refreshProgress = () => void loadProgress();
    refreshProgress();
    window.addEventListener("mirkuz:progress-updated", refreshProgress);
    window.addEventListener("mirkuz:exam-attempt-saved", refreshProgress);
    return () => {
      active = false;
      window.removeEventListener("mirkuz:progress-updated", refreshProgress);
      window.removeEventListener("mirkuz:exam-attempt-saved", refreshProgress);
    };
  }, [telegramUser]);

  useEffect(() => {
    if (!university.trim()) {
      setUniversityLogo(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/university-logo?university=${encodeURIComponent(university)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((logo) => setUniversityLogo(logo?.data_uri || null))
      .catch(() => setUniversityLogo(null));
    return () => controller.abort();
  }, [university]);

  const dirty = hasEdits;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    const name = customName.trim() || fullName || telegramUser?.first_name || "Student";
    const profile = {
      full_name: name,
      custom_name: name || undefined,
      university: university.trim(),
      region: region.trim(),
      school: school.trim(),
      city: city.trim(),
      grade,
      stream,
      selected_subjects: selectedSubjects,
    };
    localStorage.setItem("mirkuzProfile", JSON.stringify(profile));
    onProfileChange(profile);
    window.dispatchEvent(new Event("mirkuz:profile-updated"));

    const storedId = Number(localStorage.getItem("mirkuzTelegramUserId"));
    const userId = telegramUser?.id || getTelegramUser()?.id || (Number.isSafeInteger(storedId) && storedId > 0 ? storedId : undefined);
    if (userId) {
      try {
        const result = await updateUser(userId, {
          first_name: telegramUser?.first_name,
          ...profile,
          selected_subjects: selectedSubjects,
        });
        const savedProfile = {
          ...profile,
          full_name: result.full_name,
          custom_name: result.custom_name || undefined,
          university: result.university,
          region: result.region,
          school: result.school || "",
          city: result.city || "",
        };
        localStorage.setItem("mirkuzProfile", JSON.stringify(savedProfile));
        onProfileChange(savedProfile);
        window.dispatchEvent(new Event("mirkuz:profile-updated"));
      } catch (error) {
        console.error("Failed to save profile:", error);
        setSaveError("Could not save your profile to the server. Your changes are saved on this device; please retry.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setSaved(true);
    setHasEdits(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => {
    if (signingOut || !window.confirm("Sign out of Fresho on this device and allow another device to sign in?")) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not release this device session.");
      setSigningOut(false);
    }
  };

  const displayName =
    customName ||
    fullName ||
    [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") ||
    "Student";

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-5 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        {/* Identity card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <UniversityLogo university={university || "University"} logo={universityLogo} className="h-14 w-14 rounded-full" />
          {telegramUser?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={telegramUser.photo_url}
              alt={displayName}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <User className="w-6 h-6 text-[#1D70F5]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{displayName}</h3>
            {telegramUser?.username && (
              <p className="text-xs text-slate-500">@{telegramUser.username}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              Freshman {streamLabel(stream)}
            </p>
          </div>
        </div>

        {/* Progress Stats Card */}
        {userProgress && (
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-violet-100 text-xs">Level {userProgress.level}</p>
                <p className="text-2xl font-bold">{userProgress.xp} XP</p>
              </div>
              <div className="text-right">
                <p className="text-violet-100 text-xs">{userProgress.rank.emoji} {userProgress.rank.name}</p>
                <p className="text-sm font-semibold">{userProgress.progress_to_next_level.percent}% to next level</p>
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${userProgress.progress_to_next_level.percent}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                <p className="text-lg font-bold">{userProgress.daily_streak}</p>
                <p className="text-[10px] text-violet-100">Day Streak</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Target className="w-5 h-5 mx-auto mb-1" />
                <p className="text-lg font-bold">
                  {userProgress.average_score ? (userProgress.average_score / 25).toFixed(2) : "0.00"}
                </p>
                <p className="text-[10px] text-violet-100">
                  GPA / 4.00
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Award className="w-5 h-5 mx-auto mb-1" />
                <p className="text-lg font-bold">{userProgress.badges.length}</p>
                <p className="text-[10px] text-violet-100">Badges</p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Edit Profile</h3>
            <Pencil className="w-4 h-4 text-slate-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Full Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setHasEdits(true);
              }}
              placeholder={fullName || "Your name"}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> University
            </label>
            <UniversitySelect
              value={university}
              onChange={(nextUniversity) => {
                setUniversity(nextUniversity);
                setHasEdits(true);
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Region
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setHasEdits(true);
              }}
              placeholder="e.g. Addis Ababa Region"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Legacy school</label>
              <input
                type="text"
                value={school}
                onChange={(e) => { setSchool(e.target.value); setHasEdits(true); }}
                placeholder="Optional"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Legacy city</label>
              <input
                type="text"
                value={city}
                onChange={(e) => { setCity(e.target.value); setHasEdits(true); }}
                placeholder="Optional"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5]"
              />
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-5 text-white shadow-sm ${isPremium ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-amber-500 to-orange-600"}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Fresho Premium</p>
              <h3 className="text-lg font-black">{isPremium ? "Premium Active" : "Get Premium"}</h3>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/85">
            {isPremium ? "Your subscription is active. Premium materials are unlocked." : "199 ETB for 5 months. Includes daily plans, detailed notes, exams, AAU resources, and videos."}
          </p>
        </div>

        {/* Grade & Stream Info (read-only) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Academic Info</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Department</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500">Stream</span>
              <span className="text-sm font-bold text-slate-900 bg-violet-50 px-3 py-1 rounded-lg">{streamLabel(stream)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Your department is set during onboarding.
          </p>
        </div>

        <button
          onClick={save}
          disabled={!dirty || saving}
          className={`w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-[#1D70F5] text-white disabled:opacity-40"
          }`}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" /> Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            "Save Changes"
          )}
        </button>
        {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}

        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" /> {signingOut ? "Signing out..." : "Sign out and free this device"}
        </button>

        {/* Support */}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Mirkuz Support</h3>
            <p className="text-xs text-slate-500">Register or contact support on Telegram</p>
          </div>
        </a>
      </div>
    </div>
  );
}
