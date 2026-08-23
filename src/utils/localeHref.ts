export const SUPPORTED = ["th", "en", "vi"] as const;
export type Lang = typeof SUPPORTED[number];

export function normalizeLang(input?: string | null): Lang {
    const v = (input ?? "").toLowerCase().split("-")[0];
    return (SUPPORTED as readonly string[]).includes(v) ? (v as Lang) : "th";
}

export function withLocalePrefix(href: string, lang?: string): string {
    const l = normalizeLang(lang);
    if (!href.startsWith("/")) return `/${l}/${href}`; // e.g. "register" → "/th/register"
    // Already has a supported prefix? keep it
    const m = href.match(/^\/(\w{2})(\/|$)/);
    if (m && (SUPPORTED as readonly string[]).includes(m[1])) return href;
    // Root-only → "/th"
    if (href === "/") return `/${l}`;
    return `/${l}${href}`;
}