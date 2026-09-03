'use client'
import {LANGUAGE_COOKIE, LANGUAGES, VALID_LANGUAGES} from "@/constants/language";
import {SupportedLang} from "@/lib/metadata";
import {isBrowser} from "@/utils/browser";
import {LanguageId} from "@108-plaza/jh-client";

// Micro-cache keyed only by meaningful bits (URL prefix, cookie lang, LS lang, navigator hint)
let cachedClientLang: SupportedLang | undefined;
let cachedKey: string | undefined;

function pickValid(v?: string | null): SupportedLang | undefined {
    return v && VALID_LANGUAGES.includes(v) ? (v as SupportedLang) : undefined;
}

function readCookie(name: string): string | undefined {
    try {
        const cookie = typeof document !== 'undefined' ? document.cookie || '' : '';
        const nameEq = `${name}=`;
        const parts = cookie.split('; ');
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].startsWith(nameEq)) return decodeURIComponent(parts[i].slice(nameEq.length));
        }
        return undefined;
    } catch {
        return undefined;
    }
}

function readUrlLang(pathname: string): string | undefined {
    const firstSeg = pathname.split('/').filter(Boolean)[0];
    return firstSeg && VALID_LANGUAGES.includes(firstSeg) ? firstSeg : undefined;
}


function readNavigatorLang(): string | undefined {
    try {
        if (typeof navigator === 'undefined') return undefined;
        const nav = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
        if (nav.startsWith('th')) return 'th';
        if (nav.startsWith('vi') || nav.startsWith('vn')) return 'vi';
        if (nav.startsWith('en')) return 'en';
        return undefined;
    } catch {
        return undefined;
    }
}

/**
 * Resolve language with clear precedence and a clean cache key:
 * URL prefix > cookie > localStorage > navigator > 'th'
 */
export function getClientCurrentLanguage(forceRefresh = false): SupportedLang {
    // SSR-safe guard
    if (!isBrowser()) return 'th';

    const pathname = typeof window !== 'undefined' ? (window.location?.pathname || '') : '';

    const cookieLang = pickValid(readCookie(LANGUAGE_COOKIE));
    const urlLang = pickValid(readUrlLang(pathname));
    const navLang = pickValid(readNavigatorLang());

    const key = `${urlLang ?? ''}|${cookieLang ?? ''}|${navLang ?? ''}`;
    if (!forceRefresh && cachedKey === key && cachedClientLang) return cachedClientLang;

    const resolved = (urlLang || cookieLang || navLang || 'th') as SupportedLang;
    cachedClientLang = resolved;
    cachedKey = key
    return resolved;
}

export function invalidateClientLanguageCache(): void {
    cachedClientLang = undefined;
    cachedKey = undefined;
}

const LANGS_PATTERN = `(?:${VALID_LANGUAGES.join('|')})`;
const LANG_PREFIX_RE = new RegExp(`^/` + LANGS_PATTERN + `\\b`);

// Reusable: build target URL with the chosen language prefix. Returns null if no change needed.
export function buildLangRedirectTarget(newLang: string, href: string): string | null {
    try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const url = new URL(href, base);
        const pathWithoutLang = url.pathname.replace(LANG_PREFIX_RE, '') || '/';
        const target = `/${newLang}${pathWithoutLang}${url.search}${url.hash}`;
        const currentFull = `${url.pathname}${url.search}${url.hash}`;
        return currentFull !== target ? target : null;
    } catch {
        return null;
    }
}

export function getNumericCode(langCode: string): number | undefined {
    const language = LANGUAGES[langCode as keyof typeof LANGUAGES];
    return language && "numericCode" in language ? language.numericCode : undefined;
}

export function getLangCodeByNumericCode(numericCode: LanguageId): string | undefined {
    const entry = Object.values(LANGUAGES).find(
        (lang) => lang.numericCode === numericCode
    );

    return entry ? entry.code : undefined;
}

