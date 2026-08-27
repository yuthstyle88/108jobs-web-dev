"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import TypingText from "@/components/TypingText";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "../styles.css";
import CatalogBanner from "@/components/Home/Catalog";
import OfferSection from "@/components/Home/OfferSection";
import SearchInput from "@/components/SearchInput";
import SpAdsSlider from "@/containers/SpAdsSlider";
import React, {useState} from "react";
import {useTranslation} from "react-i18next";
import {buildCategoriesTree} from "@/utils/helpers";
import {useCategories} from "@/hooks/api/categories/useCategories";
import {LandingImage} from "@/constants/images";
import {ChatLanguageProvider} from "@/contexts/ChatLanguage";
import Link from "next/link";
import NavBar from "@/components/Home/NavBar";
import MobileSidebar from "@/components/MobileSidebar";
import {useUserService} from "@/contexts/UserServiceContext";
import {useSiteStore} from "@/store/useSiteStore";

export default function Home() {
    const {t, i18n} = useTranslation();
    const {siteView} = useSiteStore();
    useUserService();
    const [activeCatalogIndex, setActiveCatalogIndex] = useState<number>(0);
    const catalogData = useCategories();
    const serviceCatalogs = buildCategoriesTree(catalogData?.categories ?? undefined) ?? [];
    const activeCatalog = serviceCatalogs[activeCatalogIndex];
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <ChatLanguageProvider>
                <div className="min-h-[100vh] bg-gray-50">
                    <div className="hidden sm:block">
                        <Header type="primary"/>
                    </div>
                    <div className="block sm:hidden">
                        {/* Mobile Header */}
                        <div className="block sm:hidden fixed top-0 inset-x-0 z-[1000] bg-primary">
                            <NavBar
                                isSidebarOpen={isSidebarOpen}
                                onToggleSidebar={() => setIsSidebarOpen(v => !v)}
                                className="text-white"
                            />
                        </div>
                        <MobileSidebar
                            isOpen={isSidebarOpen}
                            onClose={() => setIsSidebarOpen(false)}
                        />
                    </div>
                    <main className="mt-20 sm:mt-0 sm:pt-0">
                        <section
                            className="hidden sm:block h-auto bg-cover bg-center relative pt-[6.5rem] md:pt-[4.5rem]"
                            style={{
                                backgroundImage: `url(${siteView?.localSite.banner})`,
                            }}
                        >
                            <div className="absolute inset-0 bg-black/50"/>
                            <div
                                className="relative pt-16 pb-24 flex justify-center flex-col gap-6 text-center items-center max-w-4xl mx-auto px-4">
                                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight animate-fade-in">
                                    {t("home.titleBannerHomePage1")}
                                </h1>
                                <TypingText/>
                                <p className="text-lg md:text-xl font-medium text-white/90 max-w-2xl">
                                    {t("home.titleBannerHomePage2")}
                                </p>
                                <SearchInput/>
                                <Link
                                    href={`/${i18n.language}/job-board`}
                                    className="mt-6 inline-block bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors duration-300"
                                >
                                    {t("home.exploreNow")}
                                </Link>
                            </div>
                        </section>

                        <section className="block sm:hidden bg-gray-50">
                            <SpAdsSlider/>
                        </section>

                        <section className="py-16 bg-white">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                                    {t("home.featuresTitle") || "Discover Our Features"}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div
                                        className="p-6 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                            {t("home.feature1Title") || "Category Connection"}
                                        </h3>
                                        <p className="text-gray-600">
                                            {t("home.feature1Desc") ||
                                                "Connect with vibrant categories tailored to your interests."}
                                        </p>
                                    </div>
                                    <div
                                        className="p-6 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                            {t("home.feature2Title") || "Personalized Experience"}
                                        </h3>
                                        <p className="text-gray-600">
                                            {t("home.feature2Desc") ||
                                                "Enjoy a customized journey with recommendations just for you."}
                                        </p>
                                    </div>
                                    <div
                                        className="p-6 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                            {t("home.feature3Title") || "Seamless Navigation"}
                                        </h3>
                                        <p className="text-gray-600">
                                            {t("home.feature3Desc") ||
                                                "Explore effortlessly with our intuitive and user-friendly interface."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <CatalogBanner
                            serviceCatalogs={serviceCatalogs}
                            activeCatalog={activeCatalog}
                            activeCatalogIndex={activeCatalogIndex}
                            setActiveCatalogIndex={setActiveCatalogIndex}
                        />
                        <OfferSection/>
                    </main>
                    <Footer/>
                </div>
        </ChatLanguageProvider>
    );
}