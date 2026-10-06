import {
  Atom,
  FlaskConical,
  Sigma,
  Dna,
  BookOpen,
  Brain,
  ScrollText,
  Globe,
  TrendingUp,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { StreamKey } from "./api";

export interface SubjectConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconText: string;
  cardBorder: string;
}

export const SUBJECTS: Record<string, SubjectConfig> = {
  physics: {
    key: "physics",
    label: "Physics",
    icon: Atom,
    iconBg: "bg-cyan-50",
    iconText: "text-cyan-600",
    cardBorder: "border-cyan-100",
  },
  chemistry: {
    key: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    iconBg: "bg-pink-50",
    iconText: "text-pink-600",
    cardBorder: "border-pink-100",
  },
  mathematics: {
    key: "mathematics",
    label: "Mathematics",
    icon: Sigma,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    cardBorder: "border-emerald-100",
  },
  biology: {
    key: "biology",
    label: "Biology",
    icon: Dna,
    iconBg: "bg-green-50",
    iconText: "text-green-600",
    cardBorder: "border-green-100",
  },
  english: {
    key: "english",
    label: "English",
    icon: BookOpen,
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    cardBorder: "border-violet-100",
  },
  aptitude: {
    key: "aptitude",
    label: "Aptitude",
    icon: Brain,
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    cardBorder: "border-blue-100",
  },
  history: {
    key: "history",
    label: "History",
    icon: ScrollText,
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    cardBorder: "border-amber-100",
  },
  geography: {
    key: "geography",
    label: "Geography",
    icon: Globe,
    iconBg: "bg-teal-50",
    iconText: "text-teal-600",
    cardBorder: "border-teal-100",
  },
  economics: {
    key: "economics",
    label: "Economics",
    icon: TrendingUp,
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    cardBorder: "border-rose-100",
  },
  civics: {
    key: "civics",
    label: "Civics",
    icon: Landmark,
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    cardBorder: "border-slate-200",
  },
};

export const NATURAL_SUBJECTS = [
  "physics",
  "chemistry",
  "mathematics",
  "biology",
  "english",
  "aptitude",
];

export const SOCIAL_SUBJECTS = [
  "history",
  "geography",
  "economics",
  "mathematics",
  "english",
  "aptitude",
];

// Grades 9-10 share the common Ethiopian curriculum — no stream split.
export const GENERAL_SUBJECTS = [
  "physics",
  "chemistry",
  "biology",
  "mathematics",
  "english",
  "geography",
  "history",
  "civics",
  "aptitude",
  "economics",
];

export function subjectsForStream(stream: StreamKey): SubjectConfig[] {
  const keys =
    stream === "social"
      ? SOCIAL_SUBJECTS
      : stream === "natural"
      ? NATURAL_SUBJECTS
      : GENERAL_SUBJECTS;
  return keys.map((key) => SUBJECTS[key]);
}

export function subjectLabel(key: string): string {
  return SUBJECTS[key]?.label ?? key;
}

export function streamLabel(stream: string | null | undefined): string {
  if (stream === "social") return "Social Science";
  if (stream === "general") return "General";
  return "Natural Science";
}
