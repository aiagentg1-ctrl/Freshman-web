import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../admin-proxy";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, "/api/admin/subject-suggestions");
}

export async function PATCH(request: NextRequest, { params }: { params: { suggestion_id: string } }) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/admin/subject-suggestions/${params.suggestion_id}`);
}
