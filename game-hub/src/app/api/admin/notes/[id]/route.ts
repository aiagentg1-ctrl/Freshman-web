import { NextRequest } from "next/server";
import { proxyAdminRequest, requireAdminKey } from "../../admin-proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/notes/${params.id}`);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/notes/${params.id}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;
  return proxyAdminRequest(request, `/api/notes/${params.id}`);
}
