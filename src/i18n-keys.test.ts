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
import {describe, expect, it} from "vitest";
import fs from "node:fs";
import path from "node:path";

import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi as viTranslation} from "@/translations/vi";

const SRC = path.join(process.cwd(), "src");

/**
 * Keys the sweep found already missing when this guard was written, tracked as
 * #147. The point of listing them is that the list must SHRINK: delete an entry
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
    "profileInfo.accountNumberHelperTH",
    "profileInfo.accountNumberHelperVN",
    "profileInfo.deleteWorkSample",
    "profileInfo.nextSamples",
    "profileInfo.previousSamples",
    "profileInfo.updateAvailableFail",
    "sellerBankAccount.maxAccountsLimit",
    "termsEmployer.coinAndBonus.title",
    "termsEmployer.contact.title",
    "termsEmployer.dispute.complaint",
    "termsEmployer.dispute.escalation",
    "termsEmployer.dispute.intro",
    "termsEmployer.dispute.title",
    "termsEmployer.fee.title",
    "termsEmployer.liabilityClaim.companyLiability",
    "termsEmployer.liabilityClaim.intro",
    "termsEmployer.liabilityClaim.legalAction",
    "termsEmployer.liabilityClaim.title",
    "termsEmployer.liabilityClaim.toCompany",
    "termsEmployer.liabilityClaim.toEachOther",
    "termsEmployer.limitation.disclaimer",
    "termsEmployer.limitation.exclusions",
    "termsEmployer.limitation.intro",
    "termsEmployer.limitation.noGuarantee",
    "termsEmployer.limitation.title",
    "termsEmployer.orderChange.title",
    "termsEmployer.review.title",
    "termsEmployer.work.title",
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

/**
 * Resolve the way i18next does: `ns:key` reads that namespace, a bare key reads
 * `translation` (the default namespace, because "translation" is one of the
 * names passed as `ns`).
 */
const resolve = (tree: Record<string, unknown>, key: string): unknown => {
    const [ns, rest] = key.includes(":")
        ? [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)]
        : ["translation", key];
    return rest.split(".").reduce<unknown>(
        (node, part) =>
            node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
        tree[ns],
    );
};

/** `returnObjects` is used for list copy, so an array of strings is a valid value. */
const isRenderable = (value: unknown): boolean =>
    (typeof value === "string" && value.length > 0) ||
    (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string"));

const LOCALES = {en, th, vi: viTranslation} as const;

describe("i18n keys", () => {
    for (const [name, tree] of Object.entries(LOCALES)) {
        it(`resolves every literal t() key used in src/ against ${name}.ts`, () => {
            const missing: string[] = [];
            for (const [key, file] of collectKeys()) {
                if (KNOWN_MISSING.has(key)) continue;
                if (!isRenderable(resolve(tree as Record<string, unknown>, key))) {
                    missing.push(`${key} (used in ${file})`);
                }
            }
            expect(missing).toEqual([]);
        });
    }

    it("keeps the #147 list honest: every entry is still missing somewhere", () => {
        const used = collectKeys();
        const stale = [...KNOWN_MISSING].filter(
            (key) =>
                !used.has(key) ||
                Object.values(LOCALES).every((tree) =>
                    isRenderable(resolve(tree as unknown as Record<string, unknown>, key)),
                ),
        );
        // เมื่อคีย์ถูกเติมครบสามภาษาแล้ว (หรือ call site หายไป) ต้องลบออกจากลิสต์
        // ไม่งั้นลิสต์จะกลายเป็นที่ซ่อนของ แทนที่จะเป็นหนี้ที่หดลง
        expect(stale).toEqual([]);
    });
});
