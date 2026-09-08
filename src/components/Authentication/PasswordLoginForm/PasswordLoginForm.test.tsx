// @vitest-environment jsdom
/**
 * park108jobs#159 — call-site guard for resolveApiErrorMessage()'s JS-builtin
 * filter (src/utils/errorMessage.ts). A pure-function test of
 * resolveApiErrorMessage() alone proves the function is correct in isolation,
 * but not that the wire from a real fetch() failure to the screen actually
 * runs through it — this renders the real form and fails a real request.
 */
import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {REQUEST_STATE} from "@/services/HttpService";

const executeMock = vi.fn();

vi.mock("@/hooks/api/http/useHttpPost", () => ({
    useHttpPost: () => ({
        execute: executeMock,
        data: null,
        isMutating: false,
    }),
}));

vi.mock("react-i18next", () => ({
    // คืนคีย์ตรง ๆ เพื่อให้ assertion ยึดกับคีย์แปล ไม่ใช่ถ้อยคำที่แก้เมื่อไหร่ก็ได้
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "th"}}),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({push: vi.fn()}),
    useSearchParams: () => ({get: () => null}),
}));

import {PasswordLoginForm} from "@/components/Authentication/PasswordLoginForm";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    executeMock.mockReset();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(node: React.ReactElement) {
    act(() => {
        root.render(node);
    });
    return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", {bubbles: true}));
}

async function fillAndSubmit(el: HTMLElement) {
    const usernameInput = el.querySelector<HTMLInputElement>('input[name="usernameOrEmail"]')!;
    const passwordInput = el.querySelector<HTMLInputElement>('input[name="password"]')!;
    await act(async () => {
        setInputValue(usernameInput, "someone@example.com");
        setInputValue(passwordInput, "correct-horse-battery-staple");
    });
    const form = el.querySelector("form")!;
    await act(async () => {
        form.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));
        // form.handleSubmit's async onSubmit needs a tick to resolve `execute`
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("PasswordLoginForm ไม่หลุดข้อความ error ดิบของ JavaScript ลงจอ", () => {
    it("เน็ตหลุดกลางทาง (TypeError จาก fetch) ⇒ ไม่มี TypeError หรือ Failed to fetch โผล่บนจอ", async () => {
        executeMock.mockResolvedValue({
            state: REQUEST_STATE.FAILED,
            err: new TypeError("Failed to fetch"),
        });
        const el = render(<PasswordLoginForm/>);

        await fillAndSubmit(el);

        const message = el.querySelector("p.text-red-500")?.textContent ?? "";
        expect(message).not.toBe("");
        expect(message).not.toContain("TypeError");
        expect(message).not.toContain("Failed to fetch");
    });

    it("รหัสผ่านผิด (identityPlatformLoginFailed) ⇒ ขึ้นข้อความที่แมปไว้ ไม่ใช่ fallback", async () => {
        executeMock.mockResolvedValue({
            state: REQUEST_STATE.FAILED,
            err: {error: "identityPlatformLoginFailed"},
        });
        const el = render(<PasswordLoginForm/>);

        await fillAndSubmit(el);

        const message = el.querySelector("p.text-red-500")?.textContent ?? "";
        expect(message).toBe("authen.invalidLoginCredentials");
    });
});
