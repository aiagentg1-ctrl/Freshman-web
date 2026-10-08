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
  logic: {
    key: "logic",
    label: "Logic & Critical Thinking",
    icon: Brain,
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    cardBorder: "border-indigo-100",
  },
  psychology: {
    key: "psychology",
    label: "Psychology",
    icon: Brain,
    iconBg: "bg-fuchsia-50",
    iconText: "text-fuchsia-600",
    cardBorder: "border-fuchsia-100",
  },
  communicative_english: {
    key: "communicative_english",
    label: "Communicative English I",
    icon: BookOpen,
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    cardBorder: "border-violet-100",
  },
  emerging_technology: {
    key: "emerging_technology",
    label: "Emerging Technology",
    icon: Atom,
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
    cardBorder: "border-sky-100",
  },
  anthropology: {
    key: "anthropology",
    label: "Anthropology",
    icon: Globe,
    iconBg: "bg-teal-50",
    iconText: "text-teal-600",
    cardBorder: "border-teal-100",
  },
  global_trends: {
    key: "global_trends",
    label: "Global Trends",
    icon: Globe,
    iconBg: "bg-cyan-50",
    iconText: "text-cyan-600",
    cardBorder: "border-cyan-100",
  },
  entrepreneurship: {
    key: "entrepreneurship",
    label: "Entrepreneurship",
    icon: TrendingUp,
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    cardBorder: "border-orange-100",
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

export const COMMON_SUBJECTS = [
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
] as const;

export const NATURAL_SUBJECTS = [
  "logic",
  "psychology",
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
  "emerging_technology",
  "anthropology",
] as const;

export const SOCIAL_SUBJECTS = [
  "civics",
  "global_trends",
  "entrepreneurship",
  "economics",
  "anthropology",
  "geography",
  "communicative_english",
  "emerging_technology",
  "mathematics",
  "english",
  "history",
  "physics",
  "chemistry",
  "biology",
  "aptitude",
] as const;

export function subjectsForStream(stream: StreamKey): SubjectConfig[] {
  const keys = stream === "general"
    ? COMMON_SUBJECTS
    : stream === "natural"
      ? NATURAL_SUBJECTS
      : SOCIAL_SUBJECTS;
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
