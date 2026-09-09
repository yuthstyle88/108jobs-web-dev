// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {HireAgainModal, type HireAgainPost} from "@/modules/chat/components/HireAgainModal";

/**
 * "Hire again" asks which job.
 *
 * It used to be a yes/no confirm that started a workflow for the room's
 * recorded post. One conversation now spans every job two people have run
 * together, so that value is whichever post the room last saw -- and for a
 * consolidated room it is null. A real order, holding real coins, must not be
 * started against a job nobody chose.
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (k: string) => k}),
}));

const posts: HireAgainPost[] = [
    {id: 1305946, name: "Second job for the same pair", budget: 1500},
    {id: 1305940, name: "Record all core flows", budget: 3000},
];

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<Parameters<typeof HireAgainModal>[0]> = {}) {
    act(() => {
        root.render(
            createElement(HireAgainModal, {
                isOpen: true,
                onClose: vi.fn(),
                onConfirm: vi.fn(),
                posts,
                isLoading: false,
                preselectedPostId: null,
                createJobHref: "/en/job-board/create-job",
                ...props,
            }),
        );
    });
}
const radios = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const confirmButton = () =>
    Array.from(container.querySelectorAll("button")).find(b => b.getAttribute("data-testid") === "hire-again-confirm")!;

beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("Hire again", () => {
    it("lists the employer's jobs to choose from", () => {
        render();
        expect(radios()).toHaveLength(2);
        expect(container.textContent).toContain("Second job for the same pair");
    });

    it("cannot confirm until a job is chosen", () => {
        render();
        expect(confirmButton().disabled).toBe(true);
    });

    it("confirms with the chosen job, and only that", () => {
        const onConfirm = vi.fn();
        render({onConfirm});
        act(() => {
            radios()[1].click();
        });
        expect(confirmButton().disabled).toBe(false);
        act(() => {
            confirmButton().click();
        });
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(1305940);
    });

    it("pre-selects the offered job but still shows the choice", () => {
        render({preselectedPostId: 1305946});
        expect(radios().find(r => r.checked)?.value).toBe("1305946");
        expect(radios()).toHaveLength(2);
        expect(confirmButton().disabled).toBe(false);
    });

    it("ignores a pre-selection that is not one of the employer's jobs", () => {
        // The room's recorded post may belong to the other person -- roles
        // swap between orders. Offering it would start an order the server
        // refuses; offering nothing asks instead.
        render({preselectedPostId: 999});
        expect(radios().some(r => r.checked)).toBe(false);
        expect(confirmButton().disabled).toBe(true);
    });

    it("offers to post a job when there is nothing to choose", () => {
        render({posts: []});
        const link = container.querySelector('a[href="/en/job-board/create-job"]');
        expect(link).not.toBeNull();
        expect(radios()).toHaveLength(0);
    });
});
