/**
 * Every literal `t("…")` key in the shipped source must resolve to a string in
 * en, th AND vi — through the same namespace rules i18next applies at runtime.
 *
 * Two ways this goes wrong silently, both of which have shipped here:
 *
 * 1. A key exists only in `en.ts`. `fallbackLng: ["en"]` then renders readable
 *    English to Thai and Vietnamese users instead of the loud key name, so a
 *    screenshot in one language looks perfect (#132, #144).
 * 2. A key is written with a dot where a namespace needs a colon. `en.ts`
 *    exports THREE namespaces — `terms`, `business`, `translation` — and
 *    `I18NextService` passes all of them as `ns`. i18next keeps
 *    `defaultNS: "translation"` because that name is in the list, and `.` is a
 *    key separator, not a namespace separator, so `t("terms.title")` looks up
 *    `translation.terms.title` and renders the key itself. That is what put
 *    "terms.title" and "terms.accept" in the consent dialog (#146).
 *
 * Deliberately NOT placed in `src/translations/`: `I18NextService` does
 * `import(\`../translations/${resource}\`)`, and a template literal makes the
 * bundler pull in every file in that directory — a test file there ends up in
 * the client bundle, the SSR bundle and the middleware, and `next build` dies
 * on its `node:fs` imports while the unit suite stays green.
 */
import {beforeAll, describe, expect, it} from "vitest";
import fs from "node:fs";
import path from "node:path";
import i18next, {type i18n as I18n} from "i18next";

import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi as viTranslation} from "@/translations/vi";

const SRC = path.join(process.cwd(), "src");

/**
 * Keys that resolve to nothing in any locale, tracked as #147. The point of listing them is that the list must SHRINK: delete an entry
 * when the key is added or the call site is fixed. Adding an entry to make this
 * test pass is the one thing that defeats it.
 */
const KNOWN_MISSING: ReadonlySet<string> = new Set<string>([
    "admin.category.subcategoryCount",
    "common.errorOccurred",
    "common.processing",
    "global.buttonBack",
    "global.delete",
    "global.serverError",
    "global.submissionFailed",
    "global.tryRefreshingPage",
    "global.view",
    "profile.addWorkSamples",
    "profile.editWorkSamples",
    "profile.loading",
    "profile.update",
    "profileChat.attachFileFirst",
    "profileChat.cancelledJobHint",
    "profileChat.dropFiles",
    "profileChat.missingBillingId",
    "profileChat.retrying",
    "profileChat.roomSearch.resultCount",
    "profileChat.validation.workStepSeq",
    "profileCoins.processing",
    "profileCoins.topUpSuccessMessage",
    "profileCoins.transferModal.confirm",
    "profileCoins.transferModal.description",
    "profileCoins.transferModal.title",
    "profileInfo.deleteWorkSample",
    "profileInfo.nextSamples",
    "profileInfo.previousSamples",
    "profileInfo.updateAvailableFail",
    "sellerBankAccount.maxAccountsLimit",
    "validation.deadlineMin",
]);

const sourceFiles = (): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(p);
            else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) out.push(p);
        }
    };
    walk(SRC);
    return out;
};

