/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_BOT_TOKEN: process.env.NEXT_PUBLIC_BOT_TOKEN,
    NEXT_PUBLIC_BACKEND_URL:
      process.env.FRESHO_BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://freshman-web.onrender.com"
        : "http://localhost:8000"),
    NEXT_PUBLIC_BROWSER_DEMO_MODE: process.env.BROWSER_DEMO_MODE || "false",
    NEXT_PUBLIC_BROWSER_DEMO_USER_ID: process.env.BROWSER_DEMO_USER_ID || "900000001",
  },
  images: {
    domains: ["t.me"],
  },
};

export default nextConfig;
