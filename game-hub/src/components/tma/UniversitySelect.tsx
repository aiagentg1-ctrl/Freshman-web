"use client";

import { universities } from "../../lib/universities";

interface UniversitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export default function UniversitySelect({
  value,
  onChange,
  placeholder = "Select your university",
  className = "",
  compact = false,
}: UniversitySelectProps) {
  const knownUniversity = universities.find((university) => university.name === value);
  const selectedValue = knownUniversity ? value : "other";
  const selectedName = knownUniversity ? knownUniversity.name : value;

  const selectUniversity = (nextValue: string) => {
    if (nextValue === "other") {
      onChange("");
      return;
    }
    const university = universities.find((item) => item.name === nextValue);
    onChange(university?.name || "");
  };

  return (
    <div className="space-y-2">
      <select
        value={selectedValue}
        onChange={(event) => selectUniversity(event.target.value)}
        className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent ${className}`}
        aria-label="University"
      >
        <option value="other">{placeholder}</option>
        {universities.map((university) => (
          <option key={university.name} value={university.name}>
            {university.name} ({university.abbreviation})
          </option>
        ))}
      </select>

      {selectedValue === "other" && (
        <input
          value={selectedName}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your university name"
          className={`w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent ${className}`}
        />
      )}
    </div>
  );
}
