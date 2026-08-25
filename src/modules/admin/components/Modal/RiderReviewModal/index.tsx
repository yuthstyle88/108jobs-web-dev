"use client";

import {useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import {
    X,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Loader2,
    FileText,
    ImageOff,
    ExternalLink,
    ShieldCheck,
    ShieldAlert,
    ShieldQuestion,
} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Textarea} from "@/components/ui/Textarea";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {isFailed, isSuccess} from "@/services/HttpService";
import {cn} from "@/lib/utils";
import {
    Rider,
    RiderId,
    RiderApplicationFields,
    RiderDocumentKind,
    RiderDocumentSlot,
    RiderRejectionIssue,
    RiderReviewDetail,
    RiderVerificationStatus,
    IdentityMismatch,
} from "108heros-client";

interface RiderReviewModalProps {
    rider: Rider;
    onClose: () => void;
    /** Called after a successful approve/reject so the page can close and refetch. */
    onReviewed: () => void;
}

// Matches the focus-trap pattern already proven in HowToHireModal (same
// selector, same recompute-on-every-Tab approach so it stays correct as
// content loads in) -- there is no extracted shared hook for this yet, so
// per review guidance this stays small and local rather than pulling one
// out or reaching for a dependency.
const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

type FieldKey = keyof RiderApplicationFields;

interface FieldGroupDef {
    titleKey: string;
    keys: FieldKey[];
}

/**
 * Mirrors the section comments on `RiderApplicationFields` (108heros-client)
 * field-for-field and in the same order, so a reviewer can cross-check this
 * against that file directly.
 */
const FIELD_GROUPS: FieldGroupDef[] = [
    {
        titleKey: "admin.riders.reviewModal.sections.identity",
        keys: ["nationalIdNumber", "idCardAddress", "fatherFullName", "motherFullName", "dateOfBirth"],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.licence",
        keys: ["licenseNumber", "licenseExpiryDate", "licenseType", "licenseIssuedOn", "licenseIssuedAt"],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.vehicle",
        keys: [
            "vehicleRegistrationType",
            "engineDisplacementCc",
            "vehicleFirstRegisteredOn",
            "vehicleTitleHolderName",
            "vehicleTitleHolderIdNumber",
            "vehiclePossessorName",
            "vehiclePossessorIdNumber",
        ],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.insurance",
        keys: [
            "insurancePolicyNumber",
            "insuranceExpiresOn",
            "compulsoryInsurancePolicyNumber",
            "compulsoryInsuranceExpiresOn",
        ],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.payment",
        keys: ["bankAccountName", "bankAccountNumber", "bankName"],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.emergencyContact",
        keys: [
            "emergencyContactName",
            "emergencyContactRelationship",
            "emergencyContactPhone",
            "emergencyContactAddress",
        ],
    },
    {
        titleKey: "admin.riders.reviewModal.sections.consent",
        keys: [
            "faceConsentGrantedAt",
            "faceConsentVersion",
            "faceConsentWithdrawnAt",
            "emergencyContactConsentedAt",
            "criminalRecordConsentedAt",
            "criminalDeclarationAcceptedAt",
        ],
    },
];

// Guarded the same way
// src/app/api/rider-documents/[riderId]/[documentKind]/route.ts:15-23 guards
// its own copy of this same union: `satisfies Record<RiderDocumentKind,
// true>` makes an eighth kind added to the union without a matching key here
// a compile error at this object, rather than a kind that silently drops out
// of the tile grid and the reject-panel <select> the way a hand-maintained
// array would let it (F4).
const DOCUMENT_KIND_RECORD = {
    idCard: true,
    licence: true,
    vehicleRegistration: true,
    insurance: true,
    compulsoryInsurance: true,
    face: true,
    bankBook: true,
} satisfies Record<RiderDocumentKind, true>;

const DOCUMENT_KINDS: readonly RiderDocumentKind[] = Object.keys(DOCUMENT_KIND_RECORD) as RiderDocumentKind[];

