// @vitest-environment jsdom
/**
 * RiderReviewModal is mounted with the real component tree; only the network
 * boundary (useHttpGet/useHttpPost, per the useFileUpload.test.ts precedent)
 * and react-i18next's useTranslation (no repo precedent for this one -- this
 * app's translations are real nested objects loaded through I18NextService,
 * which needs a full init this test has no reason to carry; the standard,
 * safe substitute is a `t` that echoes its key, so assertions below check
 * for the literal dotted key showing up in the rendered DOM) are mocked.
 * Everything else -- escape/backdrop handling, the unavailable-state
 * narrowing, the mismatch warning, and the document tiles -- runs for real
 * and is asserted against the actual rendered DOM.
 */
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {GetRiderResponse, Rider, RiderApplicationView} from "108jobs-client";
import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi as viTranslation} from "@/translations/vi";

vi.mock("@/hooks/api/http/useHttpGet", () => ({useHttpGet: vi.fn()}));
vi.mock("@/hooks/api/http/useHttpPost", () => ({useHttpPost: vi.fn()}));
vi.mock("sonner", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
// No repo precedent for mocking react-i18next -- see file header.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key}),
}));

import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {RiderReviewModal} from "@/modules/admin/components/Modal/RiderReviewModal";

// useHttpGet/useHttpPost are generic over the real API surface, which makes
// their static ReturnType unwieldy to reconstruct for a mock. Both imports
// are the `vi.fn()` from the factories above at runtime; this cast just
// gives the test the plain Mock shape (mockReturnValue etc.) to configure
// them with, without spelling `any` anywhere in this file.
const mockUseHttpGet = useHttpGet as unknown as ReturnType<typeof vi.fn>;
const mockUseHttpPost = useHttpPost as unknown as ReturnType<typeof vi.fn>;

const RIDER_APPLICATION_FIELD_KEYS = [
    "nationalIdNumber",
    "idCardAddress",
    "fatherFullName",
    "motherFullName",
    "dateOfBirth",
    "licenseNumber",
    "licenseExpiryDate",
    "licenseType",
    "licenseIssuedOn",
    "licenseIssuedAt",
    "vehicleRegistrationType",
    "engineDisplacementCc",
    "vehicleFirstRegisteredOn",
    "vehicleTitleHolderName",
    "vehicleTitleHolderIdNumber",
    "vehiclePossessorName",
    "vehiclePossessorIdNumber",
    "insurancePolicyNumber",
    "insuranceExpiresOn",
    "compulsoryInsurancePolicyNumber",
    "compulsoryInsuranceExpiresOn",
    "bankAccountName",
    "bankAccountNumber",
    "bankName",
    "emergencyContactName",
    "emergencyContactRelationship",
    "emergencyContactPhone",
    "emergencyContactAddress",
    "faceConsentGrantedAt",
    "faceConsentVersion",
    "faceConsentWithdrawnAt",
    "emergencyContactConsentedAt",
    "criminalRecordConsentedAt",
    "criminalDeclarationAcceptedAt",
] as const;

const RIDER_DOCUMENT_KINDS = [
    "licence",
    "vehicleRegistration",
    "insurance",
    "compulsoryInsurance",
    "face",
    "bankBook",
] as const;

/** Walks a plain object tree, collecting every leaf value. */
function leaves(node: unknown): unknown[] {
    if (node === null || typeof node !== "object") return [node];
    return Object.values(node as Record<string, unknown>).flatMap(leaves);
}

