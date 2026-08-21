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
  /**
   * The current attempt has actually resolved -- reveal the element and
   * drop whatever quiet placeholder was standing in for it. `false` for the
   * entire pending/retrying window, so a caller can render a neutral
   * skeleton instead of leaving the element to paint the browser's own
   * broken-image icon (and `alt` text) while a 404 is still being retried
   * behind the scenes.
   */
  loaded: boolean;
  /** Wire to the element's `onError`. */
  handleError: () => void;
  /**
   * Wire to whatever event means "this attempt actually got bytes back":
   * `onLoad` for `<img>`. `<video>`/`<audio>` never fire a generic `load`
   * event the way `img` does (confirmed against MDN's HTMLMediaElement
   * event list) -- use `onLoadedMetadata` there instead, which fires once
   * the resource is confirmed reachable and parseable, and does not fire at
   * all when `error` fires instead.
   */
  handleLoad: () => void;
};

/**
 * Bounded retry for one attachment's `<img>`/`<video>` load, shared by every
 * place that renders one (`ChatMessageBubble`, `ChatMediaPanel/MediaGrid`,
 * `ChatMediaPanel/MediaLightbox`) instead of each keeping its own ad hoc
 * `failed` flag. See `mediaRetryPolicy.ts` for why this exists and how the
 * schedule was chosen; this hook is deliberately thin glue around it --
 * timers and remount bookkeeping only, no policy decisions.
 *
 * `loaded` exists so a caller can keep the element mounted (required for
 * `attemptKey` remounts to actually retry) while never letting it paint the
 * browser's own broken-image icon/`alt` text mid-retry: render a neutral
 * placeholder on top and only reveal the element once `loaded` flips. Do
 * not hide the element itself with `display: none` to achieve that --
 * verified (not assumed) against MDN/the IntersectionObserver spec that a
 * `display: none` element has no layout box at all, so it can never be
 * observed as "near the viewport," which would silently stop `<img
 * loading="lazy">` (used in `MediaGrid`) from ever firing its request while
 * hidden. `opacity: 0` (or `visibility: hidden`) keeps the layout box, so
 * the element still fetches and still resolves `loaded`/`failed` normally.
 */
export function useMediaLoadRetry(src: string): MediaLoadRetry {
  const [attemptKey, setAttemptKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new `src` (a different attachment) starts over. Adjusted during
  // render rather than in a `useEffect` -- React's documented "adjusting
  // state when a prop changes" pattern -- so this never trips
  // `react-hooks/set-state-in-effect` and never costs an extra commit
  // before the reset is visible. The guard makes it a no-op on every render
  // that isn't an actual src change, including React Strict Mode's
  // double-invocation of this same render.
  //
  // `loaded` resets here too, not just `attemptKey`/`failed`: without it, a
  // fast-following message pointed at a *new* `src` would inherit the
  // previous attachment's `loaded === true` for one render, which would
  // reveal the fresh (not-yet-fetched) element instead of the placeholder --
  // exactly the bare-broken-image flash this hook exists to prevent, just
  // relocated to the moment `src` changes instead of first mount.
  if (prevSrc !== src) {
    setPrevSrc(src);
    setAttemptKey(0);
    setFailed(false);
    setLoaded(false);
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
    // Almost always already `false` here -- a no-op React bails out of --
    // except for `ChatMessageBubble`'s local-preview swap: the sender's own
    // blob preview can resolve `loaded = true`, then get released in favour
    // of `attachmentUrl` on the very same, still-mounted element (no
    // `attemptKey` bump, since that swap doesn't go through this
    // function). If that network fetch then errors, this is what stops the
    // now-stale `loaded = true` from revealing the browser's broken-image
    // icon underneath -- `loaded` means "the most recent attempt resolved
    // and nothing has failed since," not just "has ever resolved."
    setLoaded(false);
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

  // No dependency on `attemptKey`/`src`: a successful load always means
  // "reveal what's on screen right now," never anything that needs to
  // compare against which attempt this was. Stable identity also means a
  // caller can hand this straight to `onLoad`/`onLoadedMetadata` without it
  // forcing a fresh listener on every retry.
  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  return {attemptKey, failed, loaded, handleError, handleLoad};
}
