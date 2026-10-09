export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://freshman-backend.onrender.com"
    : "http://localhost:8000");
