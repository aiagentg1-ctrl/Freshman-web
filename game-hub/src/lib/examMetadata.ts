type ExamMetadata = {
  subject: string | null;
  university: string | null;
  year: string | null;
  examType: "mid" | "final" | null;
};

function getEmbeddedExamData(html: string): unknown[] {
  const script = html.match(
    /<script\b[^>]*(?:id=["']exam-questions["']|data-exam-questions)[^>]*>([\s\S]*?)<\/script>/i,
  );
  const candidates = script ? [script[1]] : [];
  if (candidates.length === 0) {
    const assignment = /(?:window\.)?(?:__)?EXAM_QUESTIONS(?:__)?\s*=/i.exec(html);
    if (assignment?.index !== undefined) {
      const arrayStart = html.indexOf("[", assignment.index + assignment[0].length);
      if (arrayStart >= 0) {
        let depth = 0;
        let quote = false;
        let escaped = false;
        for (let index = arrayStart; index < html.length; index += 1) {
          const character = html[index];
          if (escaped) escaped = false;
          else if (character === "\\" && quote) escaped = true;
          else if (character === '"') quote = !quote;
          else if (!quote && character === "[") depth += 1;
          else if (!quote && character === "]") {
            depth -= 1;
            if (depth === 0) {
              candidates.push(html.slice(arrayStart, index + 1));
              break;
            }
          }
        }
      }
    }
  }

  const embeddedData: unknown[] = [];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate.trim());
      embeddedData.push(parsed);
    } catch {
      continue;
    }
  }
  return embeddedData;
}

export function getExamQuestionCount(html: string): number | null {
  for (const parsed of getEmbeddedExamData(html)) {
    const questions = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "questions" in parsed
        ? (parsed as { questions: unknown }).questions
        : null;
    if (Array.isArray(questions) && questions.length > 0) return questions.length;
  }
  return null;
}

function metadataValue(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeSubject(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const subjects: Array<[string, string[]]> = [
    ["communicative_english", ["communicative english"]],
    ["history", ["history of ethiopia", "ethiopian history", "history"]],
    ["mathematics", ["mathematics", "math"]],
    ["physics", ["physics"]],
    ["chemistry", ["chemistry"]],
    ["biology", ["biology"]],
    ["logic", ["logic", "critical thinking"]],
    ["psychology", ["psychology"]],
    ["emerging_technology", ["emerging technology"]],
    ["anthropology", ["anthropology"]],
    ["global_trends", ["global trends"]],
    ["entrepreneurship", ["entrepreneurship"]],
    ["english", ["english"]],
    ["aptitude", ["aptitude"]],
    ["civics", ["civics", "moral education"]],
    ["geography", ["geography"]],
    ["economics", ["economics"]],
    ["e_she", ["e she", "eshe"]],
  ];
  return subjects.find(([, aliases]) => aliases.some((alias) => normalized === alias || normalized.includes(alias)))?.[0] ?? null;
}

function getHtmlMetadataValue(html: string, name: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
        .map(([, key, value]) => [key.toLowerCase(), value]),
    );
    const key = (attributes.name || attributes.property || "").replace(/^exam:/i, "");
    if (key.toLowerCase() === name.toLowerCase() && attributes.content) {
      return attributes.content.trim();
    }
  }
  const dataAttribute = html.match(new RegExp(`\\bdata-${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  if (dataAttribute?.[1]) return dataAttribute[1].trim();
  const tagName = name === "title" ? "title" : name === "subject" || name === "exam-type" ? "h1" : "";
  if (!tagName) return null;
  const content = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))?.[1];
  return content?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

export function getExamMetadata(html: string): ExamMetadata {
  const embedded = getEmbeddedExamData(html);
  const records = embedded.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const nested = record.metadata && typeof record.metadata === "object"
      ? [record.metadata as Record<string, unknown>]
      : [];
    return [record, ...nested];
  });
  const questions = embedded.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && "questions" in value && Array.isArray(value.questions)) {
      return value.questions;
    }
    return [];
  }).filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));

  const readEmbedded = (...keys: string[]) => records
    .map((record) => metadataValue(record, ...keys))
    .find((value): value is string => value !== null) ?? null;
  const title = [getHtmlMetadataValue(html, "title"), getHtmlMetadataValue(html, "subject"), getHtmlMetadataValue(html, "exam-type")]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const questionSubjects = [...new Set(
    questions
      .map((question) => metadataValue(question, "subject", "subject_name"))
      .filter((value): value is string => value !== null),
  )];
  const subjectText = readEmbedded("subject", "subject_name")
    ?? getHtmlMetadataValue(html, "subject")
    ?? (questionSubjects.length === 1 ? questionSubjects[0] : null)
    ?? title;
  const subject = (subjectText ? normalizeSubject(subjectText) : null) ?? normalizeSubject(title);
  const universityValues = questions
    .map((question) => metadataValue(question, "university", "university_name"))
    .filter((value): value is string => value !== null);
  const uniqueUniversities = [...new Set(universityValues)];
  const university = readEmbedded("university", "university_name")
    ?? getHtmlMetadataValue(html, "university")
    ?? (uniqueUniversities.length === 1 ? uniqueUniversities[0] : null);
  const year = readEmbedded("year", "exam_year")
    ?? getHtmlMetadataValue(html, "year")
    ?? title.match(/\b\d{3,4}(?:\s*(?:E\.?C\.?|G\.?C\.?))?\b/i)?.[0]
    ?? null;
  const rawType = readEmbedded("exam_type", "examType", "type") ?? getHtmlMetadataValue(html, "exam-type") ?? title;
  const normalizedType = rawType?.toLowerCase() ?? "";
  const examType = /\bmid(?:term)?\b/.test(normalizedType)
    ? "mid"
    : /\bfinal\b/.test(normalizedType)
      ? "final"
      : null;
  return { subject, university, year, examType };
}

const CALCULATION_SUBJECTS = new Set(["mathematics", "physics", "chemistry"]);

export function getSuggestedExamDuration(subject: string, questionCount: number): number {
  const minutesPerQuestion = CALCULATION_SUBJECTS.has(subject.toLowerCase()) ? 4.5 : 3;
  return Math.ceil(questionCount * minutesPerQuestion);
}
