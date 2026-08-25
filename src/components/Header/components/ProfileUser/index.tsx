'use client';
import {ProfileImage} from "@/constants/images";
import {useLanguage} from "@/contexts/LanguageContext";
import {
    faBarsProgress,
    faBriefcase,
    faBullhorn,
    faGear,
    faHeart,
    faMessage,
    faSignOut,
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {Person} from "108heros-client";
import Image from "next/image";
import Link from "next/link";
import {UserService} from "@/services";
import {useTranslation} from "react-i18next";

type ProfileUserProps = {
    profile: Person;
};

import React, { memo, useCallback } from "react";
import { useRouter } from "next/navigation";

const ProfileUser = ({profile}: ProfileUserProps) => {
    const logout = useCallback(() => UserService.Instance.logout(), []);
    const {lang: currentLang} = useLanguage();
    const {t} = useTranslation();
    const router = useRouter();
    return (
        <div className="absolute right-0 mt-2 w-[22rem] bg-white rounded-lg shadow-job-card z-50 select-none">
            <Link prefetch={false} href={`/${currentLang}/profile/${profile.name}`}>
                <div className="p-4 bg-secondary hover:bg-[#D0E1FB] duration-150 rounded-tl-lg rounded-tr-lg relative">
                    <div className="flex items-center space-x-3">
                        <div className="bg-gray-200 flex items-center justify-center rounded-full">
                            <Image
                                src={profile.avatar || ProfileImage.avatar}
                                alt="avatar"
                                className="rounded-full w-12 h-12 object-cover border-1 border-border-primary"
                                width={48}
                                height={48}
                                sizes="48px"
                                loading="eager"
                                priority
                            />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{profile.name}</p>
                            <p className="text-sm font-sans text-text-secondary underline">
                                {t("global.labelViewProfile")}
                            </p>
                        </div>
                    </div>
                    <Image
                        src={ProfileImage.decal}
                        alt="decal"
                        className="absolute top-0 right-0 bottom-0 opacity-40 "
                        width={65}
                        height={80}
                        loading="lazy"
                        sizes="80px"
                        aria-hidden
                    />
                </div>
            </Link>
            <div className="py-2">
                <Link prefetch={false}
                      href={`/${currentLang}/account-setting/basic-information`}
                      className="flex items-center gap-5 px-4 py-3 hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={faGear}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuAccountSettings")}</span>
                </Link>
                <Link prefetch={false}
                      href={`/${currentLang}/chat`}
                      className="flex items-center gap-5 px-4 py-3 hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={faMessage}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuMessagesOrders")}</span>
                </Link>
                <Link prefetch={false}
                      href={`/${currentLang}/favorites`}
                      className="flex items-center gap-5 px-4 py-3 hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={faHeart}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuFavoriteJobs")}</span>
                </Link>
                <Link prefetch={false}
                      href={`/${currentLang}/job-board`}
                      className="flex items-center gap-5 px-4 py-3 hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={faBullhorn}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuJobBoard")}</span>
                </Link>
                <Link prefetch={false}
                      href={`/${currentLang}/job-board/jobs`}
                      className="flex items-center gap-5 px-4 py-3 hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={faBriefcase}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuMyJob")}</span>
                </Link>
                <button
                    type="button"
                    onClick={() => router.push(`/${currentLang}/account-setting/manage`)}
                    className="w-full flex items-center gap-5 px-4 py-3 hover:bg-gray-50 border-t text-left"
                >
                    <FontAwesomeIcon
                        icon={faBarsProgress}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuDataManagement")}</span>
                </button>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-5 px-4 py-3 hover:bg-gray-50 "
                >
                    <FontAwesomeIcon
                        icon={faSignOut}
                        className="text-[24px] text-primary "
                    />
                    <span className="text-gray-700">{t("global.menuLogout")}</span>
                </button>
            </div>
        </div>
    );
};

export default memo(ProfileUser);
