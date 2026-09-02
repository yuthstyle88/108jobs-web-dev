"use client";
import en from "@/assets/icons/en.svg";
import th from "@/assets/icons/th.svg";
import vn from "@/assets/icons/vn.svg";
import {faFacebook, faInstagram, faTiktok} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import {getAppName} from "@/utils/appConfig";
import {APP_VERSION} from "@/utils/version";
import React from "react";
import {useTranslation} from "react-i18next";
import {useCategories} from "@/hooks/api/categories/useCategories";
import {getCategoriesAtLevel, toCamelCaseLastSegment} from "@/utils/helpers";
import {useLanguage} from "@/contexts/LanguageContext";

const Footer = () => {
    const {lang} = useLanguage();
    const {t} = useTranslation();
    const categoriesResponse = useCategories();
    const catalogData = getCategoriesAtLevel(categoriesResponse.categories ?? undefined, 3);
    return (
        <footer className="bg-[#042A48] text-white" role="contentinfo">
            {/* Top Section */}
            <div
                className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Categories */}
                <div>
                    <h3 className="font-semibold text-lg mb-4 text-white/95 tracking-tight">{t("global.tittleFooter1")}</h3>
                    <ul className="space-y-3 text-sm text-white/80">
                        {catalogData.slice(0, 10).map((item, index) => (
                            <Link
                                prefetch={false}
                                key={item.category.id}
                                href={`/${lang}/job-board?category=${item.category.id}`}
                                aria-label={`View ${item.category.name} jobs`}
                            >
                                <li key={index}>
                                    <span className="cursor-default opacity-80 hover:opacity-100 transition-opacity duration-200">
                                        {t(`catalogs.${toCamelCaseLastSegment(item.category.path)}`)}
                                    </span>
                                </li>
                            </Link>
                        ))}
                    </ul>
                </div>

                {/* About */}
                <div>
                    <h3 className="font-semibold text-lg mb-4 text-white/95 tracking-tight">{t("global.tittleFooter4")}</h3>
                    <ul className="space-y-3 text-sm">
                        {[
                            {href: "/content/terms", label: t("global.labelTermsOfService")},
                            {href: "/content/privacy", label: t("global.labelPrivacyPolicy")},
                            {href: "/content/how", label: t("how.label")},
                        ].map((item) => (
                            <li key={item.href}>
                                <Link
                                    className="text-white/80 hover:text-white hover:translate-x-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    prefetch={false}
                                    href={item.href}
                                    aria-label={item.label}
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Contact */}
                <div>
                    <h3 className="font-semibold text-lg mb-4 text-white/95 tracking-tight">{t("global.tittleFooter5")}</h3>
                    <ul className="space-y-3 text-sm text-white/80">
                        <li>
                            <Link
                                className="hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                prefetch={false}
                                href="mailto:support@108heros.com"
                                title="Email support@108heros.com"
                                aria-label="Email support"
                            >
                                support@108heros.com
                            </Link>
                        </li>
                        <li>
                            <Link
                                className="hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                prefetch={false}
                                href="https://m.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Contact via Facebook Messenger"
                            >
                                Facebook Messenger
                            </Link>
                        </li>
                    </ul>
                    <p className="mt-4 text-xs text-white/70 leading-relaxed">
                        {t("global.labelWorkingHoursWeekdays")} <br/>
                        {t("global.labelWorkingHoursWeekends")}
                    </p>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="bg-[#0A3556] border-t border-white/10">
                <div
                    className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-lg">
                        <div className="flex gap-3">
                            {[
                                {href: "https://instagram.com", icon: faInstagram, label: "Instagram"},
                                {href: "https://facebook.com", icon: faFacebook, label: "Facebook"},
                                {href: "https://tiktok.com", icon: faTiktok, label: "TikTok"},
                            ].map((social) => (
                                <Link
                                    key={social.href}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/80 hover:text-white hover:scale-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    aria-label={social.label}
                                >
                                    <FontAwesomeIcon icon={social.icon} className="w-5 h-5"/>
                                </Link>
                            ))}
                        </div>
                        <span className="h-4 w-px bg-white/20" aria-hidden="true"></span>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            {[
                                {href: "/content/terms", label: t("global.labelTermsOfService")},
                                {href: "/content/privacy", label: t("global.labelPrivacyPolicy")},
                            ].map((link, index) => (
                                <React.Fragment key={link.href}>
                                    <Link
                                        className="text-white/80 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        prefetch={false}
                                        href={link.href}
                                        aria-label={link.label}
                                    >
                                        {link.label}
                                    </Link>
                                    {index < 1 && <span className="text-white/30">•</span>}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="flex items-center gap-2" aria-label="Languages">
                            {[
                                {src: th, alt: "TH", title: "Thai"},
                                {src: en, alt: "EN", title: "English"},
                                {src: vn, alt: "VN", title: "Vietnamese"},
                            ].map((lang) => (
                                <Image
                                    key={lang.alt}
                                    src={lang.src}
                                    alt={lang.alt}
                                    height={20}
                                    style={{height: 20, width: "auto"}}
                                    title={lang.title}
                                    className="hover:scale-110 transition-transform duration-200"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Copyright & version -- the human-readable half of /api/version */}
                    <div className="flex items-center gap-2 text-xs font-sans text-white/70">
                        <p>© {new Date().getFullYear()} {getAppName()}</p>
                        <span className="text-white/30">•</span>
                        <span className="font-mono text-white/60 text-[11px]">v{APP_VERSION}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;