import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { freshoSessionHeaders } from "@/lib/serverSession";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  console.log("📤 Next.js API: Received exam attempt submission", { examId: params.id, body });

  try {
    const backendUrl = `${BACKEND_URL}/api/exams/${params.id}/attempts`;
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
    console.error("❌ Next.js API: Error submitting attempt:", error);
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 });
  }
}
