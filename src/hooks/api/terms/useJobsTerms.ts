"use client";

import {useCallback, useEffect, useState} from "react";
import {useTermsStore} from "@/store/useTermsStore";
import {UserService} from "@/services/UserService";
import {useUserStore} from "@/store/useUserStore";

/**
 * This site's terms consent, for components that need to gate on it.
 *
 * Hydrates on first use rather than relying on `UserService.login()` having
 * run: a page reload restores the session from a cookie without ever going
 * through the login path, so a component that trusted login-time hydration
 * would see `false` for every returning user and hide the whole jobs section
 * from people who accepted months ago.
 *
 * Reads the jobs consent only. The ride sub-app on 108heros.com records its own
 * and nothing here speaks for it.
 */
export function useJobsTerms() {
  const accepted = useTermsStore((s) => s.jobsAccepted);
  const version = useTermsStore((s) => s.jobsVersion);
  const loaded = useTermsStore((s) => s.loaded);
  const userInfo = useUserStore((s) => s.userInfo);
  const isLoggedIn = Boolean(userInfo);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || loaded) return;
    void UserService.Instance.hydrateTerms();
  }, [isLoggedIn, loaded]);

  const accept = useCallback(async () => {
    setAccepting(true);
    try {
      return await UserService.Instance.acceptJobsTerms();
    } finally {
      setAccepting(false);
    }
  }, []);

  return {
    accepted,
    version,
    /**
     * True only once the server has actually answered. Gate any prompt on this,
     * never on `!accepted` alone -- otherwise the prompt flashes in front of
     * users who have already accepted, on every page load, before the check
     * comes back.
     */
    loaded,
    accepting,
    /** Show the prompt: we know the answer, and the answer is no. */
    needsAcceptance: isLoggedIn && loaded && !accepted,
    accept,
  };
}
