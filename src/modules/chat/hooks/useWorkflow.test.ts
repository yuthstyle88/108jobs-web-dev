// @vitest-environment jsdom

import {act, useEffect} from "react";
import {createRoot, type Root} from "react-dom/client";
import {createElement} from "react";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {useWorkflow, type SelectedOrder} from "@/modules/chat/hooks/useWorkflow";

const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
};

/**
 * Which order an action targets.
 *
 * `roomData.room.workflow` is the room's single *active* workflow. That was a
 * usable answer while a room held one order; a conversation now holds every
 * order two people have run together, so with two running it is a coin toss and
 * with all of them finished it is merely the newest. An explicit selection has
 * to win.
 */
let container: HTMLDivElement;
let root: Root;
let seen: {workflowId: number | null; billingId: number | null} = {
    workflowId: null,
    billingId: null,
};

function Probe({
    roomId,
    roomData,
    selectedOrder,
}: {
    roomId?: string;
    roomData?: unknown;
    selectedOrder?: SelectedOrder | null;
}) {
    const {workflowId, billingId} = useWorkflow(roomId, roomData, {selectedOrder});
    // Recorded in an effect, not during render: reassigning a module-level
    // variable while rendering is a side effect the react-hooks lint refuses.
    // `act()` flushes effects before the assertions read `seen`.
    useEffect(() => {
        seen = {workflowId, billingId};
    });
    return null;
}

function renderProbe(props: {
    roomId?: string;
    roomData?: unknown;
    selectedOrder?: SelectedOrder | null;
}) {
    act(() => {
        root.render(createElement(Probe, props));
    });
}

beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    seen = {workflowId: null, billingId: null};
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

const roomWithWorkflow = {room: {workflow: {id: 17, billingId: 80}}};

describe("which order an action targets", () => {
    it("falls back to the room's workflow when nothing is selected", () => {
        renderProbe({roomId: "dm:8058:8059", roomData: roomWithWorkflow});
        expect(seen.workflowId).toBe(17);
        expect(seen.billingId).toBe(80);
    });

    it("uses the selected order instead of the room's", () => {
        renderProbe({
            roomId: "dm:8058:8059",
            roomData: roomWithWorkflow,
            selectedOrder: {workflowId: 4, billingId: 69},
        });
        expect(seen.workflowId).toBe(4);
    });

    /**
     * The money half. Carrying the previous order's billing across a selection
     * is how an approve or a cancel lands on another order's escrow.
     */
    it("moves the billing to the selected order too", () => {
        renderProbe({
            roomId: "dm:8058:8059",
            roomData: roomWithWorkflow,
            selectedOrder: {workflowId: 4, billingId: 69},
        });
        expect(seen.billingId).toBe(69);
    });

    it("clears the billing for an order that has none yet", () => {
        renderProbe({
            roomId: "dm:8058:8059",
            roomData: roomWithWorkflow,
            selectedOrder: {workflowId: 21, billingId: null},
        });
        expect(seen.workflowId).toBe(21);
        expect(seen.billingId).toBeNull();
    });

    it("follows the selection when the user switches order", () => {
        renderProbe({
            roomId: "dm:8058:8059",
            roomData: roomWithWorkflow,
            selectedOrder: {workflowId: 4, billingId: 69},
        });
        expect(seen.workflowId).toBe(4);

        renderProbe({
            roomId: "dm:8058:8059",
            roomData: roomWithWorkflow,
            selectedOrder: {workflowId: 8, billingId: 71},
        });
        expect(seen.workflowId).toBe(8);
        expect(seen.billingId).toBe(71);
    });
});
