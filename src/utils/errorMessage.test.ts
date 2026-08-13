import {describe, expect, it, vi} from "vitest";
import {resolveApiErrorMessage} from "./errorMessage";

// A minimal stand-in for i18next's t() -- returns fixed strings for the two
// keys this module actually calls, so tests assert on real fallback text
// rather than a mocked passthrough.
const t = vi.fn((key: string) => {
    if (key === "error.notAvailableYet") return "Not available yet.";
    if (key === "error.serverError") return "Something went wrong.";
    return key;
});

describe("resolveApiErrorMessage", () => {
    it("returns the known-code message when the code is mapped", () => {
        const msg = resolveApiErrorMessage(
            {error: "invalid_code"}, t, {knownCodes: {invalid_code: "That code is wrong."}},
        );
        expect(msg).toBe("That code is wrong.");
    });

    it("shows the server's own message verbatim for an unmapped plain 4xx", () => {
        const msg = resolveApiErrorMessage(
            {error: "invalidField", message: "budget must be greater than 0", status: 422}, t,
        );
        expect(msg).toBe("budget must be greater than 0");
    });

    it("does not use the server message for a 5xx (not a plain client error)", () => {
        const msg = resolveApiErrorMessage(
            {error: "internal_error", message: "panic at src/main.rs:42", status: 500}, t,
        );
        expect(msg).toBe("Something went wrong. (internal_error)");
    });

    it("ignores an implausibly long server message and falls back with the code", () => {
        const msg = resolveApiErrorMessage(
            {error: "weird", message: "x".repeat(200), status: 400}, t,
        );
        expect(msg).toBe("Something went wrong. (weird)");
    });

    it("falls back to the generic message with the code appended when nothing else applies", () => {
        const msg = resolveApiErrorMessage({error: "totally_unknown_code"}, t);
        expect(msg).toBe("Something went wrong. (totally_unknown_code)");
    });

    it("does not duplicate the code if a custom fallback already contains it", () => {
        const msg = resolveApiErrorMessage(
            {error: "rate_limited"}, t, {fallback: "Too many requests (rate_limited), slow down."},
        );
        expect(msg).toBe("Too many requests (rate_limited), slow down.");
    });

    it("falls back to the plain generic message with no code when none is present", () => {
        const msg = resolveApiErrorMessage({message: "network failure, no code"}, t);
        expect(msg).toBe("Something went wrong.");
    });

    it("special-cases 501 before anything else, even a known code or message", () => {
        const msg = resolveApiErrorMessage(
            {error: "invalid_code", message: "ignored", status: 501}, t,
            {knownCodes: {invalid_code: "also ignored"}},
        );
        expect(msg).toBe("Not available yet.");
    });

    it("handles a completely empty error", () => {
        const msg = resolveApiErrorMessage(undefined, t);
        expect(msg).toBe("Something went wrong.");
    });
});
