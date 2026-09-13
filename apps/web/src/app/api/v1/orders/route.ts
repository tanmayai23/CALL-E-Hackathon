import { NextResponse } from "next/server";
import { listOrders } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders — every coordination request, newest first (filter: status). */
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");

  let orders = listOrders();
  if (status) orders = orders.filter((o) => o.status === status);

  return NextResponse.json({ orders, source: "mock" });
}
