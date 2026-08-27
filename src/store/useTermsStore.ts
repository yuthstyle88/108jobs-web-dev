import {create} from "zustand";

/**
 * This site's terms-of-service consent, as the server reports it.
 *
 * Kept out of `useUserStore` on purpose: consent is no longer a field on the
 * user. It is a per-app, per-version record with its own endpoint, and one user
 * can be on record for the jobs terms while having nothing on record for the
 * ride terms on 108heros.com. Folding it back into the user object would
 * re-create exactly the single-boolean shape the split was made to remove.
 *
 * Only the jobs side lives here -- this is the jobs site. The ride sub-app
 * carries its own consent and nothing here should ever be read as speaking for
 * it.
 */
type TermsStore = {
  /**
   * Whether the server has this user on record for the jobs terms version
   * currently in force. `false` until proven otherwise: a check that did not
   * complete must not read as acceptance.
   */
  jobsAccepted: boolean;
  /**
   * The version the server currently enforces. Echoed back verbatim when
   * accepting -- the server refuses any other value, so a remembered or
   * invented version fails rather than being recorded.
   */
  jobsVersion?: string;
  /**
   * Whether the status endpoint has answered at least once this session.
   *
   * Distinct from `jobsAccepted === false`, and the distinction matters: before
   * the first answer we do not know, and a prompt shown on "do not know" would
   * flash in front of users who have already accepted.
   */
  loaded: boolean;
  setStatus: (status: {jobsAccepted: boolean; jobsVersion: string}) => void;
  /**
   * Drop everything back to the pre-login state.
   *
   * Must run on logout. Without it, one person's acceptance survives in the tab
   * and the next account to log in on the same browser inherits it -- consent
   * recorded against the wrong person, which is the one thing this whole
   * mechanism exists to make impossible.
   */
  reset: () => void;
};

export const useTermsStore = create<TermsStore>((set) => ({
  jobsAccepted: false,
  jobsVersion: undefined,
  loaded: false,
  setStatus: ({jobsAccepted, jobsVersion}) =>
    set({jobsAccepted, jobsVersion, loaded: true}),
  reset: () => set({jobsAccepted: false, jobsVersion: undefined, loaded: false}),
}));
