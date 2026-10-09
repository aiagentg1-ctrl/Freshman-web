"use client";

import { GraduationCap } from "lucide-react";

export default function UniversityLogo({
  university,
  logo,
  className = "h-10 w-10",
}: {
  university: string;
  logo?: string | null;
  className?: string;
}) {
  // Determine icon size based on className
  const isExtraLarge = className.includes("h-20") || className.includes("w-20");
  const isLarge = className.includes("h-16") || className.includes("w-16");
  const iconSize = isExtraLarge ? "h-10 w-10" : isLarge ? "h-8 w-8" : "h-5 w-5";

  return logo ? (
    <img
      src={logo}
      alt={`${university} logo`}
      className={`${className} shrink-0 rounded-xl border border-slate-100 bg-white object-contain p-2 shadow-sm`}
    />
  ) : (
    <div
      className={`${className} shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-[#1D70F5]`}
      aria-label={`${university} logo unavailable`}
    >
      <GraduationCap className={iconSize} />
    </div>
  );
}
