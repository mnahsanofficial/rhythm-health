"use client";

import { MotionConfig } from "motion/react";

/** Follows the OS reduced-motion setting: transforms and layout animations turn off, opacity stays. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
