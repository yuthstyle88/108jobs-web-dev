"use client";

import { useTranslation } from "react-i18next";

export default function AccountManagePage() {
    const { t } = useTranslation();

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
            </div>
        </div>
    );
}
