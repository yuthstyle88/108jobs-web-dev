import {CategoriesIcon} from "@/constants/icons";
import {CategoryNodeView} from "@108-plaza/jh-client";
import {catalogIcons} from "@/types/catalogIcon";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import {useTranslation} from "react-i18next";
import {toCamelCaseLastSegment} from "@/utils/helpers";
import {useLanguage} from "@/contexts/LanguageContext";

type Props = {
    serviceCatalogs: CategoryNodeView[];
    activeCatalog: CategoryNodeView;
    activeCatalogIndex: number;
    setActiveCatalogIndex: (index: number) => void;
};

const CatalogBanner = (props: Props) => {
    const {
        serviceCatalogs,
        activeCatalog,
        activeCatalogIndex,
        setActiveCatalogIndex,
    } = props;
    const {lang} = useLanguage();
    const {t} = useTranslation();

    return (
        <section className="py-8 bg-gradient-to-b from-gray-50 to-white">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div
                    className="relative min-h-[160px] mt-[-3rem] rounded-3xl bg-white/80 backdrop-blur-lg shadow-2xl border border-gray-100/50 transition-all duration-300 flex flex-col lg:flex-row gap-6 p-6">
                    {/* Catalog Sidebar */}
                    <div className="hidden lg:block w-full lg:w-64 flex-shrink-0 transition-all duration-300">
                        <div
                            className="flex flex-col gap-3 p-4 bg-gray-50/50 rounded-2xl max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-50">
                            {serviceCatalogs.map((catalog, index) => {
                                const matchedIcon = catalogIcons.find(
                                    (c) => c.name === catalog.category.name
                                )?.icon;

                                return (
                                    <div
                                        key={catalog.category.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Select ${catalog.category.name} catalog`}
                                        className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ease-in-out ${
                                            activeCatalogIndex === index
                                                ? "bg-gradient-to-r from-blue-100 to-blue-50 shadow-inner"
                                                : "hover:bg-gray-100/70"
                                        } after:absolute after:left-2 after:right-2 after:bottom-1 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-400 after:to-blue-600 after:transition-transform after:duration-300 ${
                                            activeCatalogIndex === index
                                                ? "after:scale-100"
                                                : "after:scale-0 group-hover:after:scale-75"
                                        }`}
                                        onClick={() => setActiveCatalogIndex(index)}
                                        onKeyDown={(e) => e.key === "Enter" && setActiveCatalogIndex(index)}
                                    >
                                        <div
                                            className={`relative transform transition-all duration-300 ease-out ${
                                                activeCatalogIndex === index
                                                    ? "scale-110"
                                                    : "group-hover:scale-105 group-hover:grayscale-0 grayscale"
                                            }`}
                                        >
                                            <Image
                                                src={matchedIcon || CategoriesIcon.industry}
                                                alt={catalog.category.name}
                                                width={32}
                                                height={32}
                                                className="object-contain drop-shadow-md"
                                            />
                                            <div
                                                className={`absolute inset-0 rounded-full bg-blue-200/20 transition-opacity duration-300 ${
                                                    activeCatalogIndex === index
                                                        ? "opacity-100"
                                                        : "opacity-0 group-hover:opacity-50"
                                                }`}
                                            />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 leading-tight tracking-tight">
                                            {t(`catalogs.${toCamelCaseLastSegment(catalog.category.path)}`, {defaultValue: catalog.category.name})}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Subcatalog Section */}
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900">
                                {t("catalogs.subcatalogs")}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {activeCatalog?.children?.slice(0, 12).map(
                                ({category}: { category: CategoryNodeView["category"] }) => {
                                    const backgroundImage = category.banner
                                        ? `url(${category.banner})`
                                        : `url("/categories-image/web-development-02032022.jpg")`;

                                    return (
                                        <Link
                                            prefetch={false}
                                            key={category.id}
                                            href={`/${lang}/job-board?category=${category.id}`}
                                            className="group relative block rounded-2xl overflow-hidden h-20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            aria-label={`View ${category.name} jobs`}
                                        >
                                            <div
                                                style={{backgroundImage}}
                                                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div
                                                className="relative flex items-end h-full px-3 py-2 bg-gradient-to-t from-black/70 to-transparent text-white font-semibold transition-all duration-300">
                      <span className="group-hover:-translate-y-0.5 text-xs tracking-wide">
                        {t(`catalogs.${toCamelCaseLastSegment(category.path)}`, {defaultValue: category.name})}
                      </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            {(!activeCatalog?.children || activeCatalog.children.length === 0) && (
                                <div className="col-span-full text-center text-gray-500 py-6 font-medium">
                                    {t("catalogs.noSubcatalogs")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CatalogBanner;