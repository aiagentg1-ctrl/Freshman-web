"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import type { StreamKey } from "../../lib/api";
import UniversityLogo from "./UniversityLogo";
import UniversitySelect from "./UniversitySelect";

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: (stream: Exclude<StreamKey, "general">, subjects: string[], university: string, region: string) => void;
}) {
  const [stream, setStream] = useState<Exclude<StreamKey, "general"> | null>(null);
  const [university, setUniversity] = useState("");
  const [region, setRegion] = useState("");
  const ready = stream !== null && university.trim().length > 0 && region.trim().length > 0;

  const complete = () => {
    if (!ready || !stream) return;
    onComplete(stream, [], university.trim(), region.trim());
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-10 bg-gradient-to-b from-blue-50 to-[#F8FAFC]">
      <div className="w-16 h-16 rounded-3xl bg-[#1D70F5] flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 text-center">Welcome to Fresho</h1>
      <p className="text-sm text-slate-500 text-center mt-1 mb-8">
        Freshman courses for university students
      </p>

      <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">University</h3>
          <div className="flex items-center gap-3">
            <UniversityLogo university={university || "University"} logo={null} />
            <UniversitySelect
              value={university}
              onChange={setUniversity}
              className="flex-1"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Region</h3>
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="e.g. Addis Ababa Region"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5]"
          />
        </div>
      </div>

      <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Choose your department</h3>
        <div className="grid grid-cols-2 gap-2">
          {(["natural", "social"] as const).map((department) => (
            <button
              key={department}
              onClick={() => setStream(department)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                stream === department
                  ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                  : "bg-slate-50 text-slate-600 border-slate-100"
              }`}
            >
              {department === "natural" ? "🔬 Natural Science" : "📚 Social Science"}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={complete}
        disabled={!ready}
        className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        Start Learning
      </button>
    </div>
  );
}
