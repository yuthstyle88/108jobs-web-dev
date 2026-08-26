"use client";
import {AssetIcon} from "@/constants/icons";
import Image from "next/image";
import Link from "next/link";
import LanguageDropdown from "../LanguageDropDown";

import {useLanguage} from "@/contexts/LanguageContext";

const HeaderSimple = () => {
  const {lang} = useLanguage();
  return (
    <header className="z-[999] w-full transition-all duration-300 bg-primary">
      <nav className="mx-[1.5rem] flex items-center h-auto min-h-[70px] py-1 justify-between">
        <section className="flex items-center gap-x-4 w-full md:w-auto">
          <Link prefetch={false} href={`/${lang}`} className="shrink-0">
            <Image src={AssetIcon.logo} alt="108Heros logo" width={210} height={56} className="w-auto h-10 sm:h-12 object-contain"/>
          </Link>
        </section>

        <section className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0 justify-end">
          <LanguageDropdown/>
        </section>
      </nav>
    </header>
  );
};

export default HeaderSimple;
