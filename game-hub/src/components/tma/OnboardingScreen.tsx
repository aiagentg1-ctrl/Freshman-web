"use client";

import { useState } from "react";
import { Check, GraduationCap } from "lucide-react";
import type { StreamKey } from "../../lib/api";
import { subjectLabel, subjectsForStream } from "../../lib/subjects";

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: (stream: Exclude<StreamKey, "general">, subjects: string[], university: string, region: string) => void;
}) {
  const [stream, setStream] = useState<Exclude<StreamKey, "general"> | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [university, setUniversity] = useState("");
  const [region, setRegion] = useState("");
  const availableSubjects = stream ? subjectsForStream(stream) : [];
  const ready = stream !== null && selectedSubjects.length > 0 && university.trim() && region.trim();

  const complete = () => {
    if (!ready || !stream) return;
    onComplete(stream, selectedSubjects, university.trim(), region.trim());
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-10 bg-gradient-to-b from-blue-50 to-[#F8FAFC]">
      <div className="w-16 h-16 rounded-3xl bg-[#1D70F5] flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 text-center">Welcome to Mirkuz</h1>
      <p className="text-sm text-slate-500 text-center mt-1 mb-8">
        Freshman courses for university students
      </p>

      <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">University</h3>
          <input
            value={university}
            onChange={(event) => setUniversity(event.target.value)}
            placeholder="e.g. Addis Ababa University"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5]"
          />
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
              onClick={() => {
                setStream(department);
                setSelectedSubjects([]);
              }}
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

      {stream && (
        <div className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Choose your subjects</h3>
          <p className="text-xs text-slate-500 mb-3">You can update these choices later.</p>
          <div className="grid grid-cols-1 gap-2">
            {availableSubjects.map((subject) => {
              const selected = selectedSubjects.includes(subject.key);
              return (
                <button
                  key={subject.key}
                  type="button"
                  onClick={() => setSelectedSubjects((current) => selected ? current.filter((key) => key !== subject.key) : [...current, subject.key])}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${selected ? "border-[#1D70F5] bg-blue-50 text-[#1D70F5]" : "border-slate-100 bg-slate-50 text-slate-700"}`}
                >
                  <span>{subjectLabel(subject.key)}</span>
                  {selected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
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
