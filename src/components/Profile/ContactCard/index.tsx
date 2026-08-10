"use client";
import React from "react";
import {useTranslation} from "react-i18next";
import {Person} from "108jobs-client";
import EditButton from "@/components/Profile/EditButton";

interface ContactCardProps {
    profile: Person;
    isOwnProfile: boolean;
}

const ContactCard: React.FC<ContactCardProps> = ({profile, isOwnProfile}) => {
    const {t} = useTranslation();

    return (
        <div className="bg-white shadow-lg rounded-2xl p-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-primary font-semibold">{t("profileInfo.sectionContactInfo")}</h3>
                {isOwnProfile && <EditButton href="/account-setting/basic-information" label="Edit contact info"/>}
            </div>
            <div className="flex flex-wrap gap-2">
                {profile?.contacts ? (
                    profile.contacts.split(",").map((contact, index) => (
                        <span
                            key={index}
                            className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
                        >
                            {contact.trim()}
                        </span>
                    ))
                ) : (
                    <p className="text-gray-600 text-sm">{t("profile.noContacts")}</p>
                )}
            </div>
        </div>
    );
};

export default ContactCard;
