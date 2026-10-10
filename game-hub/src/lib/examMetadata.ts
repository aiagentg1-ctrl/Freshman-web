export function getExamQuestionCount(html: string): number | null {
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

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate.trim());
      const questions = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "questions" in parsed
          ? (parsed as { questions: unknown }).questions
          : null;
      if (Array.isArray(questions) && questions.length > 0) return questions.length;
    } catch {
      continue;
    }
  }
  return null;
}

const CALCULATION_SUBJECTS = new Set(["mathematics", "physics", "chemistry"]);

export function getSuggestedExamDuration(subject: string, questionCount: number): number {
  const minutesPerQuestion = CALCULATION_SUBJECTS.has(subject.toLowerCase()) ? 4.5 : 3;
  return Math.ceil(questionCount * minutesPerQuestion);
}
