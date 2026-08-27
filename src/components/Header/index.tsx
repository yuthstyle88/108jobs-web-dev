"use client";
import {AssetIcon} from "@/constants/icons";
import {useAuthInfo} from "@/hooks/api/authenticate/useAuthInfo";
import Image from "next/image";
import Link from "next/link";
import {useTranslation} from "react-i18next";
import LanguageDropdown from "../LanguageDropDown";
import UserProfileSection from "./components/UserProfileSection";
import {useScrollHandler} from "./hooks/useScrollHandler";
import {useLanguage} from "@/contexts/LanguageContext";
import {useSiteStore} from "@/store/useSiteStore";

const Header = ({type, forceShowSearch = false}: { type?: string; forceShowSearch?: boolean }) => {
    const {isLoggedIn, isAdmin} = useAuthInfo();
    const {siteView} = useSiteStore();
    const {lang} = useLanguage();
    const {t} = useTranslation();
    const {scrollY, showSearch} = useScrollHandler(forceShowSearch);
    const bg = "bg-primary";

    const logoUrl = siteView?.localSite?.icon || AssetIcon.logo.src;

    return (
        <header className={`fixed top-0 z-[999] w-full transition-all duration-300 ${bg}`}>
            <nav className="mx-4 sm:mx-6 lg:mx-8 flex flex-wrap items-center justify-between h-auto py-2">
                <section className="flex items-center gap-x-4 w-full sm:w-auto">
                    {/* Mobile Logo – visible only on <md */}
                    <div className="block md:hidden">
                        <Link prefetch={true} href={`/${lang}`} className="shrink-0">
                            <Image
                                src={logoUrl}
                                alt="108Heros logo"
                                width={210}
                                height={56}
                                className="w-auto h-10 object-contain"
                                priority
                            />
                        </Link>
                    </div>

                    {/* Desktop Logo – visible only on md+ */}
                    <div className="hidden md:block">
                        <Link prefetch={true} href={`/${lang}`} className="shrink-0">
                            <Image
                                src={logoUrl}
                                alt="108Heros logo"
                                width={210}
                                height={56}
                                className="w-auto h-11 md:h-12 lg:h-13 object-contain"
                                priority
                            />
                        </Link>
                    </div>
                </section>
                <section className="flex items-center gap-4 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
                    {!isLoggedIn && (
                        <Link prefetch={false} href={`/${lang}/job-board`} className="text-white text-sm hover:text-gray-200">
                            {t("global.labelJobBoardCenter")}
                        </Link>
                    )}
                    {isLoggedIn && <UserProfileSection/>}
                    {/* Admin Dashboard Button */}
                    {isLoggedIn && isAdmin && (
                        <Link
                            href={`/${lang}/admin/dashboard`}
                            className="bg-amber-500 text-white text-sm px-3 py-1 rounded hover:bg-amber-200"
                        >
                            {t("global.labelAdminDashboard") || "Admin Dashboard"}
                        </Link>
                    )}
                    {!isLoggedIn && (
                        <>
                            <Link prefetch={false} href={`/${lang}/login`} className="text-white text-sm hover:text-gray-200">
                                {t("global.labelSignInButton")}
                            </Link>
                            <Link prefetch={false} href={`/${lang}/register`} className="text-white text-sm hover:text-gray-200">
                                {t("global.labelSignUpButton")}
                            </Link>
                        </>
                    )}
                    {!isLoggedIn && <LanguageDropdown/>}
                </section>
            </nav>
        </header>
    );
};

export default Header;