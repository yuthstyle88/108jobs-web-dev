import {Locale, setDefaultOptions} from "date-fns";
import {I18NextService, LanguageService, pickTranslations} from "@/services/I18NextService";
import {enUS} from "date-fns/locale/en-US";
import {th} from "date-fns/locale/th";
import {vi} from "date-fns/locale/vi";
import {ImportReport} from "@/utils/dynamic-imports";
import {MyUserInfo} from "108heros-client";

export const getLocale = (locale: string | undefined): string => {
    if (!locale) return "en-US";
    const localeMap: Record<string, string> = {
        en: "en-US",
        th: "th-TH",
        vi: "vi-VN",
    };
    return localeMap[locale] || "en-US";
};

type DateFnsDesc = { resource: Locale; code: string; bundled?: boolean };

const locales: DateFnsDesc[] = [
    { resource: enUS, code: "en-US", bundled: true },
    { resource: th, code: "th-TH" },
    { resource: vi, code: "vi-VN" },
];

const localeByCode = locales.reduce<Record<string, DateFnsDesc>>((acc, l) => {
    acc[l.code] = l;
    return acc;
}, {});

// Map en_US to en-US for consistency
localeByCode["en_US"] = localeByCode["en-US"];

const EN_US = "en-US";

async function load(locale: DateFnsDesc): Promise<Locale> {
    const supportedLocales: Record<string, Locale> = {
        "en-US": enUS,
        "th-TH": th,
        "vi-VN": vi,
    };

    if (locale.code in supportedLocales) {
        return supportedLocales[locale.code];
    }

    throw new Error(`Unsupported locale: ${locale.code}`);
}

export async function verifyDateFnsImports(): Promise<ImportReport> {
    const report = new ImportReport();
    const promises = locales.map(locale =>
        load(locale)
            .then(x => {
                if (x && x.code === locale.code) {
                    report.success.push(locale.code);
                } else {
                    throw "unexpected format";
                }
            })
            .catch(err => report.error.push({ id: locale.code, error: err })),
    );
    await Promise.all(promises);
    return report;
}

export function bestDateFns(languages: readonly string[], i18nFullLang: string): DateFnsDesc {
    const baseLang = getLocale(i18nFullLang.split("-")[0]);
    for (const lang of languages.filter(x => x.startsWith(baseLang.split("-")[0]))) {
        const locale = localeByCode[getLocale(lang)];
        if (locale) {
            return locale;
        }
    }
    return localeByCode[baseLang] ?? localeByCode[EN_US];
}

export function findDateFnsChunkNames(languages: readonly string[]): string[] {
    let i18n_full_lang = EN_US;
    for (const lang of languages) {
        if (pickTranslations(lang)) {
            i18n_full_lang = lang;
            break;
        }
    }
    const locale = bestDateFns(languages, i18n_full_lang);
    if (locale.bundled) {
        return [];
    }
    return [`date-fns-${locale.code}-js`];
}

export async function setupDateFns(myUserInfo?: MyUserInfo) {
    const i18n_full_lang = I18NextService.i18n.resolvedLanguage ?? EN_US;
    const localeDesc = bestDateFns(LanguageService.userLanguages(myUserInfo), i18n_full_lang);
    try {
        const locale = await load(localeDesc);
        if (locale) {
            setDefaultOptions({ locale });
            return;
        }
    } catch {
        console.error(`Loading ${localeDesc.code} date-fns failed.`);
    }

    setDefaultOptions({ locale: enUS });
}

export const toLocalTime = (input: string | number | Date, locale: string) => {
    const formatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const format = (d: Date) => formatter.format(d);

    // Guard
    if (input == null || input === '') return '';

    // Declare d here to ensure it's available in all scopes
    let d: Date;

    // Fast paths
    if (input instanceof Date && !isNaN(input.getTime())) return format(input);
    if (typeof input === 'number') {
        d = new Date(input);
        return isNaN(d.getTime()) ? '' : format(d);
    }

    let iso = String(input);

    // Normalize common variants:
    // 1) Space-separated: "YYYY-MM-DD HH:mm:ss(.sss)" → replace space with 'T'
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(iso)) {
        iso = iso.replace(' ', 'T');
    }

    // 2) Missing timezone: add 'Z' (treat as UTC) if no Z/+/-
    if (!/[Zz+\-]$/.test(iso) && !/[Zz]|[+\-]\d{2}:?\d{2}$/.test(iso)) {
        iso = iso + 'Z';
    }

    // 3) Excess fractional seconds: clamp to 3 digits
    if (iso.includes('.')) {
        try {
            const [head, rest] = iso.split('.');
            let tz = '';
            let frac = rest;
            const tzMarkers = ['Z', 'z', '+', '-'] as const;
            let idx = -1;
            for (const m of tzMarkers) {
                const i = rest.indexOf(m);
                if (i > 0) { idx = i; break; }
            }
            if (idx >= 0) {
                tz = rest.slice(idx);
                frac = rest.slice(0, idx);
            }
            const frac3 = (frac + '000').slice(0, 3);
            iso = `${head}.${frac3}${tz || 'Z'}`;
        } catch {}
    }

    d = new Date(iso);
    return isNaN(d.getTime()) ? '' : format(d);
};

/**
 * Converts timestamp string to Unix timestamp in milliseconds, as used by JavaScript
 */
export function getUnixTime(text?: string): number | undefined {
    return text ? new Date(text).getTime() : undefined;
}

/**
 * Converts a UTC date to a local date by adjusting for timezone offset
 */
export function convertUTCDateToLocalDate(date: Date): Date {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
}

/**
 * Converts a Unix timestamp to a local time string (hour and minute),
 * using the user's locale.
 */
export function unixTimeToLocalTimeStr(unixTime?: number, lang?: string): string | undefined {
    if (!unixTime) return undefined;
    const date = convertUTCDateToLocalDate(new Date(unixTime));
    const locale = getLocale(lang);
    return toLocalTime(date, locale);
}