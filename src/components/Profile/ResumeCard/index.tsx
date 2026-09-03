"use client";
import React from "react";
import Link from "next/link";
import {useTranslation} from "react-i18next";
import {FileText, Upload} from "lucide-react";
import {Person} from "@108-plaza/jh-client";
import EditButton from "@/components/Profile/EditButton";
import EmptyState from "@/components/Profile/EmptyState";

interface ResumeCardProps {
    profile: Person;
    isOwnProfile: boolean;
}

const ResumeCard: React.FC<ResumeCardProps> = ({profile, isOwnProfile}) => {
    const {t} = useTranslation();

    return (
        <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-primary font-semibold">{t("profileInfo.sectionResume")}</h3>
                {isOwnProfile && (
                    <EditButton
                        href="/account-setting/resume"
                        label={profile.resumeUrl ? "Replace resume" : "Add resume"}
                    />
                )}
            </div>
            {profile.resumeUrl ? (
                <Link
                    href={profile.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                >
                    <FileText className="w-8 h-8 text-primary shrink-0"/>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">
                            {profile.resumeFileName ?? t("profileInfo.resumeFile")}
                        </p>
                        <span className="text-xs text-primary">{t("profileInfo.download") || "Download"}</span>
                    </div>
                </Link>
            ) : (
                <EmptyState
                    icon={Upload}
                    message={t("profile.noResume")}
                    addLabel={isOwnProfile ? "Add resume" : undefined}
                    href={isOwnProfile ? "/account-setting/resume" : undefined}
                />
            )}
        </div>
    );
};

export default ResumeCard;
