// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import BankAccountModal from "@/components/Common/Modal/AddBankAccountModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("BankAccountModal", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        document.body.innerHTML = "";
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("renders error alert with retry button when isBankListFailed is true", () => {
        const onRetry = vi.fn();
        act(() => {
            root.render(createElement(BankAccountModal, {
                isOpen: true,
                onClose: vi.fn(),
                onSubmit: vi.fn(),
                bankList: [],
                isBankListFailed: true,
                onRetryBankList: onRetry,
                error: null,
            }));
        });

        expect(document.body.textContent).toContain("error.loadBanksFailed");
        expect(document.body.textContent).toContain("global.buttonRetry");

        const retryButton = Array.from(document.body.querySelectorAll("button")).find(
            (b) => b.textContent?.includes("global.buttonRetry")
        );
        expect(retryButton).toBeDefined();
        act(() => {
            retryButton?.click();
        });
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders select dropdown with banks when list succeeds", () => {
        const banks = [
            {id: 1, name: "Kasikorn Bank", bankCode: "KBANK", officialName: "KBank", isDeleted: false},
            {id: 2, name: "SCB", bankCode: "SCB", officialName: "SCB", isDeleted: false},
        ];

        act(() => {
            root.render(createElement(BankAccountModal, {
                isOpen: true,
                onClose: vi.fn(),
                onSubmit: vi.fn(),
                bankList: banks as any,
                isBankListFailed: false,
                error: null,
            }));
        });

        const select = document.body.querySelector("select");
        expect(select).not.toBeNull();
        expect(document.body.textContent).toContain("Kasikorn Bank");
        expect(document.body.textContent).toContain("SCB");
    });
});
