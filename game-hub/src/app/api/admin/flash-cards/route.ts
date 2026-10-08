import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../admin-proxy";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, "/api/admin/flash-cards");
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, "/api/admin/flash-cards");
}
