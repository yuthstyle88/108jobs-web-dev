import { describe, expect, it } from "vitest";
import { toCamelCaseLastSegment } from "@/utils/helpers";

// Regression coverage for the fix to PostView.category / GetPostResponse.categoryView
// becoming optional (they mirror api-108jobs's Option<Category> / Option<CategoryView>,
// nullable for delivery/RideTaxi posts). Every call site now passes
// `job.category?.path` / `jobDetailData?.categoryView?.category?.path` instead of an
// unguarded chain, so `path` can genuinely be `undefined` on real data -- this locks in
// that toCamelCaseLastSegment tolerates that rather than throwing, which is the only
// reason `?.` is a safe fix instead of just moving the crash one call deeper.
describe("toCamelCaseLastSegment", () => {
  it("returns an empty string for undefined (a category-less post)", () => {
    expect(toCamelCaseLastSegment(undefined)).toBe("");
  });

  it("returns an empty string for an empty path", () => {
    expect(toCamelCaseLastSegment("")).toBe("");
  });

  it("camelCases the last dot-separated segment, matching the translation keys", () => {
    // Real category paths from the local dev DB (category.path column).
    expect(toCamelCaseLastSegment("Top.Marketing_Advertising")).toBe("marketingAdvertising");
    expect(toCamelCaseLastSegment("Top.Graphic_design")).toBe("graphicDesign");
    expect(toCamelCaseLastSegment("Top.Web_programming")).toBe("webProgramming");
  });

  it("handles a path with no dots", () => {
    expect(toCamelCaseLastSegment("Operate")).toBe("operate");
  });

  it("handles hyphens the same way as underscores", () => {
    expect(toCamelCaseLastSegment("Top.foo-bar")).toBe("fooBar");
  });
});
