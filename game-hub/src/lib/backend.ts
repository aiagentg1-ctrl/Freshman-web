export const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.FRESHO_BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://freshman-web.onrender.com"
    : "http://localhost:8000");
