// @vitest-environment jsdom

import {act, createElement, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import ManageUsers from "@/app/[lang]/admin/manage-users/page";
import {REQUEST_STATE} from "@/services/HttpService";
import {toast} from "sonner";

const mockUseHttpGet = vi.fn();
const mockRefetchUsers = vi.fn();
const mockExecuteBan = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("@/hooks/api/http/useHttpPost", () => ({
    useHttpPost: () => ({execute: mockExecuteBan, isMutating: false}),
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

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const activeUser = {
    person: {id: 11, name: "somchai", displayName: "Somchai S.", avatar: null, publishedAt: "2026-01-05T00:00:00Z"},
    localUser: {id: 9, email: "somchai@example.com", admin: false},
    banned: false,
};

const bannedUser = {
    person: {id: 12, name: "lert", displayName: "Lert P.", avatar: null, publishedAt: "2026-01-06T00:00:00Z"},
    localUser: {id: 10, email: "lert@example.com", admin: false},
    banned: true,
};

/** หน้า manage-users โหลดรายชื่อสำเร็จ ผู้เรียกเลือกคนในลิสต์ได้ */
const seedUserList = (users: unknown[]) => {
    mockUseHttpGet.mockImplementation(() => ({
        data: {users, nextPage: null},
        isLoading: false,
        isMutating: false,
        state: {state: REQUEST_STATE.SUCCESS},
        execute: mockRefetchUsers,
    }));
};

/** t() ถูก mock เป็น key passthrough ⇒ หาปุ่มด้วยข้อความที่ตรงกับ key เป๊ะ กัน prefix ชนกัน (เช่น manageUsers.ban กับ manageUsers.bannedOnly) */
const findButtonByText = (scope: ParentNode, text: string) =>
    Array.from(scope.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === text,
    ) ?? null;

/** jsdom ไม่มีการทำงานของ input แบบจริง ⇒ เซ็ตค่าผ่าน native setter แล้วยิง input event ให้ React onChange ทำงาน */
const setTypeValue = (textarea: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", {bubbles: true}));
};

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("admin manage-users ban/unban failure handling", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockUseHttpGet.mockReset();
        mockRefetchUsers.mockClear();
        mockExecuteBan.mockReset();
        vi.mocked(toast.success).mockClear();
        vi.mocked(toast.error).mockClear();
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    const renderPage = () => {
        act(() => {
            root.render(createElement(ManageUsers));
        });
    };

    /** เปิด modal แบน ใส่เหตุผล กดยืนยัน แล้วรอ promise ของ confirmBan ไหลจบ */
    const openBanModalAndConfirm = async () => {
        renderPage();
        const banButton = findButtonByText(container, "manageUsers.ban");
        expect(banButton).not.toBeNull();
        act(() => banButton?.click());

        const reasonInput = document.querySelector<HTMLTextAreaElement>("#ban-reason");
        expect(reasonInput).not.toBeNull();
        act(() => setTypeValue(reasonInput as HTMLTextAreaElement, "spam"));

        const confirmButton = findButtonByText(document, "manageUsers.banConfirmationModal.confirm");
        expect(confirmButton).not.toBeNull();
        await act(async () => {
            confirmButton?.click();
        });
    };

    it("ban failure does not show a success toast", async () => {
        seedUserList([activeUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        await openBanModalAndConfirm();

        expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    });

    it("ban failure shows an error toast", async () => {
        seedUserList([activeUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        await openBanModalAndConfirm();

        expect(vi.mocked(toast.error)).toHaveBeenCalledWith("common.errorOccurred");
    });

    it("ban failure does not refetch the user list", async () => {
        seedUserList([activeUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        await openBanModalAndConfirm();

        expect(mockRefetchUsers).not.toHaveBeenCalled();
    });

    it("ban failure keeps the confirmation modal open", async () => {
        seedUserList([activeUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        await openBanModalAndConfirm();

        // โค้ดเดิมปิด modal ใน finally ⇒ banReason โดนเคลียร์เป็น "" ทันทีแม้ DOM จะค้างรอ animation
        // การตรวจ "ค่ายังอยู่" เลยเป็นตัวแยก fail/success path ที่ deterministic
        const reasonInput = document.querySelector<HTMLTextAreaElement>("#ban-reason");
        expect(reasonInput).not.toBeNull();
        expect(reasonInput?.value).toBe("spam");
    });

    it("ban success still shows the success toast and refetches", async () => {
        seedUserList([activeUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.SUCCESS, data: {success: true}});

        await openBanModalAndConfirm();

        expect(vi.mocked(toast.success)).toHaveBeenCalledWith("manageUsers.banConfirmationModal.successWithReason");
        expect(mockRefetchUsers).toHaveBeenCalledTimes(1);

        // ปิด modal หลังสำเร็จเหมือนเดิม — รอ leave animation (200ms) จบแล้ว DOM ต้องหาย
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 250));
        });
        expect(document.querySelector("#ban-reason")).toBeNull();
    });

    it("unban failure does not show a success toast", async () => {
        seedUserList([bannedUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        renderPage();
        const unbanButton = findButtonByText(container, "manageUsers.unban");
        expect(unbanButton).not.toBeNull();
        await act(async () => {
            unbanButton?.click();
        });

        expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    });

    it("unban failure shows an error toast", async () => {
        seedUserList([bannedUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.FAILED, err: new Error("boom")});

        renderPage();
        const unbanButton = findButtonByText(container, "manageUsers.unban");
        await act(async () => {
            unbanButton?.click();
        });

        expect(vi.mocked(toast.error)).toHaveBeenCalledWith("common.errorOccurred");
    });

    it("unban success still shows the success toast and refetches", async () => {
        seedUserList([bannedUser]);
        mockExecuteBan.mockResolvedValue({state: REQUEST_STATE.SUCCESS, data: {success: true}});

        renderPage();
        const unbanButton = findButtonByText(container, "manageUsers.unban");
        await act(async () => {
            unbanButton?.click();
        });

        expect(vi.mocked(toast.success)).toHaveBeenCalledWith("manageUsers.unbannedSuccess");
        expect(mockRefetchUsers).toHaveBeenCalledTimes(1);
    });
});
