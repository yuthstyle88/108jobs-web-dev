"use client";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { Briefcase, BriefcaseBusiness, CreditCard, FileText, ShieldCheck, User } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

type MenuItemData = {
  href: string;
  label: string;
  icon: IconType;
};

const MenuItem = memo(function MenuItem({ href, label, Icon, isActive }: { href: string; label: string; Icon: IconType; isActive: boolean }) {
  const baseClass = "flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-4 border-l-4";
  const activeClass = "text-primary border-third bg-blue-50";
  const inactiveClass = "text-gray-600 hover:text-gray-800 border-l-transparent hover:bg-gray-50";

  return (
    <li>
      <Link prefetch={false} href={href} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}>
        <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
        {label}
      </Link>
    </li>
  );
});

const AccountSettingWrapper = memo(function AccountSettingWrapper() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { lang } = useLanguage();

  // Memoize menus so references are stable between renders
  const accountMenu: MenuItemData[] = useMemo(
    () => [
      { href: "/account-setting/basic-information", label: t("profileNavbar.accountInfo"), icon: User },
      { href: "/account-setting/resume", label: t("profileNavbar.resume"), icon: FileText },
      { href: "/account-setting/work-sample", label: t("profileNavbar.workSample"), icon: BriefcaseBusiness },
      { href: "/account-setting/bank-account", label: t("profileNavbar.bankInfo"), icon: CreditCard },
    ],
    [t]
  );

  const hiringMenu: MenuItemData[] = useMemo(
    () => [
      { href: "/account-setting/manage", label: t("profileNavbar.settings"), icon: ShieldCheck },
      { href: "/account-setting/job-available-setting", label: t("profileNavbar.jobAvailability"), icon: Briefcase },
    ],
    [t]
  );

  const renderMenu = useCallback(
    (items: MenuItemData[]) =>
      items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === `/${lang}${href}`;
        return <MenuItem key={href} href={href} label={label} Icon={Icon} isActive={isActive} />;
      }),
    [lang, pathname]
  );

  return (
    <div>
      <p className="font-medium text-[16px] text-text-primary pb-[16px]">{t("profileNavbar.sectionAccount")}</p>
      <ul className="flex flex-col mt-4">{renderMenu(accountMenu)}</ul>

      <p className="font-medium text-[16px] text-text-primary py-4">{t("profileNavbar.sectionSetting")}</p>
      <ul>{renderMenu(hiringMenu)}</ul>
    </div>
  );
});

export default AccountSettingWrapper;
