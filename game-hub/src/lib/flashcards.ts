export interface StudyFlashCard {
  id: string;
  front: string;
  back: string;
  partOfSpeech?: string;
  tag?: string;
  examples: string[];
  examTip?: string;
}

export interface CardSchedule {
  dueAt: number;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
}

type Rating = "again" | "hard" | "good" | "easy";

function extractLegacyDeck(html: string): unknown {
  const assignment = /\b(?:const|let|var)?\s*VOCAB_DATA\s*=\s*\[/i.exec(html);
  if (!assignment) return null;

  const arrayStart = html.indexOf("[", assignment.index);
  let index = arrayStart;

  const skipWhitespaceAndComments = () => {
    while (index < html.length) {
      if (/\s/.test(html[index])) {
        index += 1;
      } else if (html.startsWith("//", index)) {
        const lineEnd = html.indexOf("\n", index + 2);
        index = lineEnd < 0 ? html.length : lineEnd + 1;
      } else if (html.startsWith("/*", index)) {
        const commentEnd = html.indexOf("*/", index + 2);
        if (commentEnd < 0) throw new Error("The VOCAB_DATA contains an incomplete comment.");
        index = commentEnd + 2;
      } else {
        return;
      }
    }
  };

  const readString = (): string => {
    const quote = html[index];
    index += 1;
    let value = "";
    while (index < html.length) {
      const character = html[index];
      index += 1;
      if (character === quote) return value;
      if (character !== "\\") {
        value += character;
        continue;
      }
      if (index >= html.length) break;
      const escaped = html[index];
      index += 1;
      const simpleEscapes: Record<string, string> = {
        "0": "\0",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        "\\": "\\",
        "'": "'",
        '"': '"',
        "/": "/",
      };
      if (escaped in simpleEscapes) {
        value += simpleEscapes[escaped];
      } else if (escaped === "u" || escaped === "x") {
        const digits = escaped === "u" ? 4 : 2;
        const code = html.slice(index, index + digits);
        if (!new RegExp(`^[0-9a-f]{${digits}}$`, "i").test(code)) {
          throw new Error("The VOCAB_DATA contains an invalid string escape.");
        }
        value += String.fromCharCode(parseInt(code, 16));
        index += digits;
      } else if (escaped === "\n") {
        continue;
      } else {
        value += escaped;
      }
    }
    throw new Error("The VOCAB_DATA contains an unterminated string.");
  };

  const readIdentifier = (): string => {
    const start = index;
    if (!/[A-Za-z_$]/.test(html[index] || "")) {
      throw new Error(`Unexpected character in VOCAB_DATA at position ${index}.`);
    }
    while (index < html.length && /[A-Za-z0-9_$]/.test(html[index])) index += 1;
    if (start === index) throw new Error(`Unexpected character in VOCAB_DATA at position ${index}.`);
    return html.slice(start, index);
  };

  const expect = (character: string) => {
    skipWhitespaceAndComments();
    if (html[index] !== character) {
      throw new Error(`Expected "${character}" in VOCAB_DATA at position ${index}.`);
    }
    index += 1;
  };

  const parseValue = (): unknown => {
    skipWhitespaceAndComments();
    const character = html[index];

    if (character === "[" ) {
      index += 1;
      const values: unknown[] = [];
      skipWhitespaceAndComments();
      while (html[index] !== "]") {
        if (index >= html.length) throw new Error("The VOCAB_DATA array is incomplete.");
        values.push(parseValue());
        skipWhitespaceAndComments();
        if (html[index] === "]") break;
        expect(",");
        skipWhitespaceAndComments();
        if (html[index] === "]") break;
      }
      expect("]");
      return values;
    }

    if (character === "{") {
      index += 1;
      const record: Record<string, unknown> = {};
      skipWhitespaceAndComments();
      while (html[index] !== "}") {
        if (index >= html.length) throw new Error("A VOCAB_DATA object is incomplete.");
        const keyCharacter = html[index];
        const key = keyCharacter === "'" || keyCharacter === '"' || keyCharacter === "`"
          ? readString()
          : readIdentifier();
        expect(":");
        record[key] = parseValue();
        skipWhitespaceAndComments();
        if (html[index] === "}") break;
        expect(",");
        skipWhitespaceAndComments();
        if (html[index] === "}") break;
      }
      expect("}");
      return record;
    }

    if (character === "'" || character === '"' || character === "`") return readString();
    const numericLiteral = html.slice(index).match(/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (numericLiteral) {
      index += numericLiteral[0].length;
      return Number(numericLiteral[0]);
    }
    const literal = readIdentifier();
    if (literal === "true") return true;
    if (literal === "false") return false;
    if (literal === "null") return null;
    if (literal === "undefined") return undefined;
    throw new Error(`Unsupported value "${literal}" in VOCAB_DATA.`);
  };

  if (arrayStart < 0) throw new Error("The VOCAB_DATA array is incomplete.");
  const parsed = parseValue();
  if (!Array.isArray(parsed)) throw new Error("VOCAB_DATA must be an array.");
  return parsed;
}

function readCardList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "cards" in value) {
    const cards = (value as { cards: unknown }).cards;
    return Array.isArray(cards) ? cards : null;
  }
  return null;
}

function stringValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function parseFlashcardDeck(html: string): StudyFlashCard[] {
  const embeddedData = /<script\b[^>]*\bid=["']flashcard-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  let rawCards: unknown[] | null = null;

  try {
    const data = embeddedData
      ? JSON.parse(embeddedData[1]) as unknown
      : extractLegacyDeck(html);
    rawCards = readCardList(data);
  } catch (error) {
    throw new Error(`Could not read flashcard deck data: ${error instanceof Error ? error.message : "Invalid JSON."}`);
  }

  if (!rawCards) {
    throw new Error("This deck has no supported flashcard data. Add a flashcard-data JSON block to the HTML.");
  }

  const usedIds = new Set<string>();
  const cards = rawCards.flatMap((value, index): StudyFlashCard[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const front = stringValue(record, ["front", "question", "word", "term"]);
    const back = stringValue(record, ["back", "answer", "definition", "def"]);
    if (!front || !back) return [];

    const suppliedId = typeof record.id === "string" || typeof record.id === "number"
      ? String(record.id)
      : "";
    const slug = front.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const baseId = suppliedId || `${index}-${slug || "card"}`;
    let id = baseId;
    while (usedIds.has(id)) id = `${baseId}-${index}`;
    usedIds.add(id);
    const examples = Array.isArray(record.examples)
      ? record.examples.filter((example): example is string => typeof example === "string")
      : [];

    return [{
      id,
      front,
      back,
      partOfSpeech: stringValue(record, ["pos", "partOfSpeech"]),
      tag: stringValue(record, ["tag", "category"]),
      examples,
      examTip: stringValue(record, ["examTip", "exam_tip"]),
    }];
  });

  if (cards.length === 0) {
    throw new Error("The deck data has no valid cards. Every card needs a front/word and a back/definition.");
  }
  return cards;
}

export function dueCardIds(
  cards: StudyFlashCard[],
  schedules: Record<string, CardSchedule>,
  now = Date.now(),
): string[] {
  return cards
    .filter((card) => !schedules[card.id] || schedules[card.id].dueAt <= now)
    .map((card) => card.id);
}

export function rateFlashCard(
  previous: CardSchedule | undefined,
  rating: Rating,
  now = Date.now(),
): CardSchedule {
  const ease = previous?.ease ?? 2.5;
  const interval = previous?.intervalDays ?? 0;
  let intervalDays: number;
  let nextEase = ease;
  let repetitions = previous?.repetitions ?? 0;
  let lapses = previous?.lapses ?? 0;
  let dueAt: number;

  if (rating === "again") {
    intervalDays = 0;
    dueAt = now + 60_000;
    nextEase = Math.max(1.3, ease - 0.2);
    repetitions = 0;
    lapses += 1;
  } else {
    intervalDays = rating === "hard"
      ? Math.max(1, interval * 1.2 || 1)
      : rating === "good"
        ? Math.max(3, interval * ease || 3)
        : Math.max(7, interval * ease * 1.3 || 7);
    if (rating === "hard") nextEase = Math.max(1.3, ease - 0.15);
    if (rating === "easy") nextEase = ease + 0.15;
    dueAt = now + intervalDays * 24 * 60 * 60 * 1000;
    repetitions += 1;
  }

  return { dueAt, intervalDays, ease: nextEase, repetitions, lapses };
}

export function reviewIntervalLabel(previous: CardSchedule | undefined, rating: Rating): string {
  if (rating === "again") return "<1 min";
  const next = rateFlashCard(previous, rating);
  const roundedDays = Math.max(1, Math.round(next.intervalDays));
  return `${roundedDays} ${roundedDays === 1 ? "day" : "days"}`;
}

function progressStorageKey(): string {
  const userId = localStorage.getItem("freshoTelegramUserId") || "device";
  return `freshoAnkiProgress:${userId}`;
}

export function loadDeckProgress(deckId: number): Record<string, CardSchedule> {
  try {
    const saved = localStorage.getItem(progressStorageKey());
    if (!saved) return {};
    const allProgress = JSON.parse(saved) as Record<string, unknown>;
    const deckProgress = allProgress[String(deckId)];
    if (!deckProgress || typeof deckProgress !== "object" || Array.isArray(deckProgress)) return {};
    for (const [cardId, schedule] of Object.entries(deckProgress)) {
      if (
        !cardId
        || !schedule
        || typeof schedule !== "object"
        || !Number.isFinite((schedule as CardSchedule).dueAt)
        || !Number.isFinite((schedule as CardSchedule).intervalDays)
        || !Number.isFinite((schedule as CardSchedule).ease)
        || !Number.isFinite((schedule as CardSchedule).repetitions)
        || !Number.isFinite((schedule as CardSchedule).lapses)
      ) {
        throw new Error("Saved flashcard progress has an invalid format.");
      }
    }
    return deckProgress as Record<string, CardSchedule>;
  } catch (error) {
    console.error("Could not load saved flashcard progress:", error);
    throw new Error("Saved flashcard progress could not be read. Clear this deck's saved browser data and try again.");
  }
}

export function saveDeckProgress(deckId: number, progress: Record<string, CardSchedule>): void {
  const key = progressStorageKey();
  let allProgress: Record<string, unknown> = {};
  const saved = localStorage.getItem(key);
  if (saved) {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Saved flashcard progress has an invalid format.");
    }
    allProgress = parsed as Record<string, unknown>;
  }
  allProgress[String(deckId)] = progress;
  localStorage.setItem(key, JSON.stringify(allProgress));
}
