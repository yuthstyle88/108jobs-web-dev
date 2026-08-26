import React, {useRef} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBars, faMagnifyingGlass, faBagShopping} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import Image from "next/image";
import {AssetIcon} from "@/constants/icons";
import Search from "@/components/Header/components/Search";
import SpUserAvatar from "@/containers/SpHeader/components/SpUserProfile";
import {CircleUserRound} from "lucide-react";
import {UserService} from "@/services";
import {useLanguage} from "@/contexts/LanguageContext";

/**
 * Minimal NavBar: renders a mobile menu toggle button.
 * State is controlled by parent via props.
 */
export type NavBarProps = {
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    showSearch?: boolean;
    className?: string; // optional styling from parent
};

const NavBar: React.FC<NavBarProps> = ({
                                           isSidebarOpen = false,
                                           onToggleSidebar,
                                           showSearch = false,
                                           className = "",
                                       }) => {
    const isLoggedIn = UserService.Instance.isLoggedIn;
    // ป้องกันการกดปุ่มเมนูรัว ๆ ทำให้เกิดแล็กหรือสถานะเปิด/ปิดสลับเร็วเกินไป
    const lastToggleTsRef = useRef(0);
    const {lang} = useLanguage();
    const handleHamburgerClick = () => {
        const now = Date.now();
        // กันสแปมคลิกภายใน 400ms
        if (now - lastToggleTsRef.current < 400) return;
        lastToggleTsRef.current = now;
        onToggleSidebar?.();
    };
    return (
        <nav className={`flex items-center justify-between px-3 sm:py-2 ${className}`}>
            <Link href={`/${lang}`} aria-label="Home"
                  className="text-white/90 hover:text-white focus:outline-none rounded-md hover:bg-white/10 p-1">
                <Image
                    src={AssetIcon.logo}
                    alt="108Heros logo"
                    className="w-auto h-10 sm:h-12 object-contain"
                    width={210}
                    height={56}
                    priority
                />
            </Link>

            {/* Right: search, bag, hamburger */}
            <div className="flex items-center gap-1 sm:gap-2">
                <div className="block md:hidden">
                    <Search showSearch={showSearch} />
                </div>
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
                <button
                    type="button"
                    className="md:hidden w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-full text-white/90 hover:text-white hover:bg-white/10 focus:outline-none"
                    onClick={handleHamburgerClick}
                    aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
                >
                    <FontAwesomeIcon icon={faBars} className="w-6 h-6 sm:w-4 sm:h-4"/>
                </button>
            </div>
        </nav>
    );
};

export default NavBar;