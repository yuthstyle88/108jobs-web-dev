// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import WithdrawHistory from "@/components/WithdrawHistory";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetchBanks = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

const withdrawRow = {
    withdrawRequest: {
        id: 42,
        amount: 1500,
        status: "Completed",
        createdAt: "2026-09-01T03:00:00Z",
    },
    bankAccount: {bankId: 7, accountNumber: "1234567890"},
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
            data: {withdrawRequests: [withdrawRow], nextPage: null},
            isLoading: false,
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: vi.fn(),
        };
    });
};

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("WithdrawHistory", () => {
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

    it("says the bank names failed to load — not that the bank is unknown — when listBanks fails", () => {
        mockEndpoints({
            data: null,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
        });

        act(() => {
            root.render(createElement(WithdrawHistory));
        });

        // ห้ามป้ายว่าไม่รู้จักธนาคาร ทั้งที่รายการถอนถูกต้อง — และห้ามเป็นภาษาอังกฤษฝังตาย
        expect(container.textContent).not.toContain("Unknown Bank");
        expect(container.textContent).not.toContain("profileCoins.unknownBank");
        expect(container.textContent).toContain("profileCoins.bankNameUnavailable");

        const alert = container.querySelector("[data-testid='bank-list-error']");
        expect(alert).not.toBeNull();
        expect(alert?.textContent).toContain("profileCoins.bankListLoadFailed");

        // แถวถอนเงินเองยังต้องอยู่ครบ ความล้มของ listBanks ไม่ควรลบประวัติของผู้ใช้
        expect(container.textContent).toContain("#42");
        expect(container.textContent).toContain("****7890");
    });

    it("retries listBanks from the notice", () => {
        mockEndpoints({
            data: null,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
        });

        act(() => {
            root.render(createElement(WithdrawHistory));
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
            root.render(createElement(WithdrawHistory));
        });

        expect(container.textContent).toContain("Kasikorn Bank");
        expect(container.querySelector("[data-testid='bank-list-error']")).toBeNull();
        expect(container.textContent).not.toContain("profileCoins.bankNameUnavailable");
    });

    it("keeps a translated fallback for a bank id the loaded list does not contain", () => {
        mockEndpoints({
            data: {banks: [{id: 99, name: "Some Other Bank"}]},
            state: {state: REQUEST_STATE.SUCCESS},
        });

        act(() => {
            root.render(createElement(WithdrawHistory));
        });

        // รายชื่อโหลดสำเร็จ แต่ไม่มี id นี้ — คนละเรื่องกับโหลดไม่สำเร็จ
        expect(container.textContent).toContain("profileCoins.unknownBank");
        expect(container.textContent).not.toContain("profileCoins.bankNameUnavailable");
        expect(container.querySelector("[data-testid='bank-list-error']")).toBeNull();
    });
});
