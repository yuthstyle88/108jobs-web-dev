import {describe, expect, it} from "vitest";
import {sanitizeRedirect} from "@/services/authRedirect";

describe("sanitizeRedirect (open-redirect guard for ?redirect=)", () => {
    it("allows a same-origin relative path", () => {
        expect(sanitizeRedirect("/profile")).toBe("/profile");
        expect(sanitizeRedirect("/job-board/jobs?category=1")).toBe("/job-board/jobs?category=1");
    });

    it("falls back to the site root for an absolute URL", () => {
        expect(sanitizeRedirect("https://evil.example")).toBe("/");
        expect(sanitizeRedirect("http://evil.example/phish")).toBe("/");
    });

    it("falls back to the site root for a protocol-relative URL", () => {
        // Browsers resolve //evil.example as absolute, inheriting the
        // current page's scheme -- a naive `startsWith("/")` check alone
        // would let this through.
        expect(sanitizeRedirect("//evil.example")).toBe("/");
    });

    it("falls back to the site root for backslash protocol-relative URLs", () => {
        expect(sanitizeRedirect("/\\evil.example")).toBe("/");
        expect(sanitizeRedirect("/\\/evil.example")).toBe("/");
    });

    it("falls back to the site root for control characters (TAB, LF, CR) protocol-relative URLs", () => {
        expect(sanitizeRedirect("/\tevil.example")).toBe("/");
        expect(sanitizeRedirect("/\t/evil.example")).toBe("/");
        expect(sanitizeRedirect("/\n/evil.example")).toBe("/");
        expect(sanitizeRedirect("/\r\n/evil.example")).toBe("/");
    });

    it("preserves valid paths in control cases", () => {
        expect(sanitizeRedirect("/")).toBe("/");
        expect(sanitizeRedirect("/%5Cevil.example")).toBe("/%5Cevil.example");
        expect(sanitizeRedirect("/th/admin/dashboard?tab=pending&q=a b")).toBe("/th/admin/dashboard?tab=pending&q=a b");
        expect(sanitizeRedirect("/a\\b")).toBe("/a\\b");
    });

    it("falls back to the site root for a non-path string", () => {
        expect(sanitizeRedirect("evil.example")).toBe("/");
        expect(sanitizeRedirect("")).toBe("/");
    });
});
