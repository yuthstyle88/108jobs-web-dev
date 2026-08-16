"use client";
import {ArrowLeft, Home} from "lucide-react";
import Link from "next/link";
import {useTranslation} from "react-i18next";
import Image from "next/image";
import {AssetsImage} from "@/constants/images";
import {useParams} from "next/navigation";
import {VALID_LANGUAGES} from "@/constants/language";

export default function NotFound() {
    const {t} = useTranslation();
    const params = useParams<{ lang?: string }>();
    const lang = typeof params?.lang === "string" && VALID_LANGUAGES.includes(params.lang)
        ? params.lang
        : "en";

    return (
        <main
            aria-labelledby="not-found-title"
            className="relative isolate flex min-h-screen items-center overflow-hidden bg-slate-50 px-4 py-10 sm:px-6 lg:px-8"
        >
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[27rem] bg-[#062f51]"/>
            <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-[#0d6da7]/35 blur-3xl"/>

            <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(4,43,74,0.18)] lg:grid-cols-[1.05fr_0.95fr]">
                <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden bg-[#eaf6fd] px-6 py-10 sm:px-10 lg:min-h-[34rem]">
                    <div aria-hidden="true" className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#80c7ec]/45 blur-2xl"/>
                    <div aria-hidden="true" className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#2f91c5]/30 blur-2xl"/>
                    <span aria-hidden="true" className="absolute bottom-5 right-7 text-7xl font-bold tracking-tighter text-[#062f51]/10 sm:text-8xl">404</span>
                    <Image
                        priority
                        src={AssetsImage.notFound}
                        alt="A helpful robot holding a map beside a broken link"
                        sizes="(min-width: 1024px) 42vw, (min-width: 640px) 360px, 280px"
                        className="relative h-auto w-full max-w-[19rem] drop-shadow-[0_18px_22px_rgba(4,43,74,0.18)] sm:max-w-[23rem]"
                    />
                </div>

                <div className="flex flex-col justify-center px-6 py-10 text-center sm:px-12 lg:px-14 lg:text-left">
                    <div className="mb-5 inline-flex self-center rounded-full bg-[#e7f5fd] px-3 py-1 text-sm font-semibold text-[#076497] lg:self-start">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#1a9cd1]"/>
                        404
                    </div>
                    <h1 id="not-found-title" className="text-3xl font-semibold tracking-tight text-[#052f51] sm:text-4xl">
                        {t("notFound.errorTitle", "Page Not Found")}
                    </h1>
                    <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
                        {t("notFound.errorDescription", "The page you are looking for is not available. You may have accessed an old link or the content has been moved.")}
                    </p>
                    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
                        <Link
                            prefetch={false}
                            href={`/${lang}`}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#062f51] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#08466f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b79b5]"
                        >
                            <Home aria-hidden="true" className="h-5 w-5"/>
                            {t("notFound.backButton", "Back to Home")}
                        </Link>
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-[#075e91] transition-colors hover:bg-[#eaf6fd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b79b5]"
                        >
                            <ArrowLeft aria-hidden="true" className="h-5 w-5"/>
                            {t("global.buttonBack", "Go back")}
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}
