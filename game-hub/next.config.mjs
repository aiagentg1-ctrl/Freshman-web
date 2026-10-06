/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_BOT_TOKEN: process.env.NEXT_PUBLIC_BOT_TOKEN,
    NEXT_PUBLIC_BACKEND_URL: process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000",
  },
  images: {
    domains: ["t.me"],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";

    console.log("🔗 Backend URL configured:", backendUrl);

    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
