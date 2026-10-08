"use client";

import { BookOpen, Gamepad2, Home, Target, User } from "lucide-react";

export type Tab = "practice" | "notes" | "home" | "game" | "profile";

const TABS: { key: Tab; label: string; icon: typeof Target }[] = [
  { key: "practice", label: "Practice", icon: Target },
  { key: "notes", label: "Notes", icon: BookOpen },
  { key: "home", label: "Home", icon: Home },
  { key: "game", label: "Game", icon: Gamepad2 },
  { key: "profile", label: "Profile", icon: User },
];

export default function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-100 py-2.5 px-6 flex justify-around items-center z-50">
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className="flex flex-col items-center gap-1 min-w-[64px] border-0 outline-none"
          >
            <span
              className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${
                active ? "bg-blue-100 text-[#1D70F5]" : "bg-transparent text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
            </span>
            <span
              className={`text-[11px] leading-none transition-colors ${
                active ? "font-bold text-[#1D70F5]" : "font-medium text-slate-400"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
