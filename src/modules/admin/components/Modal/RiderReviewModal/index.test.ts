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
import type {GetRiderResponse, Rider, RiderApplicationView} from "108heros-client";
import {ApiRequestError} from "108heros-client";
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

import {toast} from "sonner";
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
// Same reasoning as the two casts above -- `toast.error` is the mocked
// `vi.fn()` from the factory at runtime, typed here as the real sonner
// export's function signature unless cast.
const mockToastError = toast.error as unknown as ReturnType<typeof vi.fn>;

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
    "idCard",
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

    it("has all 7 RiderDocumentKind keys, and only those, under documents.kinds", () => {
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

    it("added statusRejected, errorOccurred and fetchError to all 3 locales", () => {
        for (const tree of [en, th, viTranslation]) {
            expect(tree.translation.admin.riders.statusRejected.length).toBeGreaterThan(0);
            expect(tree.translation.admin.riders.errorOccurred.length).toBeGreaterThan(0);
            // usePaginatedRiders.ts reads this one -- it resolved to no key
            // in any locale until now, so a failed fetch rendered the
            // literal string "admin.riders.fetchError" instead of a message.
            expect(tree.translation.admin.riders.fetchError.length).toBeGreaterThan(0);
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
        "admin.riders.statusPending",
        "admin.riders.statusRejected",
        "admin.riders.statusVerified",
        "admin.riders.unknown",
        "admin.riders.reviewModal.actions.cancelReject",
        "admin.riders.reviewModal.actions.confirmReject",
        "admin.riders.reviewModal.alreadyDecided",
        "admin.riders.reviewModal.applicationUnavailable",
        "admin.riders.reviewModal.closeLabel",
        "admin.riders.reviewModal.documents.notSubmitted",
        "admin.riders.reviewModal.documents.openFailed",
        "admin.riders.reviewModal.documents.openInNewTab",
        "admin.riders.reviewModal.documents.title",
        "admin.riders.reviewModal.fieldEmpty",
        "admin.riders.reviewModal.loadError.retry",
        "admin.riders.reviewModal.loadError.retrying",
        "admin.riders.reviewModal.loadError.title",
        "admin.riders.reviewModal.mismatch.description",
        "admin.riders.reviewModal.mismatch.fromCard",
        "admin.riders.reviewModal.mismatch.fromLicence",
        "admin.riders.reviewModal.mismatch.title",
        "admin.riders.reviewModal.previousRejectionLabel",
        "admin.riders.reviewModal.reject.errors.reasonRequired",
        "admin.riders.reviewModal.reject.hint",
        "admin.riders.reviewModal.reject.markFailed",
        "admin.riders.reviewModal.reject.markFailedLabel",
        "admin.riders.reviewModal.reject.otherIssueMark",
        "admin.riders.reviewModal.reject.otherIssuePlaceholder",
        "admin.riders.reviewModal.reject.otherIssueReasonLabel",
        "admin.riders.reviewModal.reject.otherIssueTitle",
        "admin.riders.reviewModal.reject.reasonForDocument",
        "admin.riders.reviewModal.reject.reasonPlaceholder",
        "admin.riders.reviewModal.reject.rejectWithCount",
        "admin.riders.reviewModal.reject.summaryTitle",
        "admin.riders.reviewModal.rejectionReasonLabel",
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
        decision: {status: "Pending", issues: []},
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

    it("keeps the review dialog in the static light admin style", () => {
        mount(fakeResponse(fakeApplication()));

        const utilityClasses = Array.from(container.querySelectorAll<HTMLElement>("[class]"))
            .flatMap((element) => (element.getAttribute("class") ?? "").split(/\s+/));

        expect(utilityClasses.filter((className) => className.startsWith("dark:"))).toEqual([]);
        expect(
            utilityClasses.filter((className) =>
                className !== "transition-none"
                && (
                    className.startsWith("animate-")
                    || className.startsWith("transition")
                    || className.startsWith("duration-")
                ),
            ),
        ).toEqual([]);
    });

    it("shows the unavailable state when the response carries no application", () => {
        mount(fakeResponse(undefined));
        expect(container.textContent).toContain("admin.riders.reviewModal.applicationUnavailable");
        // Nothing to approve/reject without an application.
        expect(container.textContent).not.toContain("admin.riders.actionApprove");
    });

    it("shows a retry affordance -- not the absent-application copy -- when the fetch itself failed, and still hides the footer", () => {
        const retryFetch = vi.fn();
        mockUseHttpGet.mockReturnValue({
            state: {state: "failed", err: {message: "boom"}},
            data: null,
            error: undefined,
            isLoading: false,
            execute: retryFetch,
            isMutating: false,
            pagination: undefined,
        });
        act(() => {
            root.render(createElement(RiderReviewModal, {rider: fakeRider(), onClose, onReviewed}));
        });

        expect(container.textContent).toContain("admin.riders.reviewModal.loadError.title");
        // A transient fetch failure is not the same message as a genuinely
        // absent application, and must not be conflated with it.
        expect(container.textContent).not.toContain("admin.riders.reviewModal.applicationUnavailable");
        // Nothing to approve/reject without a successfully-fetched application.
        expect(container.textContent).not.toContain("admin.riders.actionApprove");

        const retryButton = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.reviewModal.loadError.retry"),
        ) as HTMLButtonElement;
        act(() => retryButton.click());
        expect(retryFetch).toHaveBeenCalledOnce();
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

    // #91: the header banner on an already-rejected application read only
    // `rejectionReason` -- `issues[0]`'s reason, derived server-side and kept
    // only for a shipped client that never learned about `issues` -- instead
    // of the full list. `rejectionReason` here deliberately equals
    // `issues[0].reason`, exactly as a real server derives it, so the only
    // thing that can distinguish "renders issues" from "renders
    // rejectionReason" is whether the SECOND issue shows up anywhere. A test
    // that only checked the first reason would pass unchanged against the
    // old code -- see the two-rows test above this one in spirit.
    it("shows every issue's own reason on an already-rejected application, not just the first", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    decision: {
                        status: "Rejected",
                        rejectionReason: "ID card photo is blurry",
                        issues: [
                            {document: "idCard", reason: "ID card photo is blurry"},
                            {document: "face", reason: "Face photo too dark"},
                        ],
                    },
                }),
            ),
        );
        expect(container.textContent).toContain("ID card photo is blurry");
        expect(container.textContent).toContain("Face photo too dark");
    });

    it("falls back to the derived rejectionReason when issues is empty, so an older backend still renders something", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    decision: {
                        status: "Rejected",
                        rejectionReason: "Blurry licence photo",
                        issues: [],
                    },
                }),
            ),
        );
        expect(container.textContent).toContain("Blurry licence photo");
    });

    // #92: the identical defect as #91, one banner over. After a resubmission
    // puts the application back to Pending, the previous-rejection banner
    // read only `previousReview.reason` instead of `previousReview.issues`.
    // Same proof shape as the #91 test above: `reason` is deliberately set
    // equal to `issues[0]`'s reason, exactly as the server derives it, so
    // only actually rendering the second issue can pass this. `status` is
    // "Pending" (a real resubmission) rather than "Rejected", so this
    // exercises the previousReview banner alone, not #91's sibling.
    it("shows every issue from the previous rejection, not just the first, after a resubmission", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    decision: {
                        status: "Pending",
                        issues: [],
                        previousReview: {
                            reason: "ID card photo is blurry",
                            issues: [
                                {document: "idCard", reason: "ID card photo is blurry"},
                                {document: "face", reason: "Face photo too dark"},
                            ],
                        },
                    },
                }),
            ),
        );
        expect(container.textContent).toContain("ID card photo is blurry");
        expect(container.textContent).toContain("Face photo too dark");
    });

    it("falls back to the previous review's derived reason when its issues is empty", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    decision: {
                        status: "Pending",
                        issues: [],
                        previousReview: {
                            reason: "Blurry licence photo",
                            issues: [],
                        },
                    },
                }),
            ),
        );
        expect(container.textContent).toContain("Blurry licence photo");
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

    it("renders idCard as its own tile, proxied the same way as the other six", () => {
        mount(
            fakeResponse(
                fakeApplication({documents: [{kind: "idCard", uploadedAt: "2026-01-01T00:00:00Z"}]}),
            ),
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/api/rider-documents/42/idCard");
        expect(img?.getAttribute("alt")).toBe("admin.riders.reviewModal.documents.kinds.idCard");
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

    it("gives the dialog an accessible name via aria-labelledby pointing at the visible heading", () => {
        mount(fakeResponse(fakeApplication()));
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        const labelledBy = dialog.getAttribute("aria-labelledby");
        expect(labelledBy).toBeTruthy();
        const heading = container.querySelector(`#${labelledBy}`);
        expect(heading?.tagName).toBe("H2");
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

    // F1: opening an already-decided rider from the new Approved/Rejected
    // tabs must not offer controls whose only possible outcome is the 409
    // below. The status read-back (StatusBadge always; RejectionIssuesBanner
    // for Rejected) stays -- only the live buttons and the reject panel go.
    it("hides the approve/reject footer once the application is already Verified, showing only the read-back", () => {
        mount(fakeResponse(fakeApplication({decision: {status: "Verified", issues: []}})));
        expect(container.textContent).not.toContain("admin.riders.actionApprove");
        expect(container.textContent).not.toContain("admin.riders.actionReject");
    });

    it("hides the approve/reject footer for a Rejected application too, not only Verified", () => {
        mount(
            fakeResponse(
                fakeApplication({
                    decision: {status: "Rejected", rejectionReason: "Blurry licence photo", issues: []},
                }),
            ),
        );
        expect(container.textContent).not.toContain("admin.riders.actionApprove");
        expect(container.textContent).not.toContain("admin.riders.actionReject");
    });

    // The footer's Reject button, which changes its own label once anything
    // is marked ("Reject" -> "Reject (2)"), so it is matched on either.
    function findRejectButton() {
        return Array.from(container.querySelectorAll("button")).find(
            (b) =>
                b.textContent?.includes("admin.riders.actionReject") ||
                b.textContent?.includes("admin.riders.reviewModal.reject.rejectWithCount"),
        ) as HTMLButtonElement;
    }

    function openRejectPanel() {
        act(() => findRejectButton().click());
    }

    // Marking happens up in the tile grid now, one checkbox per document
    // kind -- queried by the id the tile derives from its own kind, which is
    // what makes "the reason went to the document it was typed under"
    // assertable at all.
    function markDocument(kind: string) {
        const checkbox = container.querySelector(`#rider-document-failed-${kind}`) as HTMLInputElement;
        act(() => checkbox.click());
    }

    function documentReasonBox(kind: string) {
        return container.querySelector(`#rider-document-reason-${kind}`) as HTMLTextAreaElement | null;
    }

    function markOtherIssue() {
        const checkbox = container.querySelector("#rider-reject-other") as HTMLInputElement;
        act(() => checkbox.click());
    }

    function otherReasonBox() {
        return container.querySelector("#rider-reject-other-reason") as HTMLTextAreaElement | null;
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

    it("a reason box appears under the document that was marked, and under no other", () => {
        mount(fakeResponse(fakeApplication()));
        // Every kind offers a tick, including one the rider never submitted:
        // "you have not sent this" is a rejection reason like any other.
        expect(container.querySelectorAll('input[type="checkbox"][id^="rider-document-failed-"]')).toHaveLength(7);
        expect(documentReasonBox("licence")).toBeNull();

        markDocument("licence");

        expect(documentReasonBox("licence")).not.toBeNull();
        expect(documentReasonBox("licence")?.required).toBe(true);
        expect(documentReasonBox("face")).toBeNull();
        expect(documentReasonBox("idCard")).toBeNull();
    });

    it("a document's reason is sent against that document, trimmed", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");
        // Leading/trailing whitespace proves trimming, not just pass-through.
        setTextareaValue(documentReasonBox("licence")!, "  Blurry licence photo  ");

        openRejectPanel();
        const confirmButton = findConfirmRejectButton();
        expect(confirmButton.disabled).toBe(false);
        act(() => confirmButton.click());

        expect(verifyExecute).toHaveBeenCalledWith({
            riderId: 42,
            approve: false,
            issues: [{document: "licence", reason: "Blurry licence photo"}],
        });
    });

    it("two marked documents send two issues in tile order, whatever order the admin ticked them in", () => {
        mount(fakeResponse(fakeApplication()));
        // Marked last-tile-first on purpose: insertion order would send
        // these the other way round, and both orders look identical in the
        // UI. `face` is the sixth tile, `licence` the second.
        markDocument("face");
        setTextareaValue(documentReasonBox("face")!, "Face photo too dark");
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");

        openRejectPanel();
        act(() => findConfirmRejectButton().click());

        expect(verifyExecute).toHaveBeenCalledWith({
            riderId: 42,
            approve: false,
            issues: [
                {document: "licence", reason: "Blurry licence photo"},
                {document: "face", reason: "Face photo too dark"},
            ],
        });
    });

    it("the non-document problem sends an explicit document: null, and comes after the documents", () => {
        mount(fakeResponse(fakeApplication()));
        markOtherIssue();
        setTextareaValue(otherReasonBox()!, "The vehicle is older than the policy allows");
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");

        openRejectPanel();
        act(() => findConfirmRejectButton().click());

        // `document: null` is a real key, not an omitted one:
        // `toHaveBeenCalledWith`'s deep-equal ignores an `undefined`
        // property but NOT `null` (verified separately -- `expect({})
        // .toEqual({a: null})` fails in this project's vitest), so this
        // would not match a payload whose issue left `document` out.
        expect(verifyExecute).toHaveBeenCalledWith({
            riderId: 42,
            approve: false,
            issues: [
                {document: "licence", reason: "Blurry licence photo"},
                {document: null, reason: "The vehicle is older than the policy allows"},
            ],
        });
    });

    it("unticking a document takes its reason with it, and leaves nothing to reject", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");

        markDocument("licence"); // untick
        expect(documentReasonBox("licence")).toBeNull();

        markDocument("licence"); // and back again
        expect(documentReasonBox("licence")?.value).toBe("");
        expect(findRejectButton().disabled).toBe(true);
    });

    it("with nothing marked, Reject is disabled and says what to do rather than showing an error", () => {
        mount(fakeResponse(fakeApplication()));

        expect(findRejectButton().disabled).toBe(true);
        // An untouched form is not a wrong one: the instruction is offered,
        // the red error is not (F7).
        expect(container.textContent).toContain("admin.riders.reviewModal.reject.hint");
        expect(container.textContent).not.toContain("admin.riders.reviewModal.reject.errors.reasonRequired");

        act(() => findRejectButton().click());
        expect(container.textContent).not.toContain("admin.riders.reviewModal.actions.confirmReject");
        expect(verifyExecute).not.toHaveBeenCalled();
    });

    it("a marked document with a blank reason keeps Reject disabled and says why", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");

        expect(findRejectButton().disabled).toBe(true);
        expect(container.textContent).toContain("admin.riders.reviewModal.reject.errors.reasonRequired");

        // Whitespace is not a reason either.
        setTextareaValue(documentReasonBox("licence")!, "   ");
        expect(findRejectButton().disabled).toBe(true);
        expect(container.textContent).toContain("admin.riders.reviewModal.reject.errors.reasonRequired");

        act(() => findRejectButton().click());
        expect(verifyExecute).not.toHaveBeenCalled();
    });

    it("a raised non-document problem with no text blocks the rejection the same way a marked document does", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");
        expect(findRejectButton().disabled).toBe(false);

        // Ticking "there's another problem" and saying nothing must not ride
        // in on the valid document issue -- `""` and "not raised at all" are
        // deliberately different states.
        markOtherIssue();
        expect(findRejectButton().disabled).toBe(true);
    });

    it("the confirmation step reads back every problem before it is sent", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");
        markDocument("face");
        setTextareaValue(documentReasonBox("face")!, "Face photo too dark");

        openRejectPanel();

        expect(container.textContent).toContain("admin.riders.reviewModal.reject.summaryTitle");
        expect(container.textContent).toContain("Blurry licence photo");
        expect(container.textContent).toContain("Face photo too dark");
        expect(verifyExecute).not.toHaveBeenCalled();
    });

    it("cancelling the confirmation keeps every mark, so a second look costs no retyping", () => {
        mount(fakeResponse(fakeApplication()));
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");
        openRejectPanel();

        const cancelButton = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.reviewModal.actions.cancelReject"),
        ) as HTMLButtonElement;
        act(() => cancelButton.click());

        expect(documentReasonBox("licence")?.value).toBe("Blurry licence photo");
        expect(findRejectButton().disabled).toBe(false);
    });

    it("a mocked 409 surfaces the already-decided message and refetches, instead of a generic failure", async () => {
        const refetch = vi.fn();
        mockUseHttpGet.mockReturnValue({
            state: {state: "success", data: fakeResponse(fakeApplication())},
            data: fakeResponse(fakeApplication()),
            error: undefined,
            isLoading: false,
            execute: refetch,
            isMutating: false,
            pagination: undefined,
        });
        act(() => {
            root.render(createElement(RiderReviewModal, {rider: fakeRider(), onClose, onReviewed}));
        });

        // verifyExecute's inferred type comes from its default `async () =>
        // ({state: "success", data: {ok: true}})` implementation above,
        // which has no `err` field -- same cast reasoning as
        // mockUseHttpGet/mockUseHttpPost/mockToastError up top, applied
        // locally since verifyExecute itself is declared per-describe-block.
        //
        // err is a real ApiRequestError, not a plain {error: ...} literal.
        // That is the shape the client actually throws
        // (src/lib/108heros-client/src/http.ts:1895's `new ApiRequestError(
        // json.error ?? ..., json.message)`, whose constructor sets
        // `this.name` -- there is no `.error` property on the thrown
        // object). A plain-object mock with an `.error` key would exercise
        // `res.err.error ?? res.err.name`'s left side, which production
        // never takes (F3).
        (verifyExecute as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            state: "failed",
            err: new ApiRequestError("riderDecisionAlreadyMade"),
        });
        markDocument("licence");
        setTextareaValue(documentReasonBox("licence")!, "Blurry licence photo");
        openRejectPanel();

        // handleDecision awaits verifyRider() before acting on the result;
        // flush that pending microtask (and any it schedules in turn) before
        // asserting on what happens after it resolves.
        await act(async () => {
            findConfirmRejectButton().click();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(mockToastError).toHaveBeenCalledWith("admin.riders.reviewModal.alreadyDecided");
        expect(refetch).toHaveBeenCalledOnce();
        expect(onReviewed).not.toHaveBeenCalled();
        // Every mark is cleared rather than left standing under the refetch:
        // they described an application state that no longer exists.
        expect(container.querySelector("textarea")).toBeNull();
        expect((container.querySelector("#rider-document-failed-licence") as HTMLInputElement).checked).toBe(false);
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
