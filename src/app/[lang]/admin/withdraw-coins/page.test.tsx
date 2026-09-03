// @vitest-environment jsdom

import {act, createElement, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import WithdrawCoins from "@/app/[lang]/admin/withdraw-coins/page";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetchBanks = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("@/hooks/api/http/useHttpPost", () => ({
    useHttpPost: () => ({execute: vi.fn(), isMutating: false}),
}));

vi.mock("@/modules/admin/components/layout/AdminLayout", () => ({
    AdminLayout: ({children}: {children: ReactNode}) => children,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

const request = {
    withdrawRequest: {
        id: 42,
        amount: 1500,
        status: "Pending",
        createdAt: "2026-09-01T03:00:00Z",
        userId: 9,
    },
    bankAccount: {bankId: 7, accountNumber: "1234567890", accountName: "Somchai"},
    localUser: {id: 9, email: "somchai@example.com"},
};

/** ทุกคำขอสำเร็จ ยกเว้น `listBanks` ที่ผู้เรียกกำหนดสถานะเอง */
const mockEndpoints = (banks: Record<string, unknown>) => {
    mockUseHttpGet.mockImplementation((endpoint: string) => {
        if (endpoint === "listBanks") {
            return {
                isLoading: false,
                isMutating: false,
                execute: mockRefetchBanks,
                ...banks,
            };
        }
        return {
            data: {withdrawRequests: [request], nextPage: null},
            isLoading: false,
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: vi.fn(),
        };
    });
};

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("admin withdraw-coins", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockUseHttpGet.mockReset();
        mockRefetchBanks.mockClear();
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("does not present a failed bank lookup as a fact about the destination account", () => {
        mockEndpoints({
            data: null,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
        });

        act(() => {
            root.render(createElement(WithdrawCoins));
        });

        expect(container.textContent).not.toContain("admin.withdraw.unknownBank");
        expect(container.textContent).toContain("admin.withdraw.bankNameUnavailable");

        const alert = container.querySelector("[data-testid='bank-list-error']");
        expect(alert).not.toBeNull();
        expect(alert?.textContent).toContain("admin.withdraw.bankListLoadFailed");

        // คำขอถอนเองยังต้องแสดงครบ ความล้มของ listBanks ไม่ใช่เหตุให้ซ่อนคิวงานของแอดมิน
        expect(container.textContent).toContain("somchai@example.com");
        expect(container.textContent).toContain("**** 7890");
        expect(container.textContent).not.toContain("admin.withdraw.list.fetchError");
    });

    it("retries listBanks from the notice", () => {
        mockEndpoints({
            data: null,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
        });

        act(() => {
            root.render(createElement(WithdrawCoins));
        });

        const retryBtn = container.querySelector<HTMLButtonElement>(
            "[data-testid='bank-list-error'] button"
        );
        expect(retryBtn).not.toBeNull();
        act(() => {
            retryBtn?.click();
        });
        expect(mockRefetchBanks).toHaveBeenCalledTimes(1);
    });

    it("renders the real bank name when listBanks succeeds", () => {
        mockEndpoints({
            data: {banks: [{id: 7, name: "Kasikorn Bank"}]},
            state: {state: REQUEST_STATE.SUCCESS},
        });

        act(() => {
            root.render(createElement(WithdrawCoins));
        });

        expect(container.textContent).toContain("Kasikorn Bank");
        expect(container.querySelector("[data-testid='bank-list-error']")).toBeNull();
    });

    it("keeps the untranslated-safe fallback for a bank id the loaded list does not contain", () => {
        mockEndpoints({
            data: {banks: [{id: 99, name: "Some Other Bank"}]},
            state: {state: REQUEST_STATE.SUCCESS},
        });

        act(() => {
            root.render(createElement(WithdrawCoins));
        });

        expect(container.textContent).toContain("admin.withdraw.unknownBank");
        expect(container.textContent).not.toContain("admin.withdraw.bankNameUnavailable");
    });
});
