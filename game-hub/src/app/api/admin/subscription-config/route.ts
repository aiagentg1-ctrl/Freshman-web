import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../admin-proxy";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, "/api/admin/subscription-config");
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, "/api/admin/subscription-config");
}
