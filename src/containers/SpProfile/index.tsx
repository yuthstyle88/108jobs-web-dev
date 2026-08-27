"use client";
import {ProfileIcon} from "@/constants/icons";
import {ProfileImage} from "@/constants/images";
import {useLanguage} from "@/contexts/LanguageContext";
import {UserService} from "@/services";
import {
    faBriefcase,
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {ChevronRight} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {useTranslation} from "react-i18next";
import {useUserStore} from "@/store/useUserStore";
import {useJobsTerms} from "@/hooks/api/terms/useJobsTerms";

const SpProfile = () => {
    const {userInfo} = useUserStore();
    const wallet = userInfo?.wallet;
    const {person, localUser} = userInfo?.localUserView ?? {};

    // Consent is no longer a field on the user -- it lives per sub-app, per
    // version, behind its own endpoint. Reading `localUser.acceptedTerms` here
    // returned `undefined` after the API dropped the column, which silently hid
    // this whole section from everyone (108jobs-web#107).
    const {accepted: acceptedJobsTerms} = useJobsTerms();

    const {lang: currentLang} = useLanguage();
    const {t} = useTranslation();
    const logout = () => UserService.Instance.logout();

    return (
        <main className="min-h-screen bg-white relative">
            <section className="pb-20">
                <svg
                    preserveAspectRatio="none"
                    width="100%"
                    height="150"
                    viewBox="0 0 702 232"
                >
                    <path
                        d="M-6.25277607e-13,0.904411074 L702,0.904411074 L702,132.15625 C592.312351,153.623113 478.060437,164.356544 359.244257,164.356544 C240.428078,164.356544 120.679992,153.623113 -6.25277607e-13,132.15625 L-6.25277607e-13,0.904411074 Z"
                        fill="#042b4a"
                    ></path>
                </svg>
                <div
                    className="grid grid-cols-1 z-10 text-center absolute left-1/2 -translate-x-1/2 top-0 pt-6 justify-center">
                    <strong className="text-[1.125rem] text-white">{t("spPrivacy.myProfile")}</strong>
                    <Link prefetch={false} href={`/${currentLang}/profile/${person?.name}`}>
                        <Image
                            src={person?.avatar || ProfileImage.avatar}
                            width={80}
                            height={80}
                            alt="avatar"
                            className="inline-flex justify-center items-center w-[80px] min-h-[80px]  rounded-full object-cover object-center mt-4"
                        />
                    </Link>
                    <Link prefetch={false} href={`/${currentLang}/profile/${person?.name}`}>
                        <strong className="text-[1.125rem] text-third">
                            {person?.name}
                        </strong>
                    </Link>
                    <Link prefetch={false}
                          href={`/${currentLang}/profile/${person?.name}`}
                          className="inline-block max-w-full whitespace-nowrap"
                    >
                        <strong className="text-sm font-sans text-text-primary">
                            {localUser?.email}
                        </strong>
                    </Link>
                </div>
            </section>
            <section>
                <Link prefetch={false} href={`/${currentLang}/coin`}>
                    <div
                        style={{height: "52px", borderRadius: "12px 12px 0 0"}}
                        className="flex flex-row justify-between items-center gap-2 px-4 profile-gradient "
                    >
                        <div className="flex flex-row items-center gap-2">
                            <Image
                                src={ProfileIcon.coins}
                                alt="avatar"
                                width={20}
                                height={20}
                            />
                            <div className="flex flex-row items-center text-[0.75rem] font-semibold gap-1">
                                <span className="text-text-primary">{wallet?.balanceAvailable}</span>
                            </div>
                        </div>
                        <div>
                            <ChevronRight className="w-6 h-6 text-gray-400"/>
                        </div>
                    </div>
                </Link>
            </section>
            {/* Assume profile is an employer and check if freelancerType exists to determine if profile is a freelancer */}
            {acceptedJobsTerms && (
                <section className="grid grid-cols-4 px-3 mt-6 gap-y-6 gap-x-3">
                    <Link prefetch={false} href={`/${currentLang}/job-board/jobs`}>
                        <div
                            className="flex flex-col items-center text-center gap-2 text-[0.75rem] text-text-secondary font-sans">
                            <FontAwesomeIcon
                                icon={faBriefcase}
                                className="text-[24px] text-text-secondary"
                            />
                            <div>{t("profileJob.postedJobs")}</div>
                        </div>
                    </Link>
                    {/*TODO: Add favorites link when it is ready*/}
                    {/*<Link prefetch={false} href="/favorites">*/}
                    {/*  <div className="flex flex-col items-center gap-2 text-[0.75rem] text-text-secondary font-sans">*/}
                    {/*    <FontAwesomeIcon*/}
                    {/*      icon={faHeart}*/}
                    {/*      className="text-[24px] text-text-secondary"*/}
                    {/*    />*/}
                    {/*    <div>Favorites</div>*/}
                    {/*  </div>*/}
                    {/*</Link>*/}
                </section>
            )}

            <section className="block">
                <div
                    style={{borderBottom: "solid 8px", borderColor: "#f6f7f8"}}
                    className="mt-6"
                >
                    <ul className="p-0 m-0 list-none">
                        {/* Assume profile is an employer and check if freelancerType doesn't exist to determine if profile is not a freelancer */}
                        <li>
                            <Link prefetch={false}
                                  href="/account-setting/basic-information"
                                  className="flex items-center justify-between w-full px-6 py-3 text-text-primary text-[15px] font-sans cursor-pointer"
                            >
                                <span>{t("global.menuAccountSettings")}</span>
                                <ChevronRight className="w-6 h-6 text-gray-400"/>
                            </Link>
                        </li>
                    </ul>
                </div>
            </section>
            <section className="block">
                <div style={{borderBottom: "solid 8px", borderColor: "#f6f7f8"}}>
                    <ul className="p-0 m-0 list-none">
                        <li>
                            <Link prefetch={false}
                                  href="/job-board"
                                  className="flex items-center justify-between w-full px-6 py-3 text-text-primary text-[15px] font-sans cursor-pointer"
                            >
                                <span>{t("global.menuJobBoard")}</span>
                                <ChevronRight className="w-6 h-6 text-gray-400"/>
                            </Link>
                        </li>
                    </ul>
                </div>
            </section>
            <section className="block">
                <div>
                    <ul className="p-0 m-0 list-none">
                        <li>
                            <button
                                onClick={logout}
                                className="flex items-center justify-between w-full px-6 py-3 text-text-primary text-[15px] font-sans cursor-pointer"
                            >
                                <span>{t("global.menuLogout")}</span>
                                <ChevronRight className="w-6 h-6 text-gray-400"/>
                            </button>
                        </li>
                    </ul>
                </div>
            </section>
        </main>
    );
};

export default SpProfile;
