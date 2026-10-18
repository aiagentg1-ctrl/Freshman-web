"use client";

import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";

export default function PremiumContentProtection({
  enabled,
  telegramUserId,
  firstName,
}: {
  enabled: boolean;
  telegramUserId?: number;
  firstName?: string;
}) {
  const [isVisible, setIsVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  if (!enabled) return null;

  const owner = [firstName?.trim(), telegramUserId ? `ID ${telegramUserId}` : ""]
    .filter(Boolean)
    .join(" · ") || "Premium member";
  const watermark = `Fresho Premium · ${owner} · Personal use only`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] select-none overflow-hidden"
    >
      {isVisible ? (
        <div className="grid h-full w-full grid-cols-2 grid-rows-4 sm:grid-cols-3">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="flex items-center justify-center whitespace-nowrap text-center text-[10px] font-bold tracking-wider text-slate-700/[0.18] sm:text-xs"
              style={{ transform: `rotate(-28deg) translateY(${index % 2 ? 12 : -12}px)` }}
            >
              {watermark}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 px-8 text-center text-white">
          <EyeOff className="h-10 w-10" />
          <p className="text-lg font-bold">Premium content hidden</p>
          <p className="text-sm text-slate-300">Return to Fresho to continue studying.</p>
        </div>
      )}
    </div>
  );
}
