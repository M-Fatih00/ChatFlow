import type { CSSProperties } from "react";

export const stagger = (index: number, step = 35, max = 280): CSSProperties => ({
  animationDelay: `${Math.min(index * step, max)}ms`,
});