// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useWorkflowActions, type UseWorkflowActionsDeps} from "@/modules/chat/hooks/useWorkflowActions";

/**
 * Starting an order uses the job the employer picked.
 *
 * `startWorkflowAction` read `deps.postId` -- the post the room was opened
 * from. One conversation now spans every job a pair has run together, so that
 * value is whichever post the room last saw, and for a consolidated room it is
 * null. Ignoring the picker's answer would hold real coins against a job
 * nobody chose, which is the whole of #150.
 */
const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

let container: HTMLDivElement;
let root: Root;

function mountActions(deps: Partial<UseWorkflowActionsDeps>) {
    const captured: {startWorkflowAction?: (postId?: number) => Promise<boolean>} = {};
    const base = {
        messages: [],
        roomData: {id: "dm:8058:8059", localUser: {}} as never,
        localUser: {id: 8058} as never,
        roomId: "dm:8058:8059",
        selectedFile: null as never,
        setError: vi.fn(),
        t: (k: string) => k,
        sendMessage: vi.fn(),
        goToStatus: vi.fn(),
        sendRoomUpdate: vi.fn(),
        setHasStarted: vi.fn(),
        setShowQuotationModal: vi.fn(),
        setSelectedFile: vi.fn(),
        createInvoice: vi.fn(),
        startWorkflow: vi.fn(async () => ({})),
        approveQuotationApi: vi.fn(),
        submitStartWorkApi: vi.fn(),
        approveWorkApi: vi.fn(),
        currentStatus: "None",
    } as unknown as UseWorkflowActionsDeps;

    function Probe() {
        const actions = useWorkflowActions({...base, ...deps});
        captured.startWorkflowAction = actions.startWorkflowAction as never;
        return null;
    }

    act(() => {
        root.render(createElement(Probe));
    });
    return captured;
}

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

describe("starting an order", () => {
    it("uses the job the employer picked, not the room's post", async () => {
        const startWorkflow = vi.fn(async () => ({}));
        const actions = mountActions({startWorkflow: startWorkflow as never, postId: 42 as never});

        await act(async () => {
            await actions.startWorkflowAction!(1305940);
        });

        expect(startWorkflow).toHaveBeenCalledWith(
            expect.objectContaining({postId: 1305940, roomId: "dm:8058:8059"}),
        );
    });

    it("still refuses when no job is available at all", async () => {
        const startWorkflow = vi.fn(async () => ({}));
        const setError = vi.fn();
        const actions = mountActions({
            startWorkflow: startWorkflow as never,
            postId: null,
            setError,
        });

        await act(async () => {
            await actions.startWorkflowAction!();
        });

        expect(startWorkflow).not.toHaveBeenCalled();
        expect(setError).toHaveBeenCalled();
    });
});
