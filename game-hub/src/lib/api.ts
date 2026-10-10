export type StreamKey = "general" | "natural" | "social";

export type ExamContentType = "html" | "pdf";

export interface ExamMeta {
  id: number;
  subject: string;
  year: string;
  title: string;
  university: string;
  custom_tag: string;
  question_count: number;
  duration_minutes: number;
  content_type: ExamContentType;
  exam_type: "final" | "mid";
  is_premium: boolean;
  is_published: boolean;
  semester?: string;
}

export async function adminGetNote(id: number): Promise<Note> {
  return request<Note>(`/api/admin/notes/${id}`, {
    headers: getAdminHeaders(),
  });
}

export async function adminToggleExamPremium(examId: number): Promise<{ id: number; is_premium: boolean }> {
  return request(`/api/admin/exams/${examId}/toggle-premium`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export async function adminGetChapterExam(id: number): Promise<ChapterExam> {
  return request<ChapterExam>(`/api/admin/chapter-exams/${id}`, {
    headers: getAdminHeaders(),
  });
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function adminToggleChapterExamPublish(examId: number): Promise<{ id: number; is_published: boolean }> {
  return request(`/api/admin/chapter-exams/${examId}/toggle-publish`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export async function adminToggleNotePremium(noteId: number): Promise<{ id: number; is_premium: boolean }> {
  return request(`/api/admin/notes/${noteId}/toggle-premium`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export function isPremiumAccessRequired(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "PREMIUM_MEMBERSHIP_REQUIRED";
}

export async function adminToggleFlashCardPremium(id: number): Promise<{ id: number; is_premium: boolean }> {
  return request(`/api/admin/flash-cards/${id}/toggle-premium`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export async function adminToggleFlashCardPublish(id: number): Promise<{ id: number; is_published: boolean }> {
  return request(`/api/admin/flash-cards/${id}/toggle-publish`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export interface Exam extends ExamMeta {
  /** HTML markup when content_type is "html"; a URL or data URI when "pdf". */
  content_data: string;
}

export interface NoteMeta {
  id: number;
  subject: string;
  stream: string | null;
  chapter_number: number;
  title: string;
  is_premium: boolean;
  is_published: boolean;
  semester?: string;
}

export interface Note extends NoteMeta {
  html_content: string;
}

export interface FlashCard {
  id: number;
  title: string;
  html_content?: string;
  is_premium: boolean;
  is_published: boolean;
  created_at: string;
}

export interface ChapterExamMeta {
  id: number;
  note_id: number | null;
  subject: string;
  stream: string | null;
  chapter_number: number;
  title: string;
  question_count: number;
  content_type: ExamContentType;
  is_premium: boolean;
  is_published: boolean;
  semester?: string;
}

export interface ChapterExam extends ChapterExamMeta {
  content_data: string;
}

export interface ChapterExamInput {
  note_id?: number | null;
  subject?: string;
  stream?: string | null;
  chapter_number?: number;
  title: string;
  question_count: number;
  content_type: ExamContentType;
  content_data: string;
  is_premium: boolean;
  is_published: boolean;
  semester?: string;
}

export interface UserProfile {
  user_id: number;
  first_name: string;
  full_name: string;
  custom_name: string | null;
  university: string;
  region: string;
  school?: string;
  city?: string;
  stream: string;
  selected_subjects: string[];
  premium_expires_at?: string | null;
  is_premium?: boolean;
}

export interface SubjectSuggestion {
  id: number;
  user_id: number;
  stream: string;
  subject_name: string;
  reason?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface UserStats {
  exams_taken: number;
  average_score: number | null;
  last_score: number | null;
  last_exam: ExamMeta | null;
}

export interface UserProgress {
  user_id: number;
  first_name?: string;
  full_name: string;
  custom_name: string | null;
  university?: string | null;
  region?: string | null;
  school?: string | null;
  city?: string | null;
  stream: string;
  xp: number;
  level: number;
  rank: { name: string; min_xp: number; emoji: string };
  progress_to_next_level: { percent: number; current_xp: number; needed: number };
  badges: Array<{ name: string; emoji: string; earned_at: string }>;
  daily_streak: number;
  frozen_streaks: number;
  score_type: "average" | "matrik";
  average_score?: number;
  matrik_score?: {
    eligible: boolean;
    stream?: string;
    score?: number;
    out_of?: number;
    breakdown?: Record<string, number>;
    subjects_completed?: number;
    subjects_total?: number;
    coverage_percent?: number;
    reason?: string;
  };
}

export interface ExamReviewQuestion {
  id: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number | null;
  explanation?: string;
}

export interface RecentExamAttempt {
  id: string;
  examId: number;
  title: string;
  subject: string;
  year: string;
  scorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt: string;
  answers: ExamReviewQuestion[];
}

export interface SavedExamProgress {
  exam: ExamMeta;
  currentQuestion: number;
  answers: (number | null)[];
  flags: number[];
  timed: boolean;
  secondsLeft: number;
  elapsed: number;
}

const RECENT_EXAM_ATTEMPTS_KEY = "freshoRecentExamAttempts";
const IN_PROGRESS_EXAM_KEY = "freshoInProgressExam";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

console.log("BACKEND_URL configured:", BACKEND_URL);

export function getRecentExamAttempts(): RecentExamAttempt[] {
  try {
    const attempts: unknown = JSON.parse(localStorage.getItem(RECENT_EXAM_ATTEMPTS_KEY) || "[]");
    return Array.isArray(attempts)
      ? (attempts as RecentExamAttempt[])
          .filter((attempt) => attempt && typeof attempt.completedAt === "string")
          .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentExamAttempt(attempt: RecentExamAttempt): void {
  const attempts = getRecentExamAttempts().filter((item) => item.id !== attempt.id);
  attempts.unshift(attempt);
  localStorage.setItem(RECENT_EXAM_ATTEMPTS_KEY, JSON.stringify(attempts.slice(0, 5)));
  window.dispatchEvent(new Event("fresho:exam-history-updated"));
}

export function getSavedExamProgress(examId?: number): SavedExamProgress | null {
  try {
    const progress = JSON.parse(localStorage.getItem(IN_PROGRESS_EXAM_KEY) || "null") as SavedExamProgress | null;
    if (!progress || (examId !== undefined && progress.exam.id !== examId)) return null;
    return progress;
  } catch {
    return null;
  }
}

export function getInProgressExam(): ExamMeta | null {
  return getSavedExamProgress()?.exam ?? null;
}

export function saveExamProgress(progress: SavedExamProgress): void {
  localStorage.setItem(IN_PROGRESS_EXAM_KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event("fresho:exam-progress-updated"));
}

export function clearExamProgress(examId: number): void {
  if (getSavedExamProgress(examId)) {
    localStorage.removeItem(IN_PROGRESS_EXAM_KEY);
    window.dispatchEvent(new Event("fresho:exam-progress-updated"));
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const isAdminRequest =
    headers.has("x-admin-key") ||
    headers.has("x-admin-secret") ||
    headers.has("x-admin-password");
  const fullPath = isAdminRequest ? path : `${BACKEND_URL}${path}`;

  console.log(`📡 API Request: ${fullPath}`, options?.method || "GET");

  if (process.env.NEXT_PUBLIC_BROWSER_DEMO_MODE === "true") {
    headers.set("X-Fresho-Demo-Mode", "true");
    headers.set(
      "X-Fresho-User-Id",
      process.env.NEXT_PUBLIC_BROWSER_DEMO_USER_ID || "900000001"
    );
  }
  if (typeof window !== "undefined") {
    const userId = localStorage.getItem("freshoTelegramUserId");
    const deviceId = localStorage.getItem("freshoDeviceId");
    const sessionToken = localStorage.getItem("freshoDeviceSessionToken");
    if (userId) headers.set("X-Fresho-User-Id", userId);
    if (deviceId) headers.set("X-Fresho-Device-Id", deviceId);
    if (sessionToken) headers.set("X-Fresho-Session-Token", sessionToken);
  }

  const response = await fetch(fullPath, {
    ...options,
    headers,
    cache: "no-store",
  });

  console.log(`📡 API Response: ${fullPath} - Status: ${response.status}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`❌ API Error: ${fullPath}`, error);
    const detail = error.detail;
    const code = typeof detail === "object" && detail !== null && "code" in detail
      ? String(detail.code)
      : undefined;
    const errorMessage = typeof detail === "object" && detail !== null && "message" in detail
      ? String(detail.message)
      : typeof detail === "string"
        ? detail
        : error.error || `Request failed: ${response.status}`;
    throw new ApiRequestError(errorMessage, response.status, code);
  }

  const data = await response.json();
  console.log(`✅ API Success: ${fullPath}`, data);
  return data;
}

export interface DeviceSessionResponse {
  user_id: number;
  session_token: string;
}

export async function startDeviceSession(payload: {
  init_data: string;
  device_id: string;
  session_token?: string;
}): Promise<DeviceSessionResponse> {
  return request<DeviceSessionResponse>("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function releaseDeviceSession(payload: {
  init_data: string;
  device_id: string;
  session_token: string;
}): Promise<void> {
  await request("/api/auth/device-session", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

function getAdminHeaders(): HeadersInit {
  const storedKey = typeof window !== "undefined" ? sessionStorage.getItem("freshoAdminKey") : "";
  const adminSecret = (storedKey ?? "").trim();
  return {
    "Content-Type": "application/json",
    "X-Admin-Secret": adminSecret,
    "X-Admin-Key": adminSecret,
    "X-Admin-Password": adminSecret,
  };
}

export async function getExams(subject?: string, university?: string): Promise<ExamMeta[]> {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (university) params.set("university", university);
  return request<ExamMeta[]>(`/api/exams?${params.toString()}`);
}

export async function getExam(id: number): Promise<Exam> {
  return request<Exam>(`/api/exams/${id}`);
}

export async function submitExamAttempt(
  examId: number,
  attempt: {
    user_id: number;
    first_name?: string;
    score?: number;
    time_spent?: number;
    total_questions?: number;
    answers_json?: string;
    completed_at?: string;
  }
): Promise<{
  id: number;
  exam_id: number;
  score: number;
  xp_awarded: number;
  total_xp: number;
  level: number;
  level_up: boolean;
  streak: number;
  frozen_streaks: number;
  badges_awarded: string[];
}> {
  return request(`/api/exams/${examId}/attempts`, {
    method: "POST",
    body: JSON.stringify({
      user_id: attempt.user_id,
      first_name: attempt.first_name,
      score: attempt.score,
      time_spent: attempt.time_spent,
      total_questions: attempt.total_questions,
      answers_json: attempt.answers_json,
      completed_at: attempt.completed_at,
    }),
  });
}

export async function getNotes(subject: string, stream?: string): Promise<NoteMeta[]> {
  const streamParam = stream ? `&stream=${encodeURIComponent(stream)}` : "";
  return request<NoteMeta[]>(
    `/api/notes?subject=${encodeURIComponent(subject)}${streamParam}`
  );
}

export async function getNote(id: number): Promise<Note> {
  return request<Note>(`/api/notes/${id}`);
}

export async function getFlashCards(): Promise<FlashCard[]> {
  return request<FlashCard[]>("/api/flash-cards");
}

export async function getFlashCard(id: number): Promise<FlashCard> {
  return request<FlashCard>(`/api/flash-cards/${id}`);
}

export async function getChapterExam(id: number): Promise<ChapterExam> {
  return request<ChapterExam>(`/api/chapter-exams/${id}`);
}

export async function getChapterExams(filters: {
  subject?: string;
  stream?: string;
  note_id?: number;
} = {}): Promise<ChapterExamMeta[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return request<ChapterExamMeta[]>(`/api/chapter-exams${query ? `?${query}` : ""}`);
}

export async function getNoteChapterExam(noteId: number): Promise<ChapterExamMeta | null> {
  const result = await request<{ exists: boolean; exam?: ChapterExamMeta }>(`/api/notes/${noteId}/chapter-exam`);
  return result.exam ?? null;
}

export async function adminGetChapterExams(): Promise<ChapterExamMeta[]> {
  return request<ChapterExamMeta[]>("/api/admin/chapter-exams", {
    headers: getAdminHeaders(),
  });
}

export async function adminCreateChapterExam(exam: ChapterExamInput): Promise<ChapterExam> {
  return request<ChapterExam>("/api/chapter-exams", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(exam),
  });
}

export async function adminUpdateChapterExam(examId: number, exam: ChapterExamInput): Promise<ChapterExam> {
  return request<ChapterExam>(`/api/chapter-exams/${examId}`, {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(exam),
  });
}

export async function adminDeleteChapterExam(examId: number): Promise<void> {
  await request(`/api/chapter-exams/${examId}`, { method: "DELETE", headers: getAdminHeaders() });
}

export async function adminToggleChapterExamPremium(examId: number): Promise<{ id: number; is_premium: boolean }> {
  return request(`/api/admin/chapter-exams/${examId}/toggle-premium`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export async function submitChapterExamAttempt(
  examId: number,
  attempt: { user_id: number; score: number; total_questions: number; answers_json: string; completed_at: string }
): Promise<{
  id: number;
  exam_id: number;
  score: number;
  xp_awarded: number;
  total_xp: number;
  level: number;
  level_up: boolean;
  streak: number;
  frozen_streaks: number;
  badges_awarded: string[];
}> {
  return request(`/api/chapter-exams/${examId}/attempts`, {
    method: "POST",
    body: JSON.stringify(attempt),
  });
}

export async function completeNote(userId: number, noteId: number): Promise<{
  message: string;
  xp_awarded: number;
  total_xp?: number;
  level?: number;
  level_up?: boolean;
  streak?: number;
  frozen_streaks?: number;
  badges_awarded?: string[];
}> {
  return request(`/api/user/${userId}/note-complete`, {
    method: "POST",
    body: JSON.stringify({ note_id: noteId }),
  });
}

export async function freezeStreak(userId: number): Promise<{ frozen_streaks: number }> {
  return request(`/api/user/${userId}/freeze-streak`, { method: "POST" });
}

export async function getUserProgress(userId: number): Promise<UserProgress> {
  return request<UserProgress>(`/api/user/${userId}/profile`);
}

export async function getUser(userId: number): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/user/${userId}`);
  } catch {
    return null;
  }
}

export async function submitSubjectSuggestion(payload: {
  stream: StreamKey;
  subject_name: string;
  reason?: string;
}): Promise<SubjectSuggestion> {
  return request<SubjectSuggestion>("/api/subject-suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminGetSubjectSuggestions(): Promise<SubjectSuggestion[]> {
  return request<SubjectSuggestion[]>("/api/admin/subject-suggestions", {
    headers: getAdminHeaders(),
  });
}

export async function adminReviewSubjectSuggestion(
  suggestionId: number,
  status: "approved" | "rejected"
): Promise<SubjectSuggestion> {
  return request<SubjectSuggestion>(`/api/admin/subject-suggestions/${suggestionId}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function updateUser(
  userId: number,
  data: {
    first_name?: string;
    full_name?: string;
    custom_name?: string;
    university?: string;
    region?: string;
    school?: string;
    city?: string;
    stream: string;
    selected_subjects: string[];
    premium_expires_at?: string | null;
  }
): Promise<UserProfile> {
  return request<UserProfile>("/api/user/profile", {
    method: "POST",
    body: JSON.stringify({ telegram_id: userId, ...data }),
  });
}

export async function getUserStats(userId: number): Promise<UserStats | null> {
  try {
    return await request<UserStats>(`/api/user/${userId}/stats`);
  } catch {
    return null;
  }
}

export interface DailyCheckIn {
  daily_streak: number;
  frozen_streaks: number;
  is_new_day: boolean;
  checked_in_date: string;
}

export async function dailyCheckIn(userId: number): Promise<DailyCheckIn> {
  return request<DailyCheckIn>(`/api/user/${userId}/daily-check-in`, { method: "POST" });
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  university: string | null;
  university_logo?: string | null;
  region: string | null;
  attempt_count?: number;
  avg_score?: number;
  best_score?: number | null;
  xp?: number;
  level?: number;
  rank_info?: { name: string; min_xp: number; emoji: string };
  is_premium?: boolean;
  is_current_user?: boolean;
}

export async function getLeaderboard(
  period: "weekly" | "all_time" = "all_time",
  type: "score" | "xp" = "score",
  userId?: number,
  stream?: StreamKey,
  university?: string
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({ period, type });
  if (userId) params.set("user_id", String(userId));
  if (stream) params.set("stream", stream);
  if (university) params.set("university", university);
  return request<LeaderboardEntry[]>(`/api/leaderboard?${params}`);
}

export interface UniversityLogo {
  id: number;
  university: string;
  data_uri: string;
  created_at: string;
}

export async function adminGetUniversityLogo(): Promise<UniversityLogo[]> {
  return request<UniversityLogo[]>("/api/admin/university-logo", {
    headers: getAdminHeaders(),
  });
}

export async function adminPutUniversityLogo(payload: {
  university: string;
  data_uri: string;
}): Promise<UniversityLogo> {
  return request<UniversityLogo>("/api/admin/university-logo", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getUniversityLogo(university: string): Promise<UniversityLogo | null> {
  try {
    return await request<UniversityLogo | null>(`/api/university-logo?university=${encodeURIComponent(university)}`);
  } catch {
    return null;
  }
}

// Admin API functions
export interface AdminExamMeta extends ExamMeta {
  attempt_count: number;
}

export async function adminGetExams(): Promise<AdminExamMeta[]> {
  return request<AdminExamMeta[]>("/api/admin/exams", {
    headers: getAdminHeaders(),
  });
}

export async function adminGetExam(id: number): Promise<Exam> {
  return request<Exam>(`/api/admin/exams/${id}`, {
    headers: getAdminHeaders(),
  });
}

// Broadcast system
export interface Broadcast {
  id: number;
  message: string;
  target_audience: "all" | "premium" | "free";
  created_at: string;
  expires_at?: string | null;
  is_active: boolean;
}

export async function adminGetBroadcasts(): Promise<Broadcast[]> {
  return request<Broadcast[]>("/api/admin/broadcasts", {
    headers: getAdminHeaders(),
  });
}

export async function adminCreateBroadcast(payload: {
  message: string;
  target_audience: "all" | "premium" | "free";
  expires_at?: string | null;
}): Promise<Broadcast> {
  return request<Broadcast>("/api/admin/broadcasts", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteBroadcast(id: number): Promise<void> {
  await request(`/api/admin/broadcasts/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function getActiveBroadcasts(isPremium: boolean): Promise<Broadcast[]> {
  try {
    const broadcasts = await request<Broadcast[]>("/api/broadcasts/active");
    return broadcasts.filter(b => {
      if (b.target_audience === "all") return true;
      if (b.target_audience === "premium") return isPremium;
      if (b.target_audience === "free") return !isPremium;
      return false;
    });
  } catch {
    return [];
  }
}
    headers: getAdminHeaders(),
  });
}

export async function adminGetNotes(): Promise<NoteMeta[]> {
  return request<NoteMeta[]>("/api/admin/notes", {
    headers: getAdminHeaders(),
  });
}

export async function adminGetFlashCards(): Promise<FlashCard[]> {
  return request<FlashCard[]>("/api/admin/flash-cards", {
    headers: getAdminHeaders(),
  });
}

export async function adminCreateFlashCard(flashCard: Omit<FlashCard, "id" | "created_at">): Promise<FlashCard> {
  return request<FlashCard>("/api/admin/flash-cards", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(flashCard),
  });
}

export async function adminUpdateFlashCard(id: number, flashCard: Omit<FlashCard, "id" | "created_at">): Promise<FlashCard> {
  return request<FlashCard>(`/api/admin/flash-cards/${id}`, {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(flashCard),
  });
}

export async function adminDeleteFlashCard(id: number): Promise<void> {
  await request(`/api/admin/flash-cards/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export interface AdminAnalytics {
  total_students: number;
  total_attempts: number;
  avg_score: number;
  active_students_7d: number;
  active_subscribers: number;
  monthly_revenue: number;
  monthly_operating_cost: number;
  estimated_profit: number;
  monthly_growth: number;
  new_subscriptions_this_month: number;
  grade_distribution: Array<{ grade: number; students: number }>;
  stream_distribution: Array<{ stream: string; students: number }>;
  subject_performance: Array<{ subject: string; attempts: number; average_score: number }>;
  recent_attempts: Array<{
    id: number;
    user_name: string;
    exam_title: string;
    exam_subject: string;
    score: number | null;
    total_questions: number;
    time_spent: number | null;
    completed_at: string | null;
    created_at: string;
  }>;
}

export interface SubscriptionConfig {
  price: number;
  currency: string;
  monthly_operating_cost: number;
}

export async function adminGetSubscriptionConfig(): Promise<SubscriptionConfig> {
  return request<SubscriptionConfig>("/api/admin/subscription-config", {
    headers: getAdminHeaders(),
  });
}

export async function adminUpdateSubscriptionConfig(
  config: SubscriptionConfig
): Promise<SubscriptionConfig> {
  return request<SubscriptionConfig>("/api/admin/subscription-config", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(config),
  });
}

export async function adminGetAnalytics(): Promise<AdminAnalytics> {
  return request<AdminAnalytics>("/api/admin/analytics", {
    headers: getAdminHeaders(),
  });
}

export async function adminCreateExam(exam: Omit<Exam, "id">): Promise<Exam> {
  return request<Exam>("/api/exams", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(exam),
  });
}

export async function adminUpdateExam(examId: number, exam: Omit<Exam, "id">): Promise<Exam> {
  return request<Exam>(`/api/admin/exams/${examId}`, {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(exam),
  });
}

export async function adminDeleteExam(examId: number): Promise<void> {
  return request(`/api/admin/exams/${examId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function adminToggleExamPublish(examId: number): Promise<{ id: number; is_published: boolean }> {
  return request(`/api/admin/exams/${examId}/toggle-publish`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}

export async function adminCreateNote(note: Omit<Note, "id">): Promise<Note> {
  return request<Note>("/api/notes", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(note),
  });
}

export async function adminUpdateNote(noteId: number, note: Omit<Note, "id">): Promise<Note> {
  return request<Note>(`/api/admin/notes/${noteId}`, {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(note),
  });
}

export async function adminDeleteNote(noteId: number): Promise<void> {
  return request(`/api/admin/notes/${noteId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function adminToggleNotePublish(noteId: number): Promise<{ id: number; is_published: boolean }> {
  return request(`/api/admin/notes/${noteId}/toggle-publish`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });
}
