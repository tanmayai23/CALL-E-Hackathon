"use client";

/**
 * §7.4 — connection status is visible, always.
 *
 * A frozen dashboard that still looks fine is far worse on camera than one that
 * honestly says it is reconnecting. `dropped` counts frames that failed Zod
 * validation at the boundary; showing it is cheap honesty.
 */

import { StateChip } from "@/components/ui/StateChip";
import { Radio, WifiOff } from "lucide-react";

export function ConnectionStatus({
  connected,
  dropped = 0,
}: {
  connected: boolean;
  dropped?: number;
}) {
  return (
    <span className="flex items-center gap-2">
      {connected ? (
        <StateChip state="active" icon={Radio} size="sm" pulse>
          Live
        </StateChip>
      ) : (
        <StateChip state="warning" icon={WifiOff} size="sm">
          Reconnecting…
        </StateChip>
      )}
      {dropped > 0 && (
        <span className="micro" title="Events that failed schema validation at the boundary">
          {dropped} dropped
        </span>
      )}
    </span>
  );
}
