"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { universities } from "../../lib/universities";

interface UniversitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .trim();

export default function UniversitySelect({
  value,
  onChange,
  placeholder = "Search your university",
  className = "",
}: UniversitySelectProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const knownUniversity = universities.find((university) => university.name === value);

  useEffect(() => setQuery(value), [value]);

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return universities.slice(0, 8);
    return universities.filter((university) => {
      const searchable = `${university.name} ${university.abbreviation}`.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en");
      return searchable.includes(normalizedQuery);
    });
  }, [query]);

  const chooseUniversity = (university: string) => {
    setQuery(university);
    setOpen(false);
    onChange(university);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            onChange(nextQuery);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          placeholder={placeholder}
          className={`w-full py-3 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D70F5] focus:border-transparent ${className}`}
          aria-label="University"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setOpen(false);
              onChange("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label="Clear university"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {matches.length > 0 ? matches.map((university) => (
            <button
              key={university.name}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseUniversity(university.name)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-blue-50 ${knownUniversity?.name === university.name ? "bg-blue-50" : ""}`}
            >
              <span className="truncate text-sm font-semibold text-slate-800">{university.name}</span>
              <span className="ml-3 text-[10px] font-bold text-slate-400">{university.abbreviation}</span>
            </button>
          )) : (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              No matching university. Press Enter or continue typing to save your custom name.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
