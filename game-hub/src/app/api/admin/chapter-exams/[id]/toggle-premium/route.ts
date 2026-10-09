import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../../../admin-proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/admin/chapter-exams/${params.id}/toggle-premium`);
}
