"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import type { StreamKey } from "../../lib/api";

const GRADES = [9, 10, 11, 12];

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: (grade: number, stream: StreamKey) => void;
}) {
  const [grade, setGrade] = useState<number | null>(null);
  const [stream, setStream] = useState<StreamKey | null>(null);

  // Grades 9 & 10 follow the common curriculum — no stream choice.
  const needsStream = grade !== null && grade >= 11;
  const ready = grade !== null && (needsStream ? stream !== null : true);

  const complete = () => {
    if (!ready || grade === null) return;
    onComplete(grade, needsStream ? stream! : "general");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-10 bg-gradient-to-b from-blue-50 to-[#F8FAFC]">
      <div className="w-16 h-16 rounded-3xl bg-[#1D70F5] flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 text-center">Welcome to Mirkuz</h1>
      <p className="text-sm text-slate-500 text-center mt-1 mb-8">
        EUEE prep for Ethiopian high school students
      </p>

      <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Your Grade</h3>
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => {
                setGrade(g);
                setStream(null);
              }}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                grade === g
                  ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                  : "bg-slate-50 text-slate-600 border-slate-100"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {needsStream && (
        <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Your Stream</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStream("natural")}
              className={`py-3.5 rounded-xl text-sm font-semibold border transition-colors ${
                stream === "natural"
                  ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                  : "bg-slate-50 text-slate-600 border-slate-100"
              }`}
            >
              🔬 Natural Science
            </button>
            <button
              onClick={() => setStream("social")}
              className={`py-3.5 rounded-xl text-sm font-semibold border transition-colors ${
                stream === "social"
                  ? "bg-[#1D70F5] text-white border-[#1D70F5]"
                  : "bg-slate-50 text-slate-600 border-slate-100"
              }`}
            >
              📚 Social Science
            </button>
          </div>
        </div>
      )}

      {grade !== null && !needsStream && (
        <p className="text-xs text-slate-500 text-center mb-6 -mt-1">
          Grades 9–10 follow the General curriculum — all subjects included.
        </p>
      )}

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