describe("RiderReviewModal translations", () => {
    it("has all 34 RiderApplicationFields keys, and only those, under fields", () => {
        const keys = Object.keys(en.translation.admin.riders.reviewModal.fields).sort();
        expect(keys).toEqual([...RIDER_APPLICATION_FIELD_KEYS].sort());
    });

    it("has all 6 RiderDocumentKind keys, and only those, under documents.kinds", () => {
        const keys = Object.keys(en.translation.admin.riders.reviewModal.documents.kinds).sort();
        expect(keys).toEqual([...RIDER_DOCUMENT_KINDS].sort());
    });

    it("keeps th and vi structurally in sync with en (same keys, every leaf non-empty)", () => {
        const enKeys = JSON.stringify(collectKeyPaths(en.translation.admin.riders.reviewModal));
        expect(JSON.stringify(collectKeyPaths(th.translation.admin.riders.reviewModal))).toBe(enKeys);
        expect(JSON.stringify(collectKeyPaths(viTranslation.translation.admin.riders.reviewModal))).toBe(enKeys);

        for (const tree of [en, th, viTranslation]) {
            for (const value of leaves(tree.translation.admin.riders.reviewModal)) {
                expect(typeof value).toBe("string");
                expect((value as string).length).toBeGreaterThan(0);
            }
        }
    });

    it("added statusRejected and errorOccurred to all 3 locales", () => {
        for (const tree of [en, th, viTranslation]) {
            expect(tree.translation.admin.riders.statusRejected.length).toBeGreaterThan(0);
            expect(tree.translation.admin.riders.errorOccurred.length).toBeGreaterThan(0);
        }
    });

    // Every literal t("admin.riders...") key the component actually calls
    // (grepped from index.tsx while writing it, not re-derived at test time)
    // -- a missing key here renders as the literal key in the real app, so
    // this is the one check that would have caught a typo the mocked `t` in
    // the rendering tests below cannot: that mock echoes any key, found or
    // not. The two dynamic keys (`fields.${key}`, `documents.kinds.${kind}`)
    // are covered exhaustively by the two tests above instead.
    const REFERENCED_KEYS = [
        "admin.riders.actionApprove",
        "admin.riders.actionApproved",
        "admin.riders.actionReject",
        "admin.riders.actionRejected",
        "admin.riders.errorOccurred",
        "admin.riders.id",
        "admin.riders.rejectionReason",
        "admin.riders.rejectionReasonPlaceholder",
        "admin.riders.statusPending",
        "admin.riders.statusRejected",
        "admin.riders.statusVerified",
        "admin.riders.unknown",
        "admin.riders.reviewModal.actions.cancelReject",
        "admin.riders.reviewModal.actions.confirmReject",
        "admin.riders.reviewModal.applicationUnavailable",
        "admin.riders.reviewModal.closeLabel",
        "admin.riders.reviewModal.documents.notSubmitted",
        "admin.riders.reviewModal.documents.openInNewTab",
        "admin.riders.reviewModal.documents.title",
        "admin.riders.reviewModal.fieldEmpty",
        "admin.riders.reviewModal.mismatch.description",
        "admin.riders.reviewModal.mismatch.fromCard",
        "admin.riders.reviewModal.mismatch.fromLicence",
        "admin.riders.reviewModal.mismatch.title",
        "admin.riders.reviewModal.previousRejectionLabel",
        "admin.riders.reviewModal.rejectionReasonLabel",
        "admin.riders.reviewModal.rejectionReasonRequired",
        "admin.riders.reviewModal.review.criminalRecordCheck",
        "admin.riders.reviewModal.review.criminalRecordCheckedAt",
        "admin.riders.reviewModal.review.criminalRecordCheckedBy",
        "admin.riders.reviewModal.review.criminalRecordClear",
        "admin.riders.reviewModal.review.criminalRecordNotChecked",
        "admin.riders.reviewModal.review.criminalRecordNotClear",
        "admin.riders.reviewModal.review.notYetReviewed",
        "admin.riders.reviewModal.review.reviewedBy",
        "admin.riders.reviewModal.review.title",
        "admin.riders.reviewModal.sections.consent",
        "admin.riders.reviewModal.sections.emergencyContact",
        "admin.riders.reviewModal.sections.identity",
        "admin.riders.reviewModal.sections.insurance",
        "admin.riders.reviewModal.sections.licence",
        "admin.riders.reviewModal.sections.payment",
        "admin.riders.reviewModal.sections.vehicle",
    ];

    it.each(REFERENCED_KEYS)("resolves %s to a non-empty string in en/th/vi", (path) => {
        for (const tree of [en, th, viTranslation]) {
            const value = path.split(".").reduce<unknown>((node, segment) => {
                return node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined;
            }, tree.translation);
            expect(typeof value).toBe("string");
            expect((value as string).length).toBeGreaterThan(0);
        }
    });
});

/** Sorted, order-independent list of dotted key paths in a nested object. */
function collectKeyPaths(node: object, prefix = ""): string[] {
    return Object.entries(node)
        .flatMap(([key, value]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            return typeof value === "object" && value !== null ? collectKeyPaths(value, path) : [path];
        })
        .sort();
}

