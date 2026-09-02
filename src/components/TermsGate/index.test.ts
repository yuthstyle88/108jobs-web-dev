/**
 * Regression guard for #146: the consent dialog must render its terms, not the
 * names of the keys that hold them.
 *
 * This test deliberately does NOT mock `t`. The usual `(key) => key` substitute
 * is exactly what hid the bug — with it, a dialog rendering "terms.title"
 * satisfies every assertion written against the key. So instead it initialises a
 * real i18next the way `I18NextService` does, reads the keys out of the
 * component's own shipped source, and requires each one to resolve to a string
 * that is not the key itself.
 */
import {beforeAll, describe, expect, it} from "vitest";
import fs from "node:fs";
import path from "node:path";
import i18next, {type i18n as I18n} from "i18next";

import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi as viTranslation} from "@/translations/vi";

const COMPONENT = path.join(process.cwd(), "src/components/TermsGate/index.tsx");

/** Every literal key the dialog passes to `t()`, read from the file that ships. */
const keysUsedByTermsGate = (): string[] => {
    const src = fs.readFileSync(COMPONENT, "utf8");
    const found = [...src.matchAll(/\bt\(\s*(["'])([A-Za-z0-9_]+:)?([A-Za-z0-9_.]+)\1\s*[,)]/g)].map(
        (m) => `${m[2] ?? ""}${m[3]}`,
    );
    return [...new Set(found)];
};

const instances: Record<string, I18n> = {};

beforeAll(async () => {
    for (const [lng, resource] of Object.entries({en, th, vi: viTranslation})) {
        const i18n = i18next.createInstance();
        await i18n.init({
            compatibilityJSON: "v4",
            lng,
            fallbackLng: ["en"],
            // ตรงกับ I18NextService: ทุก namespace ที่ export จากไฟล์ภาษา
            ns: Object.keys(en),
            resources: {[lng]: resource} as never,
        });
        instances[lng] = i18n;
    }
});

describe("TermsGate copy", () => {
    it("uses at least the eight strings the dialog is made of", () => {
        // กันเคสที่มีคนลบ call site ทิ้งแล้วเทสต์นี้กลายเป็นการยืนยันลิสต์ว่าง
        expect(keysUsedByTermsGate().length).toBeGreaterThanOrEqual(8);
    });

    for (const lng of ["en", "th", "vi"]) {
        it(`resolves every key the dialog renders, in ${lng}`, () => {
            const unresolved = keysUsedByTermsGate().filter((key) => {
                const value = instances[lng].t(key);
                return typeof value !== "string" || value === key || value.length === 0;
            });
            expect(unresolved).toEqual([]);
        });
    }

    it("proves the dotted form is the broken one, so the colon is not cosmetic", () => {
        // นี่คือบั๊ก #146 ตรงๆ: defaultNS คือ `translation` และจุดไม่ใช่ตัวคั่น namespace
        expect(instances.en.options.defaultNS).toContain("translation");
        expect(instances.en.t("terms.title")).toBe("terms.title");
        expect(instances.en.t("terms:title")).not.toBe("terms:title");
    });
});
