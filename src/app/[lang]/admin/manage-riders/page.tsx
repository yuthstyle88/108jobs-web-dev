"use client";

import {JSX, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    Car,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Eye,
    Motorbike,
    RefreshCw,
    Star,
    UserCheck,
    UserRoundX,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import {Rider, RiderVerificationStatus, RiderView, VehicleType} from "108heros-client";

import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {cn} from "@/lib/utils";
import {RiderReviewModal} from "@/modules/admin/components/Modal/RiderReviewModal";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";

const vehicleIconMap: Record<VehicleType, JSX.Element> = {
    Motorcycle: <Motorbike className="h-4 w-4 shrink-0"/>,
    Car: <Car className="h-4 w-4 shrink-0"/>,
};

type ViewMode = RiderVerificationStatus;

const viewTabs: Array<{mode: ViewMode; labelKey: string; Icon: LucideIcon}> = [
    {mode: "Pending", labelKey: "admin.riders.tabPending", Icon: Clock3},
    {mode: "Verified", labelKey: "admin.riders.tabApproved", Icon: UserCheck},
    {mode: "Rejected", labelKey: "admin.riders.tabRejected", Icon: UserRoundX},
];

const statusPresentation: Record<
    RiderVerificationStatus,
    {labelKey: string; Icon: LucideIcon; className: string}
> = {
    Pending: {
        labelKey: "admin.riders.statusPending",
        Icon: Clock3,
        className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    Verified: {
        labelKey: "admin.riders.statusVerified",
        Icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    Rejected: {
        labelKey: "admin.riders.statusRejected",
        Icon: XCircle,
        className: "border-rose-200 bg-rose-50 text-rose-800",
    },
};

export default function AdminRidersManagementPage() {
    const {t} = useTranslation();
    const [viewMode, setViewMode] = useState<ViewMode>("Pending");
    const [reviewingRider, setReviewingRider] = useState<Rider | null>(null);

    const {
        riders,
        isLoading,
        error,
        hasNextPage,
        hasPreviousPage,
        currentPage,
        loadNextPage,
        loadPreviousPage,
        refetch,
    } = usePaginatedRiders({
        status: viewMode,
        limit: 10,
    });

    const emptyMessage = viewMode === "Pending"
        ? t("admin.riders.emptyPending")
        : viewMode === "Verified"
            ? t("admin.riders.emptyVerified")
            : t("admin.riders.emptyRejected");

    return (
        <AdminLayout>
            <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-6 text-slate-700 sm:px-6 lg:px-8">
                <header className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                            {t("admin.riders.queueLabel")}
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            {t("admin.riders.title")}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                            {t("admin.riders.description")}
                        </p>
                    </div>

                    <div className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 xl:w-auto xl:min-w-[430px]">
                        {viewTabs.map(({mode, labelKey, Icon}) => {
                            const active = viewMode === mode;
                            return (
                                <Button
                                    key={mode}
                                    type="button"
                                    variant="ghost"
                                    aria-pressed={active}
                                    onClick={() => setViewMode(mode)}
                                    className={cn(
                                        "h-auto min-w-0 rounded-lg px-2 py-2.5 text-xs transition-none sm:px-4 sm:text-sm",
                                        active
                                            ? "bg-primary text-white hover:bg-primary hover:text-white"
                                            : "text-slate-600 hover:bg-white hover:text-slate-950",
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0"/>
                                    <span className="truncate">{t(labelKey)}</span>
                                </Button>
                            );
                        })}
                    </div>
                </header>

                <Card className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900">
                            {viewMode === "Pending" && <Clock3 className="h-4 w-4 shrink-0 text-amber-600"/>}
                            {viewMode === "Verified" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/>}
                            {viewMode === "Rejected" && <XCircle className="h-4 w-4 shrink-0 text-rose-600"/>}
                            <span className="truncate">
                                {t(viewTabs.find(({mode}) => mode === viewMode)!.labelKey)}
                            </span>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground" aria-live="polite">
                            {t("admin.riders.pageLabel", {page: currentPage})}
                        </span>
                    </div>

                    <div aria-busy={isLoading}>
                        {isLoading && (
                            <div className="flex min-h-56 flex-col items-center justify-center px-5 py-12 text-center">
                                <Clock3 className="h-10 w-10 text-slate-400"/>
                                <p className="mt-4 text-sm font-medium text-slate-700">
                                    {t("admin.riders.loading")}
                                </p>
                            </div>
                        )}

                        {!isLoading && error && (
                            <div className="flex min-h-56 flex-col items-center justify-center px-5 py-12 text-center">
                                <UserRoundX className="h-10 w-10 text-rose-500"/>
                                <p className="mt-4 max-w-md text-sm text-muted-foreground">{error}</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refetch()}
                                    className="mt-5 transition-none"
                                >
                                    <RefreshCw className="h-4 w-4"/>
                                    {t("admin.riders.retry")}
                                </Button>
                            </div>
                        )}

                        {!isLoading && !error && riders.length === 0 && (
                            <div className="flex min-h-56 flex-col items-center justify-center px-5 py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <UserRoundX className="h-6 w-6"/>
                                </div>
                                <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                                    {emptyMessage}
                                </p>
                            </div>
                        )}

                        {!isLoading && !error && riders.length > 0 && (
                            <ul className="divide-y divide-slate-200">
                                {riders.map(({rider, person}: RiderView) => {
                                    const presentation = statusPresentation[rider.verificationStatus];
                                    const StatusIcon = presentation.Icon;
                                    const name = person.name || person.displayName || t("admin.riders.unknown");

                                    return (
                                        <li key={rider.id} className="min-w-0 p-4 sm:p-5">
                                            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] lg:items-center">
                                                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                                    <Avatar className="h-11 w-11 shrink-0 sm:h-12 sm:w-12">
                                                        <AvatarImage src={person.avatar} alt=""/>
                                                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                                            {(person.name || person.displayName || "?").charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <h3 className="min-w-0 truncate text-base font-semibold text-slate-950 sm:text-lg">
                                                                {name}
                                                            </h3>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn("shrink-0 gap-1 transition-none", presentation.className)}
                                                            >
                                                                <StatusIcon className="h-3.5 w-3.5"/>
                                                                {t(presentation.labelKey)}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {t("admin.riders.id")}: {rider.id}
                                                        </p>
                                                    </div>
                                                </div>

                                                <dl className="grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:bg-transparent lg:p-0">
                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            {t("admin.riders.vehicle")}
                                                        </dt>
                                                        <dd className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800">
                                                            {vehicleIconMap[rider.vehicleType]}
                                                            <span className="truncate">
                                                                {rider.vehicleType}
                                                                {rider.vehiclePlateNumber ? ` · ${rider.vehiclePlateNumber}` : ""}
                                                            </span>
                                                        </dd>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            {t("admin.riders.rating")}
                                                        </dt>
                                                        <dd className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800">
                                                            <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500"/>
                                                            <span className="truncate">
                                                                {rider.rating.toFixed(1)} ({rider.completedJobs}/{rider.totalJobs})
                                                            </span>
                                                        </dd>
                                                    </div>

                                                    {rider.verifiedAt && (
                                                        <div className="min-w-0 sm:col-span-2">
                                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                {t("admin.riders.verifiedAt")}
                                                            </dt>
                                                            <dd className="mt-1 text-sm font-medium text-slate-800">
                                                                {new Date(rider.verifiedAt).toLocaleDateString()}
                                                            </dd>
                                                        </div>
                                                    )}
                                                </dl>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setReviewingRider(rider)}
                                                    aria-label={t("admin.riders.reviewRiderLabel")}
                                                    className="w-full shrink-0 transition-none lg:w-auto"
                                                >
                                                    <Eye className="h-4 w-4"/>
                                                    {t("admin.riders.reviewRiderLabel")}
                                                </Button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {(hasPreviousPage || hasNextPage) && (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadPreviousPage}
                                disabled={!hasPreviousPage || isLoading}
                                className="min-w-0 justify-self-start px-2.5 transition-none sm:px-3"
                            >
                                <ChevronLeft className="h-4 w-4"/>
                                <span className="hidden sm:inline">{t("profileCoins.previousButton")}</span>
                            </Button>

                            <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                                {t("admin.riders.pageLabel", {page: currentPage})}
                            </span>

                            <Button
                                type="button"
                                size="sm"
                                onClick={loadNextPage}
                                disabled={!hasNextPage || isLoading}
                                className="min-w-0 justify-self-end px-2.5 transition-none sm:px-3"
                            >
                                <span className="hidden sm:inline">{t("profileCoins.nextButton")}</span>
                                <ChevronRight className="h-4 w-4"/>
                            </Button>
                        </div>
                    )}
                </Card>

                {reviewingRider && (
                    <RiderReviewModal
                        rider={reviewingRider}
                        onClose={() => setReviewingRider(null)}
                        onReviewed={() => {
                            setReviewingRider(null);
                            refetch();
                        }}
                    />
                )}
            </div>
        </AdminLayout>
    );
}
