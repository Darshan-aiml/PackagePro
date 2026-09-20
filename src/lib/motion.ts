// Shared motion presets (Apple-style: snappy springs, minimal overshoot —
// damping ~1.0 default; bouncier only for momentum-driven moments).

import { type Transition } from "motion/react";

export const tapSpring: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 30,
};

export const springTap = {
  whileTap: { scale: 0.97 },
  transition: tapSpring,
} as const;

/** Interruptible enter for sheets/cards — low overshoot. */
export const sheetSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
};

/** List reordering via AnimatePresence + layout. */
export const listSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 24,
};