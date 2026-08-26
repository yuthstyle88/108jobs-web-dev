import type {Metadata} from "next";
import {seoTranslations, SupportedLang} from "./translations";
import {getAppName} from "@/utils/appConfig";
import {getLangCookies} from "@/utils/getLangCookies";

type PageContent = {title: string; description: string};
type PageKey = {
  [K in keyof (typeof seoTranslations)["th"]]: (typeof seoTranslations)["th"][K] extends PageContent
    ? K
    : never;
}[keyof (typeof seoTranslations)["th"]];

export async function generateLocalizedMetadata(
  pageKeyOrContent: PageKey | PageContent,
  overrides?: Partial<Metadata>
): Promise<Metadata> {
  const langCookie = await getLangCookies();
  const t = seoTranslations[langCookie as SupportedLang] || seoTranslations.th;

  const page =
    typeof pageKeyOrContent === "string"
      ? t[pageKeyOrContent]
      : pageKeyOrContent;

  if (!page) {
    throw new Error(`Page content missing or invalid for key: ${pageKeyOrContent}`);
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${getAppName()}`;

  const APP_NAME = getAppName();

  return {
    metadataBase: new URL(BASE_URL),
    applicationName: APP_NAME,
    title: page.title,
    description: page.description,
    openGraph: {
      ...overrides?.openGraph,
      title: page.title,
      description: page.description,
      url: overrides?.openGraph?.url ?? BASE_URL,
      siteName: APP_NAME,
      images: [
        {
          url: t.ogImage,
          width: 1200,
          height: 630,
          alt: page.title,
        },
      ],
      type: "website",
      locale: t.locale,
    },
    alternates: {
      canonical: overrides?.alternates?.canonical ?? BASE_URL,
      languages: {
        th: `${BASE_URL}/th`,
        en: `${BASE_URL}/en`,
        vi: `${BASE_URL}/vi`,
      },
    },
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
    referrer: "strict-origin-when-cross-origin",
    ...overrides,
  };
}