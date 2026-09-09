import { describe, expect, it } from "vitest";
import { categoryLabel } from "./categoryLabel";

// A stand-in for react-i18next's `t`: returns the translation when the catalogue
// has one, and otherwise honours `defaultValue` -- falling back to echoing the
// key, which is what `t` does and what put `catalogs.0` on screen.
function fakeT(catalogue: Record<string, string>) {
  return (key: string, opts?: { defaultValue?: string }) =>
    catalogue[key] ?? opts?.defaultValue ?? key;
}

describe("categoryLabel", () => {
  const translated = fakeT({ "catalogs.logoDesign": "Logo Design" });

  it("uses the translated catalogue name when there is one", () => {
    expect(
      categoryLabel(translated, {
        path: "0.logo_design",
        title: "Logo Design (raw)",
        name: "logo-design",
      }),
    ).toBe("Logo Design");
  });

  it("falls back to the category title when the catalogue has no entry", () => {
    // The defect: a category created after the translation files were written
    // rendered the raw key `catalogs.0` instead of anything readable.
    expect(
      categoryLabel(translated, { path: "0", title: "2", name: "c2" }),
    ).toBe("2");
  });

  it("falls back to the name when the title is blank", () => {
    expect(
      categoryLabel(translated, { path: "0", title: "   ", name: "c2" }),
    ).toBe("c2");
  });

  it("renders a dash when there is no category at all", () => {
    expect(categoryLabel(translated, undefined)).toBe("-");
    expect(categoryLabel(translated, null)).toBe("-");
  });

  it("never returns a raw catalogs.* key", () => {
    const label = categoryLabel(translated, {
      path: "0",
      title: undefined,
      name: undefined,
    });
    expect(label).not.toMatch(/^catalogs\./);
  });
});
