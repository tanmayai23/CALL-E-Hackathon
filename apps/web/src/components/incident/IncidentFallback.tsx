"use client";

/**
 * The non-success states of the Live Call Theatre.
 *
 * §8 requires all five states on every screen, and the loading skeleton must
 * match the shape of the real layout — a centred spinner causes layout shift
 * when content arrives, which is visible on camera.
 */

import Link from "next/link";
import { OctagonAlert, RotateCw, ShieldOff } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button, buttonStyles } from "@/components/ui/Button";
import { THEATRE_GRID } from "./layout";

export function IncidentNotFound({ incidentId }: { incidentId: string }) {
  return (
    <div className="p-6">
      <EmptyState
        icon={OctagonAlert}
        title={`No incident ${incidentId}`}
        body="This incident is not in the store. If the server restarted, in-flight runs were lost — trigger a fresh scenario from the simulator."
        action={
          <Link
            href="/ops/simulator"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            Open the simulator
          </Link>
        }
      />
    </div>
  );
}

export function IncidentLoadError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <EmptyState
        icon={ShieldOff}
        title="Could not load this incident"
        body={message ?? "The incident API did not respond."}
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

export function IncidentSkeleton() {
  return (
    <div className={`grid gap-3 p-3 ${THEATRE_GRID}`}>
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[104px] w-full" />
      </div>
      <Skeleton className="h-[520px] w-full" />
      <Skeleton className="h-[520px] w-full" />
    </div>
  );
}
