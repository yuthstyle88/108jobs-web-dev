"use client";

import {useState} from "react";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import Modal from "@/components/ui/Modal";
import {useJobsTerms} from "@/hooks/api/terms/useJobsTerms";
import {getAppName} from "@/utils/appConfig";

/**
 * Asks for this site's terms once, and only once the server has said they are
 * missing.
 *
 * Scoped to the jobs sub-app on purpose. Accepting here records consent for
 * `Jobs` and nothing else -- the ride service on 108heros.com is a separate
 * agreement with a separate acceptance, and a single dialog that covered both
 * would be the exact cross-app consent the split exists to prevent.
 *
 * Dismissible. Someone who declines keeps their account, their chat and their
 * profile; what they lose is the jobs surfaces, which the API refuses for them
 * anyway. Trapping them in a modal they cannot close would leave "decline" only
 * reachable by closing the tab.
 */
const TermsGate = () => {
  const {needsAcceptance, version, accepting, accept} = useJobsTerms();
  const {t} = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (!needsAcceptance || dismissed) return null;

  const onAccept = async () => {
    const ok = await accept();
    if (!ok) {
      // Stay open. The request did not land, or the server moved to a version
      // this dialog was not showing -- dismissing now would leave the user
      // believing they had accepted something they had not.
      toast.error(t("terms.acceptFailed"));
      return;
    }
    toast.success(t("terms.accepted"));
  };

  return (
    <Modal
      isOpen
      onClose={() => setDismissed(true)}
      closeOnOutsideClick={false}
      title={t("terms.title", {appName: getAppName()})}
    >
      <div className="flex flex-col gap-4 text-sm text-text-secondary">
        <p>{t("terms.body", {appName: getAppName()})}</p>
        <p className="text-xs text-gray-500">
          {t("terms.versionLabel")}: <span data-testid="terms-version">{version}</span>
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={accepting}
            className="px-4 py-2 rounded-md border border-gray-300 text-text-secondary disabled:opacity-50"
          >
            {t("terms.later")}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50"
          >
            {accepting ? t("terms.accepting") : t("terms.accept")}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TermsGate;
