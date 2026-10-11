import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/subscription-pricing`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching subscription pricing:", error);
    return NextResponse.json({ error: "Failed to fetch subscription pricing" }, { status: 502 });
  }
}
