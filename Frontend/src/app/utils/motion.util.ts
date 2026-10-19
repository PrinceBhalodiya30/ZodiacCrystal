/** True when the user has asked their OS for reduced motion; JS-driven animation should skip to the end state. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** 'smooth' normally, 'auto' (instant) for users who prefer reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
