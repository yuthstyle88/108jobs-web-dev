"use client";

import {LANGUAGES} from "@/constants/language";
import {useLanguage} from "@/contexts/LanguageContext";
import {ArrowLeft, CircleUserRound, House, MessageSquare} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import React, {useEffect, useState} from "react";
import LanguageBottomSheet from "../SpBottomTab";
import SpUserAvatar from "./components/SpUserProfile";
import {UserService} from "@/services";
import {useTotalUnread} from "@/modules/chat/utils";
import Search from "@/components/Header/components/Search";

type SpHeaderProps = {
    showSearch?: boolean;
    showBackButton?: boolean;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
};

const SpHeader = ({
                      showSearch = false,
                      showBackButton = false,
                      isSidebarOpen,
                      onToggleSidebar,
                  }: SpHeaderProps) => {
    const [isMounted, setIsMounted] = useState(false);
    const isLoggedIn = UserService.Instance.isLoggedIn;
    const pathname = usePathname();
    const router = useRouter();
    const [showLang, setShowLang] = useState(false);
    const {lang} = useLanguage();
    const currentLang = LANGUAGES[lang as keyof typeof LANGUAGES];
    const unreadCount = useTotalUnread();

    useEffect(() => {
      let alive = true;
      const t = setTimeout(() => {
        if (alive) setIsMounted(true);
      }, 0);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }, []);

    if (!isMounted || (!isLoggedIn && pathname !== `/${lang}/login`)) return null;

    return (
        <header
            className="fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 bg-primary"
        >
            <nav className="flex items-center justify-between h-auto py-2 px-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    {showBackButton && (
                        <button
                            onClick={() => router.back()}
                            className="p-2 text-white hover:bg-[#063a68] rounded-full"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6"/>
                        </button>
                    )}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Link
                            prefetch={false}
                            href={`/${lang}`}
                            className={`flex items-center justify-center p-2 text-white cursor-pointer min-w-[44px] ${
                                pathname === `/${lang}` ? "bg-[#063a68]" : ""
                            }`}
                        >
                            <House className="w-5 h-5 sm:w-6 sm:h-6"/>
                        </Link>
                        <div className="block md:hidden">
                            <Search showSearch={showSearch} />
                        </div>
                        <button
                            className="flex items-center justify-center p-2 text-white cursor-pointer min-w-[44px] hover:bg-[#063a68] rounded-full relative"
                            onClick={onToggleSidebar}
                            aria-label={isSidebarOpen ? "Close chat room list" : "Open chat room list"}
                        >
                            <div className="relative">
                                <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7"/>
                                {unreadCount > 0 && (
                                    <span
                                        className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 text-[12px] leading-[20px] text-white bg-red-500 rounded-full flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
                                )}
                            </div>
                        </button>

                        <button
                            onClick={() => setShowLang(true)}
                            className="flex items-center justify-center p-2 text-white cursor-pointer min-w-[44px]"
                            aria-label={`Select language: ${currentLang.label}`}
                        >
                            <Image
                                src={currentLang.flag}
                                alt={currentLang.label}
                                width={24}
                                height={24}
                                className="w-6 h-6 sm:w-7 sm:h-7"
                            />
                        </button>
                        {isLoggedIn ? (
                            <SpUserAvatar/>
                        ) : (
                            <Link
                                prefetch={false}
                                href={`/${lang}/login`}
                                className="flex items-center justify-center p-2 text-white cursor-pointer min-w-[44px]"
                                aria-label="Login"
                            >
                                <CircleUserRound className="w-6 h-6 sm:w-7 sm:h-7"/>
                            </Link>
                        )}
                    </div>
                </div>
            </nav>
            <LanguageBottomSheet open={showLang} onClose={() => setShowLang(false)}/>
        </header>

    );
};

export default SpHeader;