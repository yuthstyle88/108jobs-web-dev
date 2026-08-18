"use client";

import React from "react";
import {useTranslation} from "react-i18next";

import type {SearchHit} from "@/modules/chat/search/searchMessages";
import {formatDateToLong} from "@/utils";
import {getLocale, toLocalTime} from "@/utils/date";

type Props = {hit: SearchHit; partnerName: string; onSelect: (messageId: string) => void};

export const SearchResultItem: React.FC<Props> = ({hit, partnerName, onSelect}) => {
    const {t, i18n} = useTranslation();

    const before = hit.snippet.slice(0, hit.matchStart);
    const match = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength);
    const after = hit.snippet.slice(hit.matchStart + hit.matchLength);

    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(hit.messageId)}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
                <p className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                        {hit.isOwner ? t("profileChat.mediaPanel.you") : partnerName}
                    </span>
                    {/* Date and time both: a result may be from any point in
                        the conversation, so the time alone does not place it. */}
                    <span>{formatDateToLong(hit.createdAt, getLocale(i18n?.language))}</span>
                    <span>{toLocalTime(hit.createdAt, i18n?.language || "th-TH")}</span>
                </p>
                <p className="mt-0.5 break-words text-sm text-gray-800">
                    {before}
                    <mark className="rounded bg-amber-200 px-0.5 text-gray-900">{match}</mark>
                    {after}
                </p>
            </button>
        </li>
    );
};