/** `t("a.b.c")` / `t("ns:a.b")` — literal keys only; a computed key cannot be checked here. */
const KEY = /\bt\(\s*(["'])([A-Za-z0-9_]+:)?([A-Za-z0-9_.]+)\1\s*[,)]/g;

const collectKeys = () => {
    const used = new Map<string, string>();
    for (const file of sourceFiles()) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(KEY)) {
            const key = `${m[2] ?? ""}${m[3]}`;
            if (!used.has(key)) used.set(key, path.relative(SRC, file));
        }
    }
    return used;
};

const LOCALES = {en, th, vi: viTranslation} as const;

/**
 * One real i18next per locale, initialised the way `I18NextService` does — every
 * exported top-level key as a namespace, no explicit `defaultNS`, i18next's own
 * separators.
 *
 * Deliberately NOT a hand-written walk of the objects. A guard that
 * reimplements the rules it is guarding can agree with the next bug the same
 * way it would have agreed with #146: the defect there was in the separator
 * rules, exactly the part a hand-rolled resolver has to restate. Asking the
 * library moves this test with the library.
 *
 * One deliberate difference from the app: `fallbackLng: false`, so th and vi
 * answer for themselves. A key present only in `en.ts` silently rendering
 * English to a Thai user is the other half of what this guard is for.
 */
const instances: Record<string, I18n> = {};

beforeAll(async () => {
    for (const [lng, resource] of Object.entries(LOCALES)) {
        const i18n = i18next.createInstance();
        await i18n.init({
            compatibilityJSON: "v4",
            lng,
            fallbackLng: false,
            ns: Object.keys(en),
            resources: {[lng]: resource} as never,
        });
        instances[lng] = i18n;
    }
});

/** `returnObjects` is used for list copy, so an array of strings is a valid value. */
const isRenderable = (i18n: I18n, key: string): boolean => {
    if (!i18n.exists(key)) return false;
    const value = i18n.t(key, {returnObjects: true}) as unknown;
    if (Array.isArray(value)) return value.length > 0 && value.every((v) => typeof v === "string");
    if (typeof value !== "string") return false;
    // คีย์ที่หาไม่เจอถูกเรนเดอร์เป็นชื่อคีย์เอง — นั่นคืออาการของ #146 ไม่ใช่ข้อความ
    return value.length > 0 && value !== key;
};

describe("i18n keys", () => {
    for (const name of Object.keys(LOCALES)) {
        it(`resolves every literal t() key used in src/ against ${name}.ts`, () => {
            const missing: string[] = [];
            for (const [key, file] of collectKeys()) {
                if (KNOWN_MISSING.has(key)) continue;
                if (!isRenderable(instances[name], key)) missing.push(`${key} (used in ${file})`);
            }
            expect(missing).toEqual([]);
        });
    }

    it("proves the guard reads i18next's rules, not a restatement of them", () => {
        // ถ้าเทสต์นี้ล้ม แปลว่ากติกาที่ guard พึ่งอยู่เปลี่ยนไป — ซึ่งเป็นสิ่งที่อยากรู้
        expect(instances.en.options.defaultNS).toContain("translation");

        // จุดไม่ใช่ตัวคั่น namespace — นี่คือบั๊ก #146
        expect(instances.en.exists("terms.title")).toBe(false);
        expect(instances.en.exists("terms:title")).toBe(true);

        // แต่จุด *ใน ชื่อคีย์เอง* i18next หาเจอ (`deepFind`) และไฟล์ภาษาเก็บ
        // `termsEmployer` ไว้แบบนั้นจริง — resolver ที่เขียนเองพลาดข้อนี้ ทำให้เคยรายงาน
        // ผิดว่าหน้าเงื่อนไขสาธารณะพัง 21 คีย์ (ถอนแล้ว ดู #147)
        expect(instances.en.exists("termsEmployer.dispute.title")).toBe(true);
        expect(instances.en.t("termsEmployer.dispute.title")).toBe("User Dispute Resolution");
        for (const lng of ["th", "vi"]) {
            expect(instances[lng].exists("termsEmployer.dispute.title")).toBe(true);
        }
    });

    it("keeps the #147 list honest: every entry is still missing somewhere", () => {
        const used = collectKeys();
        const stale = [...KNOWN_MISSING].filter(
            (key) =>
                !used.has(key) ||
                Object.keys(LOCALES).every((lng) => isRenderable(instances[lng], key)),
        );
        // เมื่อคีย์ถูกเติมครบสามภาษาแล้ว (หรือ call site หายไป) ต้องลบออกจากลิสต์
        // ไม่งั้นลิสต์จะกลายเป็นที่ซ่อนของ แทนที่จะเป็นหนี้ที่หดลง
        expect(stale).toEqual([]);
    });
});
