"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { useHttpPut } from "@/hooks/api/http/useHttpPut";
import { isFailed, isSuccess } from "@/services/HttpService";
import { useUserStore } from "@/store/useUserStore";

export default function AccountManagePage() {
    const { t } = useTranslation();
    const { user, updateUser } = useUserStore();
    const [isSaving, setIsSaving] = useState(false);

    const { execute: saveUserSettings } = useHttpPut("saveUserSettings");

    const secureChatEnabled = user?.secureChatEnabled ?? false;

    const handleToggle = async () => {
        if (!user || isSaving) return;
        const next = !secureChatEnabled;

        // Optimistic: the switch should move on click, not after the
        // round-trip. Reverted below if the save fails.
        updateUser({ secureChatEnabled: next });
        setIsSaving(true);
        const res = await saveUserSettings({ secureChatEnabled: next });
        setIsSaving(false);

        if (isSuccess(res)) {
            toast.success(
                next
                    ? t("accountManage.secureChat.enabled")
                    : t("accountManage.secureChat.disabled"),
            );
        } else if (isFailed(res)) {
            updateUser({ secureChatEnabled: !next });
            toast.error(t("accountManage.secureChat.saveError"));
        }
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-md border border-border-primary p-6 space-y-8">
                {/* Header */}
                <div>
                    <h2 className="text-xl font-semibold text-black">
                        {t("accountManage.title")}
                    </h2>
                    <p className="text-sm text-gray-600">
                        {t("accountManage.description")}
                    </p>
                </div>

                {/* Secure Chat */}
                <div className="border rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                        {t("accountManage.secureChat.title")}
                    </h3>

                    <div className="flex justify-between items-center gap-4">
                        <label htmlFor="secure-chat-toggle" className="flex flex-col cursor-pointer">
                            <span className="text-sm font-medium text-gray-800">
                                {t("accountManage.secureChat.toggleLabel")}
                            </span>
                            <span className="text-xs text-gray-500">
                                {t("accountManage.secureChat.toggleHint")}
                            </span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                id="secure-chat-toggle"
                                type="checkbox"
                                className="sr-only peer"
                                checked={secureChatEnabled}
                                disabled={!user || isSaving}
                                onChange={handleToggle}
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-disabled:opacity-50 transition-colors duration-200 relative">
                                <span
                                    className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                                        secureChatEnabled ? "translate-x-5" : ""
                                    }`}
                                />
                            </div>
                        </label>
                    </div>

                    {/* What this does and does not protect against. The second
                        paragraph is deliberate: the platform holds the key. */}
                    <p className="text-xs text-gray-500">
                        {t("accountManage.secureChat.bodyInTransit")}
                    </p>
                    <p className="text-xs text-gray-500">
                        {t("accountManage.secureChat.bodyNotE2e")}
                    </p>
                </div>
            </div>
        </div>
    );
}