/**
 * Which documents the admin has marked as not passing, and why. A key is
 * present exactly when that document's tile is ticked, so the tick and its
 * reason are one fact rather than two that can drift: untick and the reason
 * goes with it, and there is no way to hold a reason for a document nobody
 * marked.
 *
 * Replaces the add-a-row-and-pick-a-document repeater this panel shipped
 * with (#93). The admin was made to remember which of seven documents they
 * had already named, and the same document could be named twice -- both
 * gone by construction now that the reason lives under the document it is
 * about (owner's ruling, 2026-08-21).
 */
type DocumentIssues = Partial<Record<RiderDocumentKind, string>>;

function formatFieldValue(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
}

export function RiderReviewModal({rider, onClose, onReviewed}: RiderReviewModalProps) {
    const {t} = useTranslation();
    // The confirmation step, not the marking step: the admin marks documents
    // as they read them, up in the tile grid, and this is only the read-back
    // of what they are about to send.
    const [isRejecting, setIsRejecting] = useState(false);
    const [documentIssues, setDocumentIssues] = useState<DocumentIssues>({});
    // `null` when the admin has raised no non-document problem at all, and a
    // string once they have -- including `""`, which is a raised-but-not-yet-
    // explained one and blocks Confirm. Collapsing the two into `""` would
    // make "I have nothing to add" and "I have something to add and haven't
    // said what" the same state.
    const [otherIssueReason, setOtherIssueReason] = useState<string | null>(null);

    const {
        data,
        state: applicationState,
        isLoading,
        execute: retryApplicationFetch,
        isMutating: retryingApplication,
    } = useHttpGet("getRiderApplication", [rider.id]);
    const {execute: verifyRider, isMutating: verifying} = useHttpPost("adminVerifyRider");

    const clearIssues = () => {
        setDocumentIssues({});
        setOtherIssueReason(null);
    };

    const toggleDocumentIssue = (kind: RiderDocumentKind) => {
        setDocumentIssues((current) => {
            if (!(kind in current)) return {...current, [kind]: ""};
            // Unticking discards the reason with it, deliberately: a reason
            // for a document the admin has decided is fine has nowhere to go,
            // and keeping it would let a stale sentence reappear if they
            // ticked the same tile again later. Written as copy-then-delete
            // rather than a rest-destructure, whose discarded binding this
            // project's no-unused-vars has no underscore exemption for.
            const remaining = {...current};
            delete remaining[kind];
            return remaining;
        });
    };

    const setDocumentIssueReason = (kind: RiderDocumentKind, reason: string) => {
        // Guarded on the tick rather than writing blind: a reason can only
        // exist for a marked document, which is what makes `documentIssues`
        // a single source of truth for both facts.
        setDocumentIssues((current) => (kind in current ? {...current, [kind]: reason} : current));
    };

    const toggleOtherIssue = () => setOtherIssueReason((reason) => (reason === null ? "" : null));

    // Built in DOCUMENT_KINDS order rather than the order the admin happened
    // to tick them in, so what the rider is told reads in the same order as
    // the tiles above -- and the non-document problem comes last, after the
    // documents it isn't about.
    const pendingIssues: RiderRejectionIssue[] = [
        ...DOCUMENT_KINDS.filter((kind) => kind in documentIssues).map((kind) => ({
            document: kind,
            reason: documentIssues[kind] ?? "",
        })),
        ...(otherIssueReason === null ? [] : [{document: null, reason: otherIssueReason}]),
    ];

    // Mirrors crud/update.rs's own validation, so a rejection either fails
    // fast client-side or not at all. Its third rule -- no document named
    // twice -- has no check here because a tick per tile cannot express it.
    const hasNoIssues = pendingIssues.length === 0;
    const hasBlankReason = pendingIssues.some((issue) => issue.reason.trim() === "");
    const canConfirmReject = !hasNoIssues && !hasBlankReason;

    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // Move focus into the dialog on open, and restore it to whatever had
    // focus before (the row's Eye button) on close. This modal shows a
    // national ID card, a bank book and a face photograph -- worth doing
    // properly even though the component it's patterned on, UserDetailModal,
    // has never done this.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();
        return () => {
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, []);

    // Escape closes; Tab (and Shift+Tab) is trapped inside the dialog. The
    // focusable set is recomputed on every keypress rather than cached, so
    // it stays correct as the fetch resolves and the document tiles /
    // approve-reject controls appear.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key !== "Tab") return;

            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusable = getFocusable(dialog);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const outsideDialog = !active || !dialog.contains(active);
            const shouldWrap = e.shiftKey ? outsideDialog || active === first : outsideDialog || active === last;

            if (shouldWrap) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Absent for a stranger, who receives only `rider_view` -- narrowed once,
    // here, rather than asserted past. See GetRiderResponse's own comment.
    const application = data?.application;
    const person = data?.rider_view?.person;
    const status: RiderVerificationStatus = application?.decision.status ?? rider.verificationStatus;
    // A failed fetch and a genuinely absent application both leave `data`
    // (and so `application`) null/undefined -- `state` is the only thing
    // that tells them apart. Checked separately so the content area below
    // can offer a retry for one and "not available" for the other, instead
    // of showing an admin the same dead end for a transient 500 as for a
    // rider who really has no application on file.
    const applicationFetchFailed = isFailed(applicationState);

    const handleDecision = async (approve: boolean) => {
        // Reject is only reachable once every rule mirrored above passes --
        // Confirm is disabled otherwise (see the footer below) -- so this
        // sends `issues` straight through. `reason`/`rejectedDocument` are
        // the deprecated single-issue form and are never sent by this UI.
        // Approval ignores issues entirely, matching the backend, which
        // stores nothing for it either.
        const res = approve
            ? await verifyRider({riderId: rider.id, approve: true})
            : await verifyRider({
                  riderId: rider.id,
                  approve: false,
                  issues: pendingIssues.map(({document, reason}) => ({document, reason: reason.trim()})),
              });
        if (isSuccess(res)) {
            toast.success(approve ? t("admin.riders.actionApproved") : t("admin.riders.actionRejected"));
            onReviewed();
        } else if (isFailed(res)) {
            // 409: the world moved between this admin opening the modal and
            // clicking Approve/Reject -- most realistically two admins had
            // the same rider open and the other one decided first. Say so
            // and pull the current state, rather than a generic failure the
            // admin would only retry back into the same conflict.
            const errorCode = res.err.error ?? res.err.name;
            if (errorCode === "riderDecisionAlreadyMade") {
                toast.error(t("admin.riders.reviewModal.alreadyDecided"));
                setIsRejecting(false);
                clearIssues();
                retryApplicationFetch();
            } else {
                toast.error(t("admin.riders.errorOccurred"));
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rider-review-modal-title"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-11 w-11 shrink-0">
                            <AvatarImage src={person?.avatar}/>
                            <AvatarFallback className="text-xs font-medium">
                                {(person?.name || person?.displayName || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <h2 id="rider-review-modal-title" className="text-lg font-semibold truncate">
                                {person?.name || person?.displayName || t("admin.riders.unknown")}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                                <span>{t("admin.riders.id")}: {rider.id}</span>
                                <StatusBadge status={status}/>
                            </div>
                            {application?.decision.status === "Rejected" && (
                                <RejectionIssuesBanner
                                    labelKey="admin.riders.reviewModal.rejectionReasonLabel"
                                    issues={application.decision.issues}
                                    fallbackReason={application.decision.rejectionReason}
                                />
                            )}
                            {application?.decision.previousReview && (
                                <RejectionIssuesBanner
                                    labelKey="admin.riders.reviewModal.previousRejectionLabel"
                                    issues={application.decision.previousReview.issues}
                                    fallbackReason={application.decision.previousReview.reason}
                                />
                            )}
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-muted transition-none shrink-0"
                        aria-label={t("admin.riders.reviewModal.closeLabel")}
                    >
                        <X className="w-5 h-5 text-muted-foreground"/>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading && !data ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-8 h-8 text-muted-foreground"/>
                        </div>
                    ) : applicationFetchFailed ? (
                        <div className="flex flex-col items-center gap-3 rounded-lg bg-gray-50 p-6 text-sm text-gray-500 text-center">
                            <AlertTriangle className="w-6 h-6 text-destructive shrink-0"/>
                            <p>{t("admin.riders.reviewModal.loadError.title")}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryApplicationFetch()}
                                disabled={retryingApplication}
                                className="transition-none"
                            >
                                {retryingApplication && <Loader2 className="w-4 h-4 mr-2"/>}
                                {retryingApplication
                                    ? t("admin.riders.reviewModal.loadError.retrying")
                                    : t("admin.riders.reviewModal.loadError.retry")}
                            </Button>
                        </div>
                    ) : !application ? (
                        <div
                            className="flex items-center gap-3 rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
                            <FileText className="w-5 h-5 shrink-0"/>
                            {t("admin.riders.reviewModal.applicationUnavailable")}
                        </div>
                    ) : (
                        <>
                            {/* 1. Identity-mismatch warning -- a discrepancy to show a human,
                                never a platform verdict, and never a gate on approval. */}
                            {application.review?.identityMismatch && (
                                <MismatchWarning mismatch={application.review.identityMismatch}/>
                            )}

                            {/* 2. Fields, grouped the way the applicant filled them. */}
                            <div className="space-y-6">
                                {FIELD_GROUPS.map((group) => (
                                    <FieldGroupSection key={group.titleKey} group={group} fields={application.fields}/>
                                ))}
                            </div>

                            {/* 3. The seven documents -- and, while the
                                application is still Pending, the place where
                                each one is marked as not passing. The reason
                                sits under the document it is about, so an
                                admin never has to hold "which of the seven
                                was blurry" in their head while scrolling to
                                a separate panel to type it (owner's ruling,
                                2026-08-21). */}
                            <DocumentsSection
                                riderId={rider.id}
                                documents={application.documents}
                                reviewable={status === "Pending"}
                                issues={documentIssues}
                                disabled={verifying}
                                onToggleIssue={toggleDocumentIssue}
                                onIssueReasonChange={setDocumentIssueReason}
                            />

                            {/* 3b. The one problem that is about no document:
                                "the vehicle is older than the policy allows",
                                "the bank account is in someone else's name".
                                Kept as a single box rather than a repeater --
                                it is the exception, and `document: null` is a
                                real value on the wire, not an unset field. */}
                            {status === "Pending" && (
                                <OtherIssueSection
                                    reason={otherIssueReason}
                                    disabled={verifying}
                                    onToggle={toggleOtherIssue}
                                    onReasonChange={setOtherIssueReason}
                                />
                            )}

                            {/* 4. Review detail -- admin only, absent for a stranger. */}
                            {application.review && <ReviewSection review={application.review}/>}
                        </>
                    )}
                </div>

                {/* 5. Approve / Reject-with-reason -- only while still
                    Pending. Re-deciding a settled application is
                    deliberately not this UI's job: revoking an approval
                    needs its own reason, audit trail and handling for work
                    already in progress, so it isn't folded into "reject".
                    Without this gate, opening an Approved or Rejected rider
                    (the two new tabs Task 9 added) showed live controls
                    whose only possible outcome was the 409 below (see F1). */}
                {application && status === "Pending" && (
                    <div className="border-t border-gray-200 p-6 shrink-0">
                        {isRejecting ? (
                            <div className="space-y-4">
                                <RejectSummary issues={pendingIssues}/>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        variant="destructive"
                                        className="flex-1 transition-none"
                                        onClick={() => handleDecision(false)}
                                        disabled={verifying || !canConfirmReject}
                                    >
                                        {verifying && <Loader2 className="w-4 h-4 mr-2"/>}
                                        {t("admin.riders.reviewModal.actions.confirmReject")}
                                    </Button>
                                    {/* Back to marking, keeping every tick and
                                        every sentence typed so far -- this is
                                        "let me look again", not "start over". */}
                                    <Button
                                        variant="outline"
                                        className="flex-1 transition-none"
                                        onClick={() => setIsRejecting(false)}
                                        disabled={verifying}
                                    >
                                        {t("admin.riders.reviewModal.actions.cancelReject")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-none"
                                        onClick={() => handleDecision(true)}
                                        disabled={verifying}
                                    >
                                        {verifying ? (
                                            <Loader2 className="w-4 h-4 mr-2"/>
                                        ) : (
                                            <CheckCircle className="w-4 h-4 mr-2"/>
                                        )}
                                        {t("admin.riders.actionApprove")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 transition-none"
                                        onClick={() => setIsRejecting(true)}
                                        disabled={verifying || !canConfirmReject}
                                    >
                                        {hasNoIssues
                                            ? t("admin.riders.actionReject")
                                            : t("admin.riders.reviewModal.reject.rejectWithCount", {
                                                  count: pendingIssues.length,
                                              })}
                                    </Button>
                                </div>
                                {/* Why Reject is disabled, said before the
                                    admin clicks it. The empty case is an
                                    instruction and stays grey -- nothing is
                                    wrong yet, they simply have not marked
                                    anything. A marked document with no reason
                                    IS wrong, and is red. */}
                                {hasNoIssues ? (
                                    <p className="text-xs text-gray-500">
                                        {t("admin.riders.reviewModal.reject.hint")}
                                    </p>
                                ) : (
                                    hasBlankReason && (
                                        <p className="text-xs text-red-500">
                                            {t("admin.riders.reviewModal.reject.errors.reasonRequired")}
                                        </p>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({status}: {status: RiderVerificationStatus}) {
    const {t} = useTranslation();
    if (status === "Verified") {
        return (
            <Badge className="text-xs px-2.5 py-0.5 transition-none">
                <CheckCircle className="w-3.5 h-3.5 mr-1"/>
                {t("admin.riders.statusVerified")}
            </Badge>
        );
    }
    if (status === "Rejected") {
        return (
            <Badge variant="destructive" className="text-xs px-2.5 py-0.5 transition-none">
                <XCircle className="w-3.5 h-3.5 mr-1"/>
                {t("admin.riders.statusRejected")}
            </Badge>
        );
    }
    return (
        <Badge variant="secondary" className="text-xs px-2.5 py-0.5 transition-none">
            <Loader2 className="w-3.5 h-3.5 mr-1"/>
            {t("admin.riders.statusPending")}
        </Badge>
    );
}

/**
 * Every problem a rejection named, not just the first. Backs both header
 * banners: the current decision's (`decision.issues`/`rejectionReason`, #91)
 * and, identically, the superseded one shown after a resubmission
 * (`decision.previousReview.issues`/`reason`, #92) -- same derivation
 * (`issues[0]`, kept on the wire only so a shipped mobile client that never
 * learned about `issues` keeps working), same fix, one shared component so
 * the two can't drift back apart the way they did the first time. `issues`
 * is typed as always present on both call sites, but this still falls back
 * to `fallbackReason` when it is empty/absent, so an older backend that has
 * not shipped it yet still shows something rather than a blank banner.
 */
function RejectionIssuesBanner({
    labelKey,
    issues,
    fallbackReason,
}: {
    labelKey: string;
    issues: RiderRejectionIssue[] | null | undefined;
    fallbackReason: string | null | undefined;
}) {
    const {t} = useTranslation();
    if (issues && issues.length > 0) {
        return (
            <div className="text-xs text-gray-500 mt-1">
                <span className="font-medium">{t(labelKey)}:</span>
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                    {issues.map((issue, index) => (
                        <li key={index}>
                            {issue.document
                                ? `${t(`admin.riders.reviewModal.documents.kinds.${issue.document}`)} — ${issue.reason}`
                                : issue.reason}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
    if (!fallbackReason) return null;
    return (
        <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">{t(labelKey)}:</span>{" "}
            {fallbackReason}
        </p>
    );
}

function FieldRow({label, value}: {label: string; value: string | null}) {
    const {t} = useTranslation();
    return (
        <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p
                className={cn(
                    "text-sm break-words",
                    value ? "text-gray-900" : "text-gray-400 italic"
                )}
            >
                {value ?? t("admin.riders.reviewModal.fieldEmpty")}
            </p>
        </div>
    );
}

function FieldGroupSection({group, fields}: {group: FieldGroupDef; fields: RiderApplicationFields}) {
    const {t} = useTranslation();
    return (
        <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {t(group.titleKey)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.keys.map((key) => (
                    <FieldRow
                        key={key}
                        label={t(`admin.riders.reviewModal.fields.${key}`)}
                        value={formatFieldValue(fields[key])}
                    />
                ))}
            </div>
        </div>
    );
}

function MismatchWarning({mismatch}: {mismatch: IdentityMismatch}) {
    const {t} = useTranslation();
    return (
        <div
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-800">
                        {t("admin.riders.reviewModal.mismatch.title")}
                    </p>
                    <p className="text-sm text-amber-700">
                        {t("admin.riders.reviewModal.mismatch.description")}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                <div>
                    <p className="text-xs font-medium text-amber-700">
                        {t("admin.riders.reviewModal.mismatch.fromCard")}
                    </p>
                    <p className="text-sm font-mono text-amber-900">{mismatch.fromCard}</p>
                </div>
                <div>
                    <p className="text-xs font-medium text-amber-700">
                        {t("admin.riders.reviewModal.mismatch.fromLicence")}
                    </p>
                    <p className="text-sm font-mono text-amber-900">{mismatch.fromLicence}</p>
                </div>
            </div>
        </div>
    );
}

function DocumentsSection({
    riderId,
    documents,
    reviewable,
    issues,
    disabled,
    onToggleIssue,
    onIssueReasonChange,
}: {
    riderId: RiderId;
    documents: RiderDocumentSlot[];
    /** Marking is offered only while the application can still be decided. */
    reviewable: boolean;
    issues: DocumentIssues;
    disabled: boolean;
    onToggleIssue: (kind: RiderDocumentKind) => void;
    onIssueReasonChange: (kind: RiderDocumentKind, reason: string) => void;
}) {
    const {t} = useTranslation();
    return (
        <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {t("admin.riders.reviewModal.documents.title")}
            </h3>
            {/* Two per row on a phone, three on a desktop -- unchanged, but a
                marked tile now grows a reason box, so the row heights stop
                matching. `items-start` keeps each tile at its own height
                instead of stretching its neighbours to the tallest one. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-start">
                {DOCUMENT_KINDS.map((kind) => (
                    <DocumentTile
                        key={kind}
                        riderId={riderId}
                        kind={kind}
                        slot={documents.find((d) => d.kind === kind)}
                        reviewable={reviewable}
                        issueReason={issues[kind]}
                        disabled={disabled}
                        onToggleIssue={() => onToggleIssue(kind)}
                        onReasonChange={(reason) => onIssueReasonChange(kind, reason)}
                    />
                ))}
            </div>
        </div>
    );
}

function DocumentTile({
    riderId,
    kind,
    slot,
    reviewable,
    issueReason,
    disabled,
    onToggleIssue,
    onReasonChange,
}: {
    riderId: RiderId;
    kind: RiderDocumentKind;
    slot?: RiderDocumentSlot;
    reviewable: boolean;
    /** `undefined` when this document is not marked at all. */
    issueReason?: string;
    disabled: boolean;
    onToggleIssue: () => void;
    onReasonChange: (reason: string) => void;
}) {
    const {t} = useTranslation();
    const [failed, setFailed] = useState(false);
    // Set only once a background check confirms the proxy itself failed --
    // see the effect below. Stays false otherwise, so a legitimately
    // non-image attachment (by design, see the comment on the <img> below)
    // keeps opening exactly as it always has.
    const [openFailed, setOpenFailed] = useState(false);
    const src = `/api/rider-documents/${riderId}/${kind}`;
    const label = t(`admin.riders.reviewModal.documents.kinds.${kind}`);
    // Keyed by document kind, not by a counter: there is exactly one tile per
    // kind, and only one modal open at a time, so these stay unique without
    // any id bookkeeping to get wrong.
    const markFieldId = `rider-document-failed-${kind}`;
    const reasonFieldId = `rider-document-reason-${kind}`;

    // The <img> below already failed to decode `src` as an image -- that
    // covers both a real HTTP failure (401/403/404/502, which this proxy
    // returns as a JSON body) and a legitimately non-image attachment, and
    // a plain link can't tell those apart before the browser navigates.
    // Checked here instead, off the admin's click, so a confirmed failure
    // can drop the link entirely rather than ever letting the browser land
    // them on a bare page of raw `{"error":...}` JSON.
    useEffect(() => {
        if (!failed) return;
        let cancelled = false;
        fetch(src)
            .then((res) => {
                if (!cancelled && !res.ok) setOpenFailed(true);
            })
            .catch(() => {
                if (!cancelled) setOpenFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [failed, src]);

    const marked = issueReason !== undefined;

    return (
        <div
            className={cn(
                "rounded-xl border overflow-hidden flex flex-col",
                marked
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200 bg-gray-50",
            )}>
            <div className="aspect-square flex items-center justify-center bg-gray-100">
                {!slot ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 text-xs px-2 text-center">
                        <ImageOff className="w-6 h-6"/>
                        <span>{t("admin.riders.reviewModal.documents.notSubmitted")}</span>
                    </div>
                ) : failed && openFailed ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 text-xs px-2 text-center">
                        <FileText className="w-6 h-6"/>
                        <span>{t("admin.riders.reviewModal.documents.openFailed")}</span>
                    </div>
                ) : failed ? (
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 text-gray-500 text-xs px-2 text-center hover:text-primary transition-none"
                    >
                        <FileText className="w-6 h-6"/>
                        <span className="flex items-center gap-1">
                            {t("admin.riders.reviewModal.documents.openInNewTab")}
                            <ExternalLink className="w-3 h-3"/>
                        </span>
                    </a>
                ) : (
                    // Documents are served through a same-origin proxy that isn't
                    // always an image -- non-image kinds come back as an
                    // attachment download, by design, so a hostile SVG can't
                    // execute in this origin. That rules out next/image, whose
                    // optimizer expects to decode image bytes server-side and
                    // would error on anything else; a plain <img> just fails
                    // to render and onError below hands it a graceful fallback.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={src}
                        alt={label}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setFailed(true)}
                    />
                )}
            </div>
            <div className="p-2 text-center">
                <p className="text-xs font-medium truncate">{label}</p>
                {slot?.uploadedAt && (
                    <p className="text-[11px] text-gray-400">
                        {new Date(slot.uploadedAt).toLocaleDateString()}
                    </p>
                )}
            </div>
            {/* The tick and its reason, under the document they are about --
                offered even for a document that was never submitted, since
                "you have not sent this" is exactly the kind of problem a
                rejection needs to be able to name. */}
            {reviewable && (
                <div className="border-t border-gray-200 p-2 space-y-2">
                    <label
                        htmlFor={markFieldId}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer"
                    >
                        <input
                            id={markFieldId}
                            type="checkbox"
                            checked={marked}
                            onChange={onToggleIssue}
                            disabled={disabled}
                            // The visible word is just "Doesn't pass", seven
                            // times over; on its own it tells a screen-reader
                            // user nothing about which document they are on.
                            aria-label={t("admin.riders.reviewModal.reject.markFailedLabel", {document: label})}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        {t("admin.riders.reviewModal.reject.markFailed")}
                    </label>
                    {marked && (
                        <Textarea
                            id={reasonFieldId}
                            value={issueReason}
                            onChange={(e) => onReasonChange(e.target.value)}
                            placeholder={t("admin.riders.reviewModal.reject.reasonPlaceholder")}
                            aria-label={t("admin.riders.reviewModal.reject.reasonForDocument", {document: label})}
                            className="bg-white text-xs transition-none"
                            rows={2}
                            disabled={disabled}
                            required
                            aria-required="true"
                            aria-invalid={issueReason.trim() === ""}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * The one problem that is about no document at all. A single box, not a
 * repeater: two unrelated non-document problems in one rejection has never
 * been asked for, and `document: null` is one row on the wire either way.
 */
function OtherIssueSection({
    reason,
    disabled,
    onToggle,
    onReasonChange,
}: {
    /** `null` when the admin has not raised one. */
    reason: string | null;
    disabled: boolean;
    onToggle: () => void;
    onReasonChange: (reason: string) => void;
}) {
    const {t} = useTranslation();
    const raised = reason !== null;

    return (
        <div
            className={cn(
                "rounded-xl border p-3 space-y-2",
                raised
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200",
            )}
        >
            <label
                htmlFor="rider-reject-other"
                className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"
            >
                <input
                    id="rider-reject-other"
                    type="checkbox"
                    checked={raised}
                    onChange={onToggle}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                {t("admin.riders.reviewModal.reject.otherIssueMark")}
            </label>
            {raised && (
                <Textarea
                    id="rider-reject-other-reason"
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder={t("admin.riders.reviewModal.reject.otherIssuePlaceholder")}
                    aria-label={t("admin.riders.reviewModal.reject.otherIssueReasonLabel")}
                    className="bg-white transition-none"
                    rows={2}
                    disabled={disabled}
                    required
                    aria-required="true"
                    aria-invalid={reason.trim() === ""}
                />
            )}
        </div>
    );
}

/**
 * The read-back before the rejection is sent: every problem named, in the
 * order the rider will receive them. Reached only when `canConfirmReject`
 * holds, so no reason here is ever blank.
 */
function RejectSummary({issues}: {issues: RiderRejectionIssue[]}) {
    const {t} = useTranslation();
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                {t("admin.riders.reviewModal.reject.summaryTitle")}
            </p>
            <ul className="space-y-1 pl-4 text-sm list-disc text-gray-700">
                {issues.map((issue) => (
                    <li key={issue.document ?? "no-document"}>
                        <span className="font-medium">
                            {issue.document
                                ? t(`admin.riders.reviewModal.documents.kinds.${issue.document}`)
                                : t("admin.riders.reviewModal.reject.otherIssueTitle")}
                        </span>
                        {" — "}
                        <span className="break-words">{issue.reason.trim()}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function CriminalRecordRow({checkedAt, isClear}: {checkedAt?: string | null; isClear?: boolean | null}) {
    const {t} = useTranslation();
    if (!checkedAt) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <ShieldQuestion className="w-4 h-4 shrink-0"/>
                {t("admin.riders.reviewModal.review.criminalRecordNotChecked")}
            </div>
        );
    }
    if (isClear) {
        return (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
                <ShieldCheck className="w-4 h-4 shrink-0"/>
                {t("admin.riders.reviewModal.review.criminalRecordClear")}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 text-sm text-red-700">
            <ShieldAlert className="w-4 h-4 shrink-0"/>
            {t("admin.riders.reviewModal.review.criminalRecordNotClear")}
        </div>
    );
}

function ReviewSection({review}: {review: RiderReviewDetail}) {
    const {t} = useTranslation();
    return (
        <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {t("admin.riders.reviewModal.review.title")}
            </h3>
            <div className="space-y-4">
                <FieldRow
                    label={t("admin.riders.reviewModal.review.reviewedBy")}
                    value={
                        review.reviewedBy != null
                            ? String(review.reviewedBy)
                            : t("admin.riders.reviewModal.review.notYetReviewed")
                    }
                />
                <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                        {t("admin.riders.reviewModal.review.criminalRecordCheck")}
                    </p>
                    <CriminalRecordRow checkedAt={review.criminalRecordCheckedAt} isClear={review.criminalRecordIsClear}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldRow
                        label={t("admin.riders.reviewModal.review.criminalRecordCheckedBy")}
                        value={review.criminalRecordCheckedBy != null ? String(review.criminalRecordCheckedBy) : null}
                    />
                    <FieldRow
                        label={t("admin.riders.reviewModal.review.criminalRecordCheckedAt")}
                        value={
                            review.criminalRecordCheckedAt
                                ? new Date(review.criminalRecordCheckedAt).toLocaleString()
                                : null
                        }
                    />
                </div>
            </div>
        </div>
    );
}