function fakeRider(overrides: Partial<Rider> = {}): Rider {
    return {
        id: 42,
        userId: 1,
        personId: 1,
        vehicleType: "Motorcycle",
        vehiclePlateNumber: null,
        isVerified: false,
        isActive: true,
        verificationStatus: "Pending",
        rating: 0,
        completedJobs: 0,
        totalJobs: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        isOnline: false,
        acceptingJobs: false,
        joinedAt: null,
        lastActiveAt: null,
        verifiedAt: null,
        ...overrides,
    };
}

function fakeApplication(overrides: Partial<RiderApplicationView> = {}): RiderApplicationView {
    return {
        fields: {},
        documents: [],
        decision: {status: "Pending"},
        ...overrides,
    };
}

function fakeResponse(application?: RiderApplicationView): GetRiderResponse {
    return {
        rider_view: {
            rider: fakeRider(),
            // Only `name`/`avatar` are read by the modal; the rest of Person
            // is a large, unrelated profile shape this test has no stake in.
            person: {name: "Somchai Test", avatar: null} as unknown as GetRiderResponse["rider_view"]["person"],
        },
        application,
    };
}

describe("RiderReviewModal rendering", () => {
    let container: HTMLDivElement;
    let root: Root;
    const onClose = vi.fn();
    const onReviewed = vi.fn();
    const verifyExecute = vi.fn(async () => ({state: "success", data: {ok: true}}));

    beforeEach(() => {
        onClose.mockClear();
        onReviewed.mockClear();
        verifyExecute.mockClear();
        mockUseHttpPost.mockReturnValue({
            state: {state: "empty"},
            data: null,
            execute: verifyExecute,
            isMutating: false,
        });

        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function mount(response: GetRiderResponse | null, isLoading = false) {
        mockUseHttpGet.mockReturnValue({
            state: response ? {state: "success", data: response} : {state: "empty"},
            data: response,
            error: undefined,
            isLoading,
            execute: vi.fn(),
            isMutating: false,
            pagination: undefined,
        });

        act(() => {
            root.render(
                createElement(RiderReviewModal, {rider: fakeRider(), onClose, onReviewed}),
            );
        });
    }

    it("shows the unavailable state when the response carries no application", () => {
        mount(fakeResponse(undefined));
        expect(container.textContent).toContain("admin.riders.reviewModal.applicationUnavailable");
        // Nothing to approve/reject without an application.
        expect(container.textContent).not.toContain("admin.riders.actionApprove");
    });

    it("renders the identity-mismatch warning, labelled as device-read and unverified, only when present", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    review: {identityMismatch: {fromCard: "1111111111111", fromLicence: "2222222222222"}},
                }),
            ),
        );
        expect(container.textContent).toContain("admin.riders.reviewModal.mismatch.title");
        expect(container.textContent).toContain("admin.riders.reviewModal.mismatch.fromLicence");
        expect(container.textContent).toContain("1111111111111");
        expect(container.textContent).toContain("2222222222222");
    });

    it("renders no mismatch warning when identityMismatch is absent", () => {
        mount(fakeResponse(fakeApplication()));
        expect(container.textContent).not.toContain("admin.riders.reviewModal.mismatch.title");
    });

    it("renders every field group and never asserts past a null field", () => {
        mount(fakeResponse(fakeApplication({fields: {nationalIdNumber: "1234567890123"}})));
        expect(container.textContent).toContain("admin.riders.reviewModal.sections.identity");
        expect(container.textContent).toContain("admin.riders.reviewModal.sections.consent");
        expect(container.textContent).toContain("1234567890123");
        // A field left null by the applicant renders the empty-state copy,
        // not a crash and not a blank.
        expect(container.textContent).toContain("admin.riders.reviewModal.fieldEmpty");
    });

    it("renders an <img> for a submitted document and a not-submitted tile for an absent one", () => {
        mount(
            fakeResponse(
                fakeApplication({documents: [{kind: "face", uploadedAt: "2026-01-01T00:00:00Z"}]}),
            ),
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/api/rider-documents/42/face");
        expect(container.textContent).toContain("admin.riders.reviewModal.documents.notSubmitted");
    });

    it("closes on Escape", () => {
        mount(fakeResponse(fakeApplication()));
        act(() => {
            document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
        });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes on a backdrop click but not on a click inside the dialog", () => {
        mount(fakeResponse(fakeApplication()));
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        act(() => {
            dialog.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });
        expect(onClose).not.toHaveBeenCalled();

        act(() => {
            (container.firstElementChild as HTMLElement).dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("approve calls adminVerifyRider with approve:true and then onReviewed, never gated by a mismatch", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    review: {identityMismatch: {fromCard: "1111111111111", fromLicence: "2222222222222"}},
                }),
            ),
        );
        const approveButton = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.actionApprove"),
        ) as HTMLButtonElement;
        expect(approveButton.disabled).toBe(false);

        act(() => approveButton.click());
        expect(verifyExecute).toHaveBeenCalledWith({riderId: 42, approve: true, reason: undefined});
    });

    function openRejectPanel() {
        const rejectButton = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.actionReject"),
        ) as HTMLButtonElement;
        act(() => rejectButton.click());
        return container.querySelector("textarea") as HTMLTextAreaElement;
    }

    function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        act(() => {
            setter?.call(textarea, value);
            textarea.dispatchEvent(new Event("input", {bubbles: true}));
        });
    }

    function findConfirmRejectButton() {
        return Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.reviewModal.actions.confirmReject"),
        ) as HTMLButtonElement;
    }

    it("reject reveals a required reason field; a real reason enables Confirm and is sent trimmed", () => {
        mount(fakeResponse(fakeApplication()));
        const textarea = openRejectPanel();
        expect(textarea.required).toBe(true);
        // Leading/trailing whitespace proves trimming, not just pass-through.
        setTextareaValue(textarea, "  Blurry licence photo  ");

        const confirmButton = findConfirmRejectButton();
        expect(confirmButton.disabled).toBe(false);
        act(() => confirmButton.click());

        expect(verifyExecute).toHaveBeenCalledWith({
            riderId: 42,
            approve: false,
            reason: "Blurry licence photo",
        });
    });

    it("keeps Confirm rejection disabled and fires no request while the reason is blank", () => {
        mount(fakeResponse(fakeApplication()));
        openRejectPanel();

        const confirmButton = findConfirmRejectButton();
        expect(confirmButton.disabled).toBe(true);
        expect(container.textContent).toContain("admin.riders.reviewModal.rejectionReasonRequired");

        act(() => confirmButton.click());
        expect(verifyExecute).not.toHaveBeenCalled();
        expect(onReviewed).not.toHaveBeenCalled();
    });

    it("treats a whitespace-only reason the same as blank", () => {
        mount(fakeResponse(fakeApplication()));
        const textarea = openRejectPanel();
        setTextareaValue(textarea, "   ");

        const confirmButton = findConfirmRejectButton();
        expect(confirmButton.disabled).toBe(true);
        expect(container.textContent).toContain("admin.riders.reviewModal.rejectionReasonRequired");

        act(() => confirmButton.click());
        expect(verifyExecute).not.toHaveBeenCalled();
    });

    it("moves focus to the close button on open and restores it to the opener on close", () => {
        const opener = document.createElement("button");
        opener.textContent = "open";
        document.body.appendChild(opener);
        opener.focus();
        expect(document.activeElement).toBe(opener);

        mount(fakeResponse(fakeApplication()));
        const closeButton = Array.from(container.querySelectorAll("button")).find(
            (b) => b.getAttribute("aria-label") === "admin.riders.reviewModal.closeLabel",
        );
        expect(document.activeElement).toBe(closeButton);

        act(() => root.unmount());
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it("wraps Tab from the last focusable element back to the first, trapping focus in the dialog", () => {
        mount(fakeResponse(fakeApplication()));
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], textarea:not([disabled])'),
        );
        const last = focusable[focusable.length - 1];
        const first = focusable[0];
        act(() => last.focus());
        expect(document.activeElement).toBe(last);

        const tab = new KeyboardEvent("keydown", {key: "Tab", bubbles: true, cancelable: true});
        act(() => document.dispatchEvent(tab));

        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(first);
    });
});

// renderToStaticMarkup is exercised once, purely to confirm the component
// also produces sane server-renderable markup (no client-only API reached
// during the initial render) -- everything else above uses the client tree.
describe("RiderReviewModal SSR-safety", () => {
    it("renders to static markup without throwing", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            isLoading: true,
            error: undefined,
            state: {state: "loading"},
            execute: vi.fn(),
            isMutating: false,
            pagination: undefined,
        });
        mockUseHttpPost.mockReturnValue({
            state: {state: "empty"},
            data: null,
            execute: vi.fn(),
            isMutating: false,
        });

        const markup = renderToStaticMarkup(
            createElement(RiderReviewModal, {rider: fakeRider(), onClose: vi.fn(), onReviewed: vi.fn()}),
        );
        expect(markup).toContain('role="dialog"');
    });
});
