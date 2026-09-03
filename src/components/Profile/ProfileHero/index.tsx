"use client";
import React from "react";
import Image from "next/image";
import {useTranslation} from "react-i18next";
import {BadgeCheck} from "lucide-react";
import {Person, PersonId} from "@108-plaza/jh-client";
import {AssetIcon} from "@/constants/icons";
import {ProfileImage} from "@/constants/images";
import EditButton from "@/components/Profile/EditButton";
import ChatNoWorkButton from "@/components/Common/Button/ChatNoWorkButton";

interface ProfileHeroProps {
    profile: Person;
    isOwnProfile: boolean;
    currentUserId?: PersonId;
}

const ProfileHero: React.FC<ProfileHeroProps> = ({profile, isOwnProfile, currentUserId}) => {
    const {t} = useTranslation();
    const isVerified = profile.isVerified === "Verified";

    return (
        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            <div
                className="relative h-48 sm:h-64 bg-gradient-to-r from-primary to-indigo-600 bg-cover bg-center"
                style={profile.banner ? {backgroundImage: `url(${profile.banner})`} : undefined}
            >
                {!profile.banner && (
                    <div className="absolute inset-0 bg-opacity-50 bg-black flex items-center justify-center">
                        <Image
                            src={AssetIcon.logoIcon}
                            alt="logoIcon"
                            className="opacity-20 object-contain"
                            width={200}
                            height={200}
                        />
                    </div>
                )}
            </div>
            <div className="px-6 pb-6">
                {/* relative is load-bearing, not decorative: the banner above is
                    position:relative, and CSS always paints positioned elements
                    above static ones regardless of DOM order -- without this the
                    banner covers the top of the avatar despite the negative
                    margin correctly overlapping it in the box model. */}
                <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-20 sm:-mt-24">
                    <Image
                        src={profile.avatar || ProfileImage.avatar}
                        alt={profile.name}
                        width={160}
                        height={160}
                        className="shrink-0 rounded-full w-32 h-32 sm:w-40 sm:h-40 object-cover ring-8 ring-white shadow-xl bg-white mx-auto sm:mx-0"
                    />
                    <div className="mt-4 sm:mt-0 sm:mb-2 flex justify-center sm:justify-end">
                        {isOwnProfile ? (
                            <EditButton
                                href="/account-setting/basic-information"
                                label={t("profile.editProfile") || "Edit profile"}
                            />
                        ) : (
                            <ChatNoWorkButton profile={profile} currentUserId={currentUserId}/>
                        )}
                    </div>
                </div>
                <div className="mt-4 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                        <h1 className="text-xl font-semibold text-gray-800">
                            {profile.displayName ?? profile.name}
                        </h1>
                        {isVerified && (
                            <span title={t("profile.verified")} className="text-primary">
                                <BadgeCheck className="w-5 h-5"/>
                            </span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-gray-600">
                        {profile.available && (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {t("profile.availableForWork") || "Open to work"}
                            </span>
                        )}
                        {typeof profile.ratings === "number" && (
                            <span>★ {profile.ratings.toFixed(1)}</span>
                        )}
                        {profile.averageResponseTime && (
                            <span>
                                {t("profile.averageResponseTime")}: {profile.averageResponseTime}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileHero;
