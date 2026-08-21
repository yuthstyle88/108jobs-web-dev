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
    Plus,
    Trash2,
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
} from "108jobs-client";

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
 * Mirrors the section comments on `RiderApplicationFields` (108jobs-client)
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

const DOCUMENT_KINDS: readonly RiderDocumentKind[] = [
    "idCard",
    "licence",
    "vehicleRegistration",
    "insurance",
    "compulsoryInsurance",
    "face",
    "bankBook",
];

/**
 * One row of the reject panel's issue repeater. `document: null` is a real,
 * sendable choice ("not about a document" -- see `RejectionIssueInput` on
 * the server) and not merely an unset field, so it is always present here
 * rather than left `undefined`.
 */
interface IssueRowState {
    id: number;
    document: RiderDocumentKind | null;
    reason: string;
}

/**
 * Sentinel <select> value standing in for `document: null` ("not about a
 * document"). Never a real `RiderDocumentKind` -- every one of those seven
 * literals is non-empty -- so the mapping back to `null` is unambiguous.
 */
const NO_DOCUMENT_VALUE = "";

function formatFieldValue(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
}

export function RiderReviewModal({rider, onClose, onReviewed}: RiderReviewModalProps) {
    const {t} = useTranslation();
    const [isRejecting, setIsRejecting] = useState(false);
    const [issueRows, setIssueRows] = useState<IssueRowState[]>([]);
    // Per-instance so a fresh modal (and every test that mounts one) starts
    // its own id sequence -- a module-level counter would work too, but
    // would keep climbing across every modal ever opened in the session for
    // no benefit; these ids only need to be unique within one row list.
    const nextIssueRowId = useRef(0);

    const {
        data,
        state: applicationState,
        isLoading,
        execute: retryApplicationFetch,
        isMutating: retryingApplication,
    } = useHttpGet("getRiderApplication", [rider.id]);
    const {execute: verifyRider, isMutating: verifying} = useHttpPost("adminVerifyRider");

    const makeIssueRow = (): IssueRowState => ({id: nextIssueRowId.current++, document: null, reason: ""});
    const addIssueRow = () => setIssueRows((rows) => [...rows, makeIssueRow()]);
    const updateIssueDocument = (id: number, document: RiderDocumentKind | null) =>
        setIssueRows((rows) => rows.map((row) => (row.id === id ? {...row, document} : row)));
    const updateIssueReason = (id: number, reason: string) =>
        setIssueRows((rows) => rows.map((row) => (row.id === id ? {...row, reason} : row)));
    const removeIssueRow = (id: number) => setIssueRows((rows) => rows.filter((row) => row.id !== id));

    // Mirrors crud/update.rs's own validation, in the same order, so a
    // rejection either fails fast client-side or not at all -- the server's
    // 400s are discovered here, once, rather than by every admin who submits
    // one.
    const hasNoIssues = issueRows.length === 0;
    const hasBlankReason = issueRows.some((row) => row.reason.trim() === "");
    const documentTally = new Map<RiderDocumentKind, number>();
    for (const row of issueRows) {
        if (row.document) {
            documentTally.set(row.document, (documentTally.get(row.document) ?? 0) + 1);
        }
    }
    const duplicateDocuments = new Set(
        Array.from(documentTally.entries())
            .filter(([, count]) => count > 1)
            .map(([document]) => document),
    );
    const hasDuplicateDocument = duplicateDocuments.size > 0;
    const canConfirmReject = !hasNoIssues && !hasBlankReason && !hasDuplicateDocument;

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
                  issues: issueRows.map(({document, reason}) => ({document, reason: reason.trim()})),
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
                setIssueRows([]);
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
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-gray-700 dark:text-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
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
                        className="p-1 rounded-full hover:bg-muted transition-colors shrink-0"
                        aria-label={t("admin.riders.reviewModal.closeLabel")}
                    >
                        <X className="w-5 h-5 text-muted-foreground"/>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading && !data ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground"/>
                        </div>
                    ) : applicationFetchFailed ? (
                        <div className="flex flex-col items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                            <AlertTriangle className="w-6 h-6 text-destructive shrink-0"/>
                            <p>{t("admin.riders.reviewModal.loadError.title")}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryApplicationFetch()}
                                disabled={retryingApplication}
                            >
                                {retryingApplication && <Loader2 className="w-4 h-4 animate-spin mr-2"/>}
                                {retryingApplication
                                    ? t("admin.riders.reviewModal.loadError.retrying")
                                    : t("admin.riders.reviewModal.loadError.retry")}
                            </Button>
                        </div>
                    ) : !application ? (
                        <div
                            className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400">
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

                            {/* 3. The seven documents. */}
                            <DocumentsSection riderId={rider.id} documents={application.documents}/>

                            {/* 4. Review detail -- admin only, absent for a stranger. */}
                            {application.review && <ReviewSection review={application.review}/>}
                        </>
                    )}
                </div>

                {/* 5. Approve / Reject-with-reason */}
                {application && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-6 shrink-0">
                        {isRejecting ? (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    {issueRows.map((row, index) => (
                                        <IssueRow
                                            key={row.id}
                                            index={index}
                                            row={row}
                                            documentKinds={DOCUMENT_KINDS}
                                            isDuplicateDocument={row.document !== null && duplicateDocuments.has(row.document)}
                                            disabled={verifying}
                                            onDocumentChange={(document) => updateIssueDocument(row.id, document)}
                                            onReasonChange={(reason) => updateIssueReason(row.id, reason)}
                                            onRemove={() => removeIssueRow(row.id)}
                                        />
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-dashed"
                                    onClick={addIssueRow}
                                    disabled={verifying}
                                >
                                    <Plus className="w-4 h-4"/>
                                    {t("admin.riders.reviewModal.reject.addIssue")}
                                </Button>
                                {!canConfirmReject && (
                                    <ul className="space-y-0.5 pl-4 text-xs text-red-500 dark:text-red-400 list-disc">
                                        {hasNoIssues && <li>{t("admin.riders.reviewModal.reject.errors.noIssues")}</li>}
                                        {hasBlankReason && (
                                            <li>{t("admin.riders.reviewModal.reject.errors.reasonRequired")}</li>
                                        )}
                                        {hasDuplicateDocument && (
                                            <li>{t("admin.riders.reviewModal.reject.errors.duplicateDocument")}</li>
                                        )}
                                    </ul>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => handleDecision(false)}
                                        disabled={verifying || !canConfirmReject}
                                    >
                                        {verifying && <Loader2 className="w-4 h-4 animate-spin mr-2"/>}
                                        {t("admin.riders.reviewModal.actions.confirmReject")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            setIsRejecting(false);
                                            setIssueRows([]);
                                        }}
                                        disabled={verifying}
                                    >
                                        {t("admin.riders.reviewModal.actions.cancelReject")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handleDecision(true)}
                                    disabled={verifying}
                                >
                                    {verifying ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2"/>
                                    )}
                                    {t("admin.riders.actionApprove")}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                    onClick={() => {
                                        setIsRejecting(true);
                                        setIssueRows([makeIssueRow()]);
                                    }}
                                    disabled={verifying}
                                >
                                    {t("admin.riders.actionReject")}
                                </Button>
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
            <Badge className="text-xs px-2.5 py-0.5">
                <CheckCircle className="w-3.5 h-3.5 mr-1"/>
                {t("admin.riders.statusVerified")}
            </Badge>
        );
    }
    if (status === "Rejected") {
        return (
            <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                <XCircle className="w-3.5 h-3.5 mr-1"/>
                {t("admin.riders.statusRejected")}
            </Badge>
        );
    }
    return (
        <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin"/>
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
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-medium">{t(labelKey)}:</span>{" "}
            {fallbackReason}
        </p>
    );
}

function FieldRow({label, value}: {label: string; value: string | null}) {
    const {t} = useTranslation();
    return (
        <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p
                className={cn(
                    "text-sm break-words",
                    value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-600 italic"
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
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
            className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        {t("admin.riders.reviewModal.mismatch.title")}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        {t("admin.riders.reviewModal.mismatch.description")}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t("admin.riders.reviewModal.mismatch.fromCard")}
                    </p>
                    <p className="text-sm font-mono text-amber-900 dark:text-amber-200">{mismatch.fromCard}</p>
                </div>
                <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t("admin.riders.reviewModal.mismatch.fromLicence")}
                    </p>
                    <p className="text-sm font-mono text-amber-900 dark:text-amber-200">{mismatch.fromLicence}</p>
                </div>
            </div>
        </div>
    );
}

function DocumentsSection({riderId, documents}: {riderId: RiderId; documents: RiderDocumentSlot[]}) {
    const {t} = useTranslation();
    return (
        <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                {t("admin.riders.reviewModal.documents.title")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {DOCUMENT_KINDS.map((kind) => (
                    <DocumentTile
                        key={kind}
                        riderId={riderId}
                        kind={kind}
                        slot={documents.find((d) => d.kind === kind)}
                    />
                ))}
            </div>
        </div>
    );
}

function DocumentTile({riderId, kind, slot}: {riderId: RiderId; kind: RiderDocumentKind; slot?: RiderDocumentSlot}) {
    const {t} = useTranslation();
    const [failed, setFailed] = useState(false);
    // Set only once a background check confirms the proxy itself failed --
    // see the effect below. Stays false otherwise, so a legitimately
    // non-image attachment (by design, see the comment on the <img> below)
    // keeps opening exactly as it always has.
    const [openFailed, setOpenFailed] = useState(false);
    const src = `/api/rider-documents/${riderId}/${kind}`;
    const label = t(`admin.riders.reviewModal.documents.kinds.${kind}`);

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

    return (
        <div
            className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 flex flex-col">
            <div className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-900/40">
                {!slot ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 text-xs px-2 text-center">
                        <ImageOff className="w-6 h-6"/>
                        <span>{t("admin.riders.reviewModal.documents.notSubmitted")}</span>
                    </div>
                ) : failed && openFailed ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 text-xs px-2 text-center">
                        <FileText className="w-6 h-6"/>
                        <span>{t("admin.riders.reviewModal.documents.openFailed")}</span>
                    </div>
                ) : failed ? (
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 text-xs px-2 text-center hover:text-primary"
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
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {new Date(slot.uploadedAt).toLocaleDateString()}
                    </p>
                )}
            </div>
        </div>
    );
}

function IssueRow({
    index,
    row,
    documentKinds,
    isDuplicateDocument,
    disabled,
    onDocumentChange,
    onReasonChange,
    onRemove,
}: {
    index: number;
    row: IssueRowState;
    documentKinds: readonly RiderDocumentKind[];
    isDuplicateDocument: boolean;
    disabled: boolean;
    onDocumentChange: (document: RiderDocumentKind | null) => void;
    onReasonChange: (reason: string) => void;
    onRemove: () => void;
}) {
    const {t} = useTranslation();
    const reasonMissing = row.reason.trim() === "";
    const documentFieldId = `rider-reject-document-${row.id}`;
    const reasonFieldId = `rider-reject-reason-${row.id}`;

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("admin.riders.reviewModal.reject.issueLabel", {number: index + 1})}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={t("admin.riders.reviewModal.reject.removeIssueLabel")}
                >
                    <Trash2 className="w-4 h-4"/>
                </Button>
            </div>
            <div>
                <label
                    htmlFor={documentFieldId}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                    {t("admin.riders.reviewModal.reject.documentLabel")}
                </label>
                <select
                    id={documentFieldId}
                    value={row.document ?? NO_DOCUMENT_VALUE}
                    onChange={(e) =>
                        onDocumentChange(
                            e.target.value === NO_DOCUMENT_VALUE ? null : (e.target.value as RiderDocumentKind),
                        )
                    }
                    disabled={disabled}
                    aria-invalid={isDuplicateDocument}
                    className={cn(
                        "flex h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100",
                        isDuplicateDocument ? "border-red-400 dark:border-red-700" : "border-input dark:border-gray-700",
                    )}
                >
                    <option value={NO_DOCUMENT_VALUE}>{t("admin.riders.reviewModal.reject.noDocumentOption")}</option>
                    {documentKinds.map((kind) => (
                        <option key={kind} value={kind}>
                            {t(`admin.riders.reviewModal.documents.kinds.${kind}`)}
                        </option>
                    ))}
                </select>
                {isDuplicateDocument && (
                    <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        {t("admin.riders.reviewModal.reject.errors.duplicateDocument")}
                    </p>
                )}
            </div>
            <div>
                <label
                    htmlFor={reasonFieldId}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                    {t("admin.riders.reviewModal.reject.reasonLabel")}{" "}
                    <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <Textarea
                    id={reasonFieldId}
                    value={row.reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder={t("admin.riders.reviewModal.reject.reasonPlaceholder")}
                    className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    rows={2}
                    disabled={disabled}
                    required
                    aria-required="true"
                    aria-invalid={reasonMissing}
                />
            </div>
        </div>
    );
}

function CriminalRecordRow({checkedAt, isClear}: {checkedAt?: string | null; isClear?: boolean | null}) {
    const {t} = useTranslation();
    if (!checkedAt) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <ShieldQuestion className="w-4 h-4 shrink-0"/>
                {t("admin.riders.reviewModal.review.criminalRecordNotChecked")}
            </div>
        );
    }
    if (isClear) {
        return (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0"/>
                {t("admin.riders.reviewModal.review.criminalRecordClear")}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <ShieldAlert className="w-4 h-4 shrink-0"/>
            {t("admin.riders.reviewModal.review.criminalRecordNotClear")}
        </div>
    );
}

function ReviewSection({review}: {review: RiderReviewDetail}) {
    const {t} = useTranslation();
    return (
        <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
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
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
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
