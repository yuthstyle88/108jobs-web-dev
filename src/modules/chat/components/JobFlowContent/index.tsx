import React from "react";
import Link from "next/link";
import {useTranslation} from "react-i18next";
import {HowToHireGuide} from "@/modules/chat/components/HowToHireGuide";

interface JobFlowContentProps {
    renderFlowContent: () => React.ReactNode;
    jobId?: number;
    lang: string;
}

/** The Orders tab shows hiring guidance without a job and the workflow when linked. */
export const JobFlowContent: React.FC<JobFlowContentProps> = ({renderFlowContent, jobId, lang}) => {
    const {t} = useTranslation();

    if (!jobId) return <HowToHireGuide/>;

    return (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <Link href={`/${lang}/job-board/${jobId}`}>{t("profileChat.jobDetails")}</Link>
            {renderFlowContent()}
        </div>
    );
};
