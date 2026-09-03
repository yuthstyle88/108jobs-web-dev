import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi} from "@/translations/vi";

// Regression guard for #131.
//
// #126 gave the failure branches from #121 their copy as `t(key, "English default")`.
// i18next returns the default when a key is missing, so a key that was never added to
// en/th/vi still rendered readable English in tests and in the browser -- the missing
// translation was invisible. Thai and Vietnamese users got an English "Retry"; four
// branches pointed at `error.limitSendEmail`, whose stored copy is the resend-email
// throttle message ("Please wait a moment before trying again"), so a 500 was explained
// as a rate limit.
//
// These tests read the shipped source of every failure branch, pull out the keys it
// actually asks for, and require each one to exist in all three locale files. Add a
// `t("...")` without adding the key and this file goes red, in whichever locale was
// forgotten.

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "..", "src");

const FAILURE_BRANCH_SOURCES = [
    "app/[lang]/(job)/job-board/edit/[jobId]/page.tsx",
    "app/[lang]/(job)/job-board/jobs/page.tsx",
    "app/[lang]/chat/message/[roomId]/MessageClient.tsx",
    "components/Common/Modal/AddBankAccountModal/index.tsx",
    "components/JobBoardDetail/components/JobBoardProposal/index.tsx",
    "components/JobBoardDetail/index.tsx",
];

const LOCALES = {en, th, vi} as Record<string, {translation: Record<string, unknown>}>;

/** Every `t("some.key"` in the file. Dynamic keys (backticks, variables) are skipped. */
const staticKeysIn = (source: string): string[] => {
    const keys = new Set<string>();
    for (const match of source.matchAll(/\bt\(\s*"([^"]+)"/g)) {
        keys.add(match[1]);
    }
    return [...keys];
};

const lookup = (bundle: {translation: Record<string, unknown>}, key: string): unknown =>
    key.split(".").reduce<unknown>(
        (node, segment) =>
            node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
        bundle.translation,
    );

const usedKeys = FAILURE_BRANCH_SOURCES.flatMap((relative) =>
    staticKeysIn(readFileSync(path.join(srcRoot, relative), "utf8")).map(
        (key) => [relative, key] as const,
    ),
);

describe("failure-branch copy is fully translated", () => {
    it("finds the keys it is meant to police", () => {
        // Guards the scan itself: if a refactor moves these files or changes the call
        // shape, the suite below would vacuously pass on an empty list.
        expect(usedKeys.length).toBeGreaterThan(10);
        expect(usedKeys.map(([, key]) => key)).toContain("global.buttonRetry");
    });

    for (const [locale, bundle] of Object.entries(LOCALES)) {
        it(`defines every key used by the failure branches in ${locale}.ts`, () => {
            const missing = usedKeys
                .filter(([, key]) => typeof lookup(bundle, key) !== "string")
                .map(([file, key]) => `${key} (used in ${file})`);

            expect(missing).toEqual([]);
        });
    }

    it("does not explain a server failure as a rate limit", () => {
        // `error.limitSendEmail` is the resend-email throttle copy. It is correct on the
        // verify-email screen and wrong on a 500; #126 used it for both.
        const offenders = usedKeys
            .filter(([, key]) => key === "error.limitSendEmail")
            .map(([file]) => file);

        expect(offenders).toEqual([]);
    });

    it("translates the retry button rather than falling back to English", () => {
        for (const locale of ["th", "vi"] as const) {
            expect(lookup(LOCALES[locale], "global.buttonRetry")).not.toBe(
                lookup(LOCALES.en, "global.buttonRetry"),
            );
        }
    });
});
