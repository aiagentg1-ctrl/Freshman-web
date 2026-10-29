import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../../../admin-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/admin/users/${params.id}/grant-premium`);
}
