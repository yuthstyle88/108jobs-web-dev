"use client";

import React from "react";
import {useTranslation} from "react-i18next";
import {FileText, FileX} from "lucide-react";

import {attachmentSrc, type AttachmentItem} from "@/modules/chat/attachments";
import {formatDateToLong} from "@/utils";
import {getLocale} from "@/utils/date";

import {MediaEmpty} from "./MediaStates";

type Props = {
    items: AttachmentItem[];
    partnerName: string;
    onJump: (messageId: string) => void;
};

/** Short type badge: the mime's subtype, or the filename's extension. */
function typeLabel(name: string, mime?: string): string {
    if (mime) {
        const subtype = mime.split("/").pop();
        if (subtype) return subtype.toUpperCase();
    }
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
}

export const MediaFileList: React.FC<Props> = ({items, partnerName, onJump}) => {
    const {t, i18n} = useTranslation();

    if (items.length === 0) {
        return (
            <MediaEmpty
                messageKey="profileChat.mediaPanel.emptyFiles"
                icon={<FileX className="h-8 w-8 text-gray-300" aria-hidden="true" />}
            />
        );
    }

    return (
        <ul className="divide-y divide-gray-100">
            {items.map((item) => (
                <li key={item.messageId} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                    <span
                        aria-hidden
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500"
                    >
                        <FileText className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900" title={item.attachment.name}>
                            {item.attachment.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                            <span>{typeLabel(item.attachment.name, item.attachment.mime)}</span>
                            <span aria-hidden> · </span>
                            {/* A date, not a time: these are files from across
                                the whole conversation, so "14:32" alone says
                                nothing about which day it landed. */}
                            <span>{formatDateToLong(item.createdAt, getLocale(i18n?.language))}</span>
                            <span aria-hidden> · </span>
                            <span>
                                {t("profileChat.mediaPanel.sentBy", {
                                    name: item.isOwner ? t("profileChat.mediaPanel.you") : partnerName,
                                })}
                            </span>
                        </p>

                        <div className="mt-1.5 flex items-center gap-3">
                            <a
                                href={attachmentSrc(item.attachment)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                                {t("profileChat.mediaPanel.openItem")}
                            </a>
                            <button
                                type="button"
                                onClick={() => onJump(item.messageId)}
                                className="text-xs font-medium text-gray-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                                {t("profileChat.mediaPanel.jumpToMessage")}
                            </button>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};
