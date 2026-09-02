// @vitest-environment jsdom
/**
 * ด่านกันการถอยกลับของ #119
 *
 * `HttpService` จับ error เองแล้ว `return {state: "failed"}` — ไม่ throw ⇒
 * `useHttpGet` คืน `data === null` ทุก state ที่ไม่ใช่ SUCCESS · คอมโพเนนต์ที่เขียน
 * `data?.items ?? []` โดยไม่แตะ `state` จะแปลง 401/500/timeout เป็น "ไม่มีประวัติ"
 *
 * เทสต์ชุดนี้เรนเดอร์คอมโพเนนต์จริงในสามสถานะแล้วยืนยันว่า **แสดงคนละอย่าง**
 * ⇒ ถ้ามีคนลบ `isFailed(state)` ทิ้ง เคส "failed" จะเห็นข้อความ "ไม่มีประวัติ"
 * แล้วเทสต์แดงทันที
 */
import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {REQUEST_STATE} from "@/services/HttpService";

const useHttpGetMock = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: unknown[]) => useHttpGetMock(...args),
}));

vi.mock("react-i18next", () => ({
    // คืนคีย์ตรง ๆ เพื่อให้ assertion ยึดกับคีย์แปล ไม่ใช่ถ้อยคำที่แก้เมื่อไหร่ก็ได้
    useTranslation: () => ({t: (key: string) => key}),
}));

import TopUpHistory from "@/components/TopUpHistory";
import WithdrawHistory from "@/components/WithdrawHistory";

type Scenario = "loading" | "failed" | "empty";

const refetch = vi.fn();

/** จำลองสิ่งที่ `useHttpGet` คืนจริงในแต่ละสถานะ (ดู useHttpGet.ts:90-99) */
function stub(scenario: Scenario) {
    if (scenario === "loading") {
        return {
            state: {state: REQUEST_STATE.LOADING},
            data: null,
            isLoading: true,
            isMutating: false,
            execute: refetch,
            error: undefined,
            pagination: undefined,
        };
    }
    if (scenario === "failed") {
        return {
            // นี่คือสิ่งที่ HttpService.ts:161-166 คืนเมื่อ backend ตอบ 500
            state: {state: REQUEST_STATE.FAILED, err: new Error("500")},
            data: null,
            isLoading: false,
            isMutating: false,
            execute: refetch,
            error: undefined,
            pagination: undefined,
        };
    }
    return {
        state: {state: REQUEST_STATE.SUCCESS, data: {}},
        data: {topUpRequests: [], withdrawRequests: [], banks: [], nextPage: null},
        isLoading: false,
        isMutating: false,
        execute: refetch,
        error: undefined,
        pagination: undefined,
    };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    refetch.mockClear();
    useHttpGetMock.mockReset();
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

const cases = [
    {
        name: "TopUpHistory",
        Component: TopUpHistory,
        emptyKey: "profileCoins.noTopUpHistory",
    },
    {
        name: "WithdrawHistory",
        Component: WithdrawHistory,
        emptyKey: "profileCoins.noWithdrawHistory",
    },
] as const;

describe.each(cases)("$name แยกความล้มออกจากลิสต์ว่าง", ({Component, emptyKey}) => {
    it("500 จากเซิร์ฟเวอร์ ⇒ บอกว่าโหลดไม่สำเร็จ และห้ามบอกว่าไม่มีรายการ", () => {
        useHttpGetMock.mockImplementation(() => stub("failed"));
        const el = render(<Component/>);

        expect(el.querySelector('[data-testid="fetch-error-state"]')).not.toBeNull();
        expect(el.textContent).toContain("global.failedToLoad");
        expect(el.textContent).toContain("global.loadFailedHint");
        // ★ บรรทัดนี้คือด่าน: ถ้ากลืน error เป็นลิสต์ว่างอีก จะแดงตรงนี้
        expect(el.textContent).not.toContain(emptyKey);
    });

    it("ปุ่มลองใหม่เรียก execute ที่ useHttpGet คืนมาจริง", () => {
        useHttpGetMock.mockImplementation(() => stub("failed"));
        const el = render(<Component/>);

        const button = el
            .querySelector('[data-testid="fetch-error-state"]')!
            .querySelector("button")!;
        expect(button).not.toBeNull();

        act(() => {
            button.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });
        expect(refetch).toHaveBeenCalled();
    });

    it("ลิสต์ว่างจริง ⇒ บอกว่าไม่มีรายการ ไม่ใช่ว่าโหลดไม่สำเร็จ", () => {
        useHttpGetMock.mockImplementation(() => stub("empty"));
        const el = render(<Component/>);

        expect(el.textContent).toContain(emptyKey);
        expect(el.querySelector('[data-testid="fetch-error-state"]')).toBeNull();
        expect(el.textContent).not.toContain("global.failedToLoad");
    });

    it("กำลังโหลด ⇒ ไม่ใช่ทั้งสองอย่าง", () => {
        useHttpGetMock.mockImplementation(() => stub("loading"));
        const el = render(<Component/>);

        expect(el.textContent).toContain("profileCoins.Loading");
        expect(el.querySelector('[data-testid="fetch-error-state"]')).toBeNull();
        expect(el.textContent).not.toContain(emptyKey);
    });
});
