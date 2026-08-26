"use client";
import LanguageDropdown from "@/components/LanguageDropDown";
import NotificationDropdown from "@/components/NotificationDropdown";
import {ProfileImage} from "@/constants/images";
import {useToggle} from "@/hooks/ui/useToggle";
import {faChevronDown} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import UserMegaMenu from "../UserMegaMenu";
import UserImproveMenu from "../UserImproveMenu";
import ProfileUser from "../ProfileUser";
import {useTranslation} from "react-i18next";
import ChatBadge from "@/components/Header/components/ChatBadge";
import {ProfileIcon} from "@/constants/icons";
import React, {memo, useCallback, useState} from "react";
import {useUserStore} from "@/store/useUserStore";

const UserProfileSection = () => {
    const {userInfo} = useUserStore();
    const wallet = userInfo?.wallet;
    const person = userInfo?.localUserView.person;
    const {isOpen, toggle, close} = useToggle();
    const {t} = useTranslation();
    const [showImprove, setShowImprove] = useState(false);
    const [showRecruit, setShowRecruit] = useState(false);
    const onEnterImprove = useCallback(() => setShowImprove(true), []);
    const onLeaveImprove = useCallback(() => setShowImprove(false), []);
    const onEnterRecruit = useCallback(() => setShowRecruit(true), []);
    const onLeaveRecruit = useCallback(() => setShowRecruit(false), []);

    return (
        <section className="flex items-center gap-1 h-full min-w-0 shrink-0">
            <div className="group hidden lg:block min-w-0" onMouseEnter={onEnterImprove} onMouseLeave={onLeaveImprove}>
                <div className="relative">
                    <div
                        className="text-[12px] text-[#1d6cd2] px-2 py-1 bg-white rounded-md font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap">
                        <p className="truncate">{t("global.increaseHiringOpportunity")}</p>
                        <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3"/>
                    </div>
                    <div
                        className="absolute left-0 right-0 top-full h-3 bg-transparent pointer-events-none group-hover:pointer-events-auto"></div>
                </div>
                <div
                    className="absolute left-0 right-0 w-screen opacity-0 scale-y-0 origin-top top-[60px] shadow-mega-menu px-[1rem] py-[1rem] flex text-[rgba(43,50,59,.95)] z-50 bg-white pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-y-100 group-hover:min-h-[400px] transition-all duration-300">
                    {showImprove && <UserImproveMenu/>}
                </div>
            </div>
            <div className="group hidden lg:block min-w-0" onMouseEnter={onEnterRecruit} onMouseLeave={onLeaveRecruit}>
                <div className="relative">
                    <div
                        className="border-r-[1px] border-[#4f8ce8] pr-2 text-[12px] text-white px-2 py-1 font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap">
                        <p className="truncate max-w-[80px]">{t("global.recruitment")}</p>
                        <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3"/>
                    </div>
                    <div
                        className="absolute left-0 right-0 w-[100px] bg-transparent h-4 pointer-events-none group-hover:pointer-events-auto"></div>
                </div>
                <div
                    className="absolute left-0 right-0 w-screen opacity-0 scale-y-0 origin-top top-[60px] shadow-mega-menu px-[1rem] py-[1rem] flex text-[rgba(43,50,59,.95)] z-50 bg-white pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-y-100 group-hover:min-h-[400px] transition-all duration-300">
                    {showRecruit && <UserMegaMenu/>}
                </div>
            </div>
            <ChatBadge/>
            <NotificationDropdown/>
            <Link prefetch={false} href="/coin" className="text-white text-xs">
                <div className="flex items-center gap-1 bg-white rounded-full h-[1.5rem] max-w-[60px] min-w-0">
                    <p className="text-third text-[10px] pl-1 truncate">{wallet?.balanceAvailable || 0}</p>
                    <div className="w-4 h-4 relative shrink-0">
                        <Image
                            src={ProfileIcon.coins}
                            alt="coin icon"
                            fill
                            className="object-contain"
                        />
                    </div>
                </div>
            </Link>
            <div className="px-0.5">
                <LanguageDropdown/>
            </div>
            <div className="relative px-1 shrink-0">
                <button name="profile"
                        onClick={toggle}
                        className="flex items-center justify-center gap-0.5 min-w-0"
                >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0">
                        <Image
                            src={person?.avatar || ProfileImage.avatar}
                            alt="avatar"
                            className="w-full h-full object-cover object-center"
                            width={32}
                            height={32}
                        />
                    </div>
                    <FontAwesomeIcon
                        icon={faChevronDown}
                        className="w-[10px] h-[10px] text-white"
                    />
                </button>
                {isOpen && person && <ProfileUser profile={person}/>}
                {isOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => close()}/>
                )}
            </div>
        </section>
    );
};

export default memo(UserProfileSection);