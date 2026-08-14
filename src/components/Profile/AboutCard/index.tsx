"use client";
import React, {useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {Person} from "108jobs-client";
import {NotebookPen} from "lucide-react";
import EditButton from "@/components/Profile/EditButton";
import EmptyState from "@/components/Profile/EmptyState";

interface AboutCardProps {
    profile: Person;
    isOwnProfile: boolean;
}

const AboutCard: React.FC<AboutCardProps> = ({profile, isOwnProfile}) => {
    const {t} = useTranslation();
    const [showFullBio, setShowFullBio] = useState(false);
    const [isClamped, setIsClamped] = useState(false);
    const bioRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (bioRef.current) {
            setIsClamped(bioRef.current.scrollHeight > bioRef.current.clientHeight);
        }
    }, [profile?.bio]);

    return (
        <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-primary font-semibold">{t("profile.bio")}</h3>
                {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit bio"/>}
            </div>
            {profile?.bio ? (
                <>
                    <p
                        ref={bioRef}
                        className={`text-gray-600 text-sm leading-relaxed ${showFullBio ? "" : "line-clamp-4"}`}
                    >
                        {profile.bio}
                    </p>
                    {isClamped && !showFullBio && (
                        <button
                            onClick={() => setShowFullBio(true)}
                            className="mt-2 text-primary text-sm font-medium hover:underline"
                        >
                            {t("profile.seeMore")}
                        </button>
                    )}
                </>
            ) : (
                <EmptyState
                    icon={NotebookPen}
                    message={t("profile.noBio")}
                    addLabel={isOwnProfile ? "Add bio" : undefined}
                    href={isOwnProfile ? "/account-setting/basic-information" : undefined}
                />
            )}
        </div>
    );
};

export default AboutCard;
