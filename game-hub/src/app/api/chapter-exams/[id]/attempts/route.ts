import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  console.log("📤 Next.js API: Received chapter exam attempt submission", { examId: params.id, body });

  try {
    const backendUrl = `${BACKEND_URL}/api/chapter-exams/${params.id}/attempts`;
    console.log("📤 Next.js API: Forwarding to backend", backendUrl);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...freshoSessionHeaders(request) },
      body: JSON.stringify(body),
    });

    console.log("📥 Next.js API: Backend response status", response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      console.error("❌ Next.js API: Backend error", error);
      return NextResponse.json(error, { status: response.status });
    }

    const responseData = await response.json();
    console.log("✅ Next.js API: Backend success", responseData);
    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("❌ Next.js API: Error submitting chapter exam attempt:", error);
    return NextResponse.json({ error: "Failed to submit chapter exam attempt" }, { status: 500 });
  }
}
