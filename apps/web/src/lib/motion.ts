/** Motion tokens — FRONTEND_DESIGN_PLUGINS.md §6.2. */

import type { Transition } from "framer-motion";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const T = {
  fast: { duration: 0.15, ease: EASE_OUT_EXPO } satisfies Transition,
  base: { duration: 0.22, ease: EASE_OUT_EXPO } satisfies Transition,
  slow: { duration: 0.35, ease: EASE_OUT_EXPO } satisfies Transition,
  spring: { type: "spring", stiffness: 380, damping: 30 } satisfies Transition,
  stagger: 0.06,
} as const;

/** §6.3 #2 — transcript turns rise 8px into place. */
export const riseIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

/** §6.3 #3 — structured result fields land from the left, 60ms apart. */
export const landIn = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
};
