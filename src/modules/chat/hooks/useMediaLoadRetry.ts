"use client";

import {useCallback, useEffect, useRef, useState} from "react";

import {nextMediaRetryDelayMs} from "./mediaRetryPolicy";

export type MediaLoadRetry = {
  /**
   * Put this on the element's `key`. Bumping it forces React to mount a
   * fresh DOM node for the retry, which is what actually makes the browser
   * re-request the resource -- re-rendering with the exact same `src`
   * string does not, because React skips the DOM write when a prop's value
   * has not changed from the previous render.
   */
  attemptKey: number;
  /** Every scheduled retry has failed -- render the permanent fallback. */
  failed: boolean;
  /** Wire to the element's `onError`. */
  handleError: () => void;
};

/**
 * Bounded retry for one attachment's `<img>`/`<video>` load, shared by every
 * place that renders one (`ChatMessageBubble`, `ChatMediaPanel/MediaGrid`)
 * instead of each keeping its own ad hoc `failed` flag. See
 * `mediaRetryPolicy.ts` for why this exists and how the schedule was chosen;
 * this hook is deliberately thin glue around it -- timers and remount
 * bookkeeping only, no policy decisions.
 */
export function useMediaLoadRetry(src: string): MediaLoadRetry {
  const [attemptKey, setAttemptKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new `src` (a different attachment) starts over. Adjusted during
  // render rather than in a `useEffect` -- React's documented "adjusting
  // state when a prop changes" pattern -- so this never trips
  // `react-hooks/set-state-in-effect` and never costs an extra commit
  // before the reset is visible. The guard makes it a no-op on every render
  // that isn't an actual src change, including React Strict Mode's
  // double-invocation of this same render.
  if (prevSrc !== src) {
    setPrevSrc(src);
    setAttemptKey(0);
    setFailed(false);
  }

  // The matching timer reset lives in an effect, not the render branch
  // above, because refs may only be read or written outside of render.
  // Both are keyed on the same `src`, so in practice they land together:
  // the render-phase branch forces React to re-render with the reset state
  // before anything commits, and this effect then runs on that same
  // update -- well before a real `onError` from the freshly-rendered
  // element could possibly fire.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [src]);

  // Unmount-only cleanup for a still-pending retry timer. The room's
  // message list is virtualized and mounts/unmounts bubbles as the user
  // scrolls, so a scheduled retry must never fire into a detached element.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleError = useCallback(() => {
    const delay = nextMediaRetryDelayMs(attemptKey + 1);
    if (delay === null) {
      setFailed(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAttemptKey((k) => k + 1);
    }, delay);
  }, [attemptKey]);

  return {attemptKey, failed, handleError};
}
