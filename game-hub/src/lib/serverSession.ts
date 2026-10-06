import type { NextRequest } from "next/server";

export function freshoSessionHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};
  for (const name of ["x-fresho-user-id", "x-fresho-device-id", "x-fresho-session-token"]) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}