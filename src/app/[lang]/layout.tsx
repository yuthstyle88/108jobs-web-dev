import {LanguageProvider} from "@/contexts/LanguageContext";
import {Kanit} from "next/font/google";
import {Toaster} from "sonner";
import FontAwesomeConfig from "../fontawesome";
import "../globals.css";
import React from "react";
import {isoDataInitializer} from "@/utils";
import {GlobalErrorProvider} from "@/contexts/GlobalErrorContext";
import {AnnouncementProvider} from "@/contexts/AnnouncementContext";
import AccessibleAnnouncements from "@/components/AccessibleAnnouncements";
import GlobalError from "@/components/GlobalError";
import GlobalLoader from "@/components/Common/Loading/Loading";
import TermsGate from "@/components/TermsGate";
import {getLangCookies} from "@/utils/getLangCookies";
import {UserServiceProvider} from "@/contexts/UserServiceContext";
import {UserEventsProvider} from "@/modules/chat/contexts/UserEventsContext";
import {GlobalLoaderProvider} from "@/hooks/ui/GlobalLoaderContext";
import {TooltipProvider} from "@/components/ui/Tooltip";
import {I18NextService} from "@/services";
import {Metadata, Viewport} from "next";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
};

const kanit = Kanit({
    subsets: ["latin", "vietnamese", "thai"],
    weight: ["400", "500", "600"],
    style: ["normal", "italic"],
    display: "swap",
    preload: true,
    fallback: ['system-ui', 'arial', 'sans-serif'],
    adjustFontFallback: true,
})

export async function generateMetadata(
    props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {

    const { lang } = await props.params;

    await I18NextService.init();
    await I18NextService.i18n.changeLanguage(lang);

    const t = I18NextService.i18n.t.bind(I18NextService.i18n);

    return {
        title: t("global.labelProductFastwork") || process.env.NEXT_PUBLIC_SITE_NAME,
        icons: {
            icon: [
                { url: "/icon.png", type: "image/png" },
                { url: "/favicon.ico", sizes: "any" },
            ],
            shortcut: "/favicon.ico",
            apple: [
                { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
            ],
        },
    };
}

export default async function RootLayout({
                                             children,
                                             params,
                                         }: Readonly<{
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}>) {
    const {lang} = await params;
    const isoData = await isoDataInitializer();
    const langCookie = await getLangCookies();
    const userLang = isoData?.myUserInfo?.localUserView?.localUser?.interfaceLanguage as string | undefined;
    const initialLang = lang || langCookie || userLang;
    return (
        <html lang={lang} suppressHydrationWarning>
        <body suppressHydrationWarning className={`${kanit.className} antialiased bg-white`}>
        <FontAwesomeConfig/>
        <LanguageProvider initialLang={initialLang!}>
            <GlobalLoaderProvider>
                <GlobalErrorProvider>
                    <UserServiceProvider
                        isoData={isoData ?? null}
                    >
                        <UserEventsProvider>
                            <AnnouncementProvider>
                                <TooltipProvider>
                                    <Toaster richColors closeButton position="bottom-right"/>
                                    <AccessibleAnnouncements/>
                                    <GlobalError/>
                                    <GlobalLoader/>
                                    {/* Mounted app-wide, not per page: a user who
                                        has not accepted this site's terms is gated
                                        on every jobs surface, so the prompt has to
                                        be reachable from wherever they landed.
                                        Renders nothing until the server has said
                                        consent is actually missing. */}
                                    <TermsGate/>
                                    {children}
                                </TooltipProvider>
                            </AnnouncementProvider>
                        </UserEventsProvider>
                    </UserServiceProvider>
                </GlobalErrorProvider>
            </GlobalLoaderProvider>
        </LanguageProvider>
        </body>
        </html>
    );
}