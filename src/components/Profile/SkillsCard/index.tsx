"use client";
import React from "react";
import {useTranslation} from "react-i18next";
import {Person} from "108jobs-client";
import EditButton from "@/components/Profile/EditButton";

interface SkillsCardProps {
    profile: Person;
    isOwnProfile: boolean;
}

const SkillsCard: React.FC<SkillsCardProps> = ({profile, isOwnProfile}) => {
    const {t} = useTranslation();

    return (
        <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-primary font-semibold">{t("profile.coreSkills")}</h3>
                {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit skills"/>}
            </div>
            <div className="flex flex-wrap gap-2">
                {profile?.skills ? (
                    profile.skills.split(",").map((skill, index) => (
                        <span
                            key={index}
                            className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
                        >
                            {skill.trim()}
                        </span>
                    ))
                ) : (
                    <p className="text-gray-600 text-sm">{t("profile.noSkills")}</p>
                )}
            </div>
        </div>
    );
};

export default SkillsCard;
