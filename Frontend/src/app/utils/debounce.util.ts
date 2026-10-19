import { DestroyRef, inject } from '@angular/core';

export const SEARCH_DEBOUNCE_MS = 300;

export interface Debounced<T> {
  (value: T): void;
  /** Drops a call that is still waiting, e.g. when the same action is triggered directly. */
  cancel(): void;
}

/**
 * Wraps `fn` so it only runs once calls have stopped for `delayMs`.
 * Must be created in an injection context (a field initializer); a pending call is dropped on destroy.
 */
export function debounced<T>(fn: (value: T) => void, delayMs = SEARCH_DEBOUNCE_MS): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  inject(DestroyRef).onDestroy(cancel);

  const wrapper = ((value: T) => {
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      fn(value);
    }, delayMs);
  }) as Debounced<T>;
  wrapper.cancel = cancel;

  return wrapper;
}
