import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "https://mirkuz-telegram-bot.onrender.com";

export async function GET(request: NextRequest) {
  const search = new URL(request.url).search;
  try {
    const response = await fetch(`${BACKEND_URL}/api/leaderboard${search}`, {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", ...freshoSessionHeaders(request) },
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Leaderboard backend request failed:", error);
    return NextResponse.json({ error: "Leaderboard service is unavailable" }, { status: 502 });
  }
}