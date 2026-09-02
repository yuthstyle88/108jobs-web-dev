// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import NotificationDropdown from "@/components/NotificationDropdown";
import {useNotificationStore} from "@/store/useNotificationStore";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: {language: "en"},
    }),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("NotificationDropdown", () => {
    let container: HTMLDivElement;
    let root: Root;
    const originalLocation = window.location;
    const assignMock = vi.fn();

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockPush.mockClear();
        assignMock.mockClear();

        // Setup mock window.location
        delete (window as any).location;
        (window as any).location = {
            href: "https://108jobs.com/en",
            protocol: "https:",
            host: "108jobs.com",
            origin: "https://108jobs.com",
            assign: assignMock,
        };
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        document.body.innerHTML = "";
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        (window as any).location = originalLocation;
    });

    it("navigates to ride app URL with locale prefix on rider application notification click", async () => {
        const markAsReadMock = vi.fn().mockResolvedValue(undefined);
        useNotificationStore.setState({
            notifications: [
                {
                    id: 42,
                    sourceEventId: "evt-1",
                    kind: "RiderApplicationRejected",
                    createdAt: "2026-09-02T12:00:00Z",
                    readAt: null,
                    decision: {
                        outcome: "Rejected",
                        issues: [{reason: "Photo blurry", document: "idCard"}],
                    },
                },
            ],
            unreadCount: 1,
            loading: false,
            hasFetched: true,
            markAsRead: markAsReadMock,
        });

        act(() => {
            root.render(createElement(NotificationDropdown));
        });

        // Open dropdown
        const bellButton = document.body.querySelector("button");
        expect(bellButton).not.toBeNull();
        act(() => {
            bellButton?.click();
        });

        // Click notification item
        const itemRow = document.body.querySelector(".divide-y > div") as HTMLElement;
        expect(itemRow).not.toBeNull();

        await act(async () => {
            itemRow.click();
        });

        expect(markAsReadMock).toHaveBeenCalledWith(42);
        expect(mockPush).not.toHaveBeenCalled();
        expect(assignMock).toHaveBeenCalledWith("https://108heros.com/en/rider/apply");
    });
});
