import type { Metadata } from "next";
import { OrderTheatre } from "@/components/order/OrderTheatre";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} — Sentinel Ops` };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderTheatre orderId={id} />;
}
