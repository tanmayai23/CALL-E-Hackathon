"use client";

/**
 * The non-success states of the order screen.
 *
 * All five states are required on every screen, and the loading skeleton must
 * match the shape of the real layout — a centred spinner shifts the layout when
 * content arrives, which is visible on camera.
 */

import Link from "next/link";
import { PackageSearch, RotateCw, ShieldOff } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button, buttonStyles } from "@/components/ui/Button";
import { THEATRE_GRID, THEATRE_WIDE } from "./layout";

export function OrderNotFound({ orderId }: { orderId: string }) {
  return (
    <div className="p-6">
      <EmptyState
        icon={PackageSearch}
        title={`No order ${orderId}`}
        body="This order is not in the store. If the server restarted, in-flight runs were lost — place a fresh order from the simulator."
        action={
          <Link href="/ops/simulator" className={buttonStyles({ variant: "primary", size: "sm" })}>
            Open the simulator
          </Link>
        }
      />
    </div>
  );
}

export function OrderLoadError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="p-6">
      <EmptyState
        icon={ShieldOff}
        title="Could not load this order"
        body={message ?? "The order API did not respond."}
        action={
          <Button variant="primary" size="sm" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </Button>
        }
      />
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className={`grid gap-3 p-3 ${THEATRE_GRID}`}>
      <div className="space-y-3">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-[104px] w-full rounded-lg" />
      </div>
      <Skeleton className="h-[520px] w-full rounded-lg" />
      <Skeleton className={`h-[520px] w-full rounded-lg ${THEATRE_WIDE}`} />
    </div>
  );
}
