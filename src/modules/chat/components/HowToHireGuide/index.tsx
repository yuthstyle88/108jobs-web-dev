"use client";

import {CircleHelp} from "lucide-react";
import {useState} from "react";
import {useTranslation} from "react-i18next";
import {HowToHireModal, type HowToHireCopy} from "@/modules/chat/components/HowToHireModal";

export const HowToHireGuide = () => {
    const {t} = useTranslation();
    const [isHowToHireOpen, setIsHowToHireOpen] = useState(false);
    const howToHireCopy: HowToHireCopy = {
        title: t("profileChat.howToHire.title"),
        closeLabel: t("profileChat.howToHire.close"),
        dismissLabel: t("profileChat.howToHire.dismiss"),
        steps: [
            {
                title: t("profileChat.howToHire.discuss.title"),
                items: [
                    t("profileChat.howToHire.discuss.scope"),
                    t("profileChat.howToHire.discuss.price"),
                ],
            },
            {
                title: t("profileChat.howToHire.pay.title"),
                items: [
                    t("profileChat.howToHire.pay.quotation"),
                    t("profileChat.howToHire.pay.payment"),
                ],
            },
            {
                title: t("profileChat.howToHire.review.title"),
                items: [
                    t("profileChat.howToHire.review.delivery"),
                    t("profileChat.howToHire.review.approval"),
                ],
            },
        ],
        hintTitle: t("profileChat.howToHire.hintTitle"),
        hint: t("profileChat.howToHire.hint"),
    };

    return (
        <>
            <div className="flex flex-1 items-center justify-center px-6 py-12">
                <div className="max-w-sm text-center">
                    <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">
                        {t("profileChat.howToHire.promptTitle")}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 sm:text-base">
                        {t("profileChat.howToHire.promptSubtitle")}
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsHowToHireOpen(true)}
                        className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <CircleHelp className="size-4" aria-hidden="true"/>
                        {t("profileChat.howToHire.open")}
                    </button>
                </div>
            </div>
            <HowToHireModal
                isOpen={isHowToHireOpen}
                onClose={() => setIsHowToHireOpen(false)}
                copy={howToHireCopy}
            />
        </>
    );
};
