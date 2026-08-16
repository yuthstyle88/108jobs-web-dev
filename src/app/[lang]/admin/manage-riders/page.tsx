"use client";

import Image from "next/image";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {CheckCircle, Loader2, UserCheck, UserX, Bike, Motorbike, Car, Star} from "lucide-react";
import {toast} from "sonner";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {JSX, useState} from "react";
import {cn} from "@/lib/utils";
import {RiderId, RiderView, VehicleType} from "108jobs-client";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {isFailed, isSuccess} from "@/services/HttpService";
import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";

const vehicleIconMap: Record<VehicleType, JSX.Element> = {
    Bicycle: <Bike className="w-4 h-4"/>,
    Motorcycle: <Motorbike className="w-4 h-4"/>,
    Car: <Car className="w-4 h-4"/>,
};

type ViewMode = "unverified" | "verified";

export default function AdminRidersManagementPage() {
    const {t} = useTranslation();

    const [viewMode, setViewMode] = useState<ViewMode>("unverified");
    const [rejectingRiderId, setRejectingRiderId] = useState<RiderId | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const {
        riders,
        isLoading,
        error,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        refetch,
    } = usePaginatedRiders({
        verified: viewMode === "verified",
        limit: 10,
    });
    const {execute: verifyRider, isMutating: verifying} = useHttpPost("adminVerifyRider");

    const handleVerify = async (riderId: RiderId, approve: boolean, reason?: string) => {
        const res = await verifyRider({riderId, approve, reason: reason || undefined});
        if (isSuccess(res)) {
            toast.success(
                approve ? t("admin.riders.actionApproved") : t("admin.riders.actionRejected")
            );
            if (!approve) {
                setRejectingRiderId(null);
                setRejectReason("");
            }
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("common.errorOccurred") || "An error occurred");
        }
    };

    const handleTabChange = (mode: ViewMode) => {
        setViewMode(mode);
        // The hook will automatically refetch with new `verified` param
    };

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 text-gray-700 dark:text-gray-200">
                {/* Header */}
                <div className="text-center space-y-5">
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {t("admin.riders.title")}
                    </h1>

                    <div className="flex flex-wrap justify-center gap-3">
                        <button
                            onClick={() => handleTabChange("unverified")}
                            className={cn(
                                "flex-1 min-w-[160px] px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm",
                                viewMode === "unverified"
                                    ? "bg-amber-600 text-white shadow-amber-200/50"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            )}
                        >
                            <UserX className="w-4 h-4"/>
                            {t("admin.riders.tabUnverified")}
                        </button>

                        <button
                            onClick={() => handleTabChange("verified")}
                            className={cn(
                                "flex-1 min-w-[160px] px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm",
                                viewMode === "verified"
                                    ? "bg-emerald-600 text-white shadow-emerald-200/50"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            )}
                        >
                            <UserCheck className="w-4 h-4"/>
                            {t("admin.riders.tabVerified")}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100 text-center">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Card key={i} className="p-6 animate-pulse bg-gray-50 dark:bg-gray-800">
                                <div className="space-y-4">
                                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                    <div className="space-y-3">
                                        <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                                        <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && riders.length === 0 && !error && (
                    <Card
                        className="p-12 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <UserX className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4"/>
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                            {viewMode === "unverified"
                                ? t("admin.riders.emptyUnverified")
                                : t("admin.riders.emptyVerified")}
                        </p>
                    </Card>
                )}

                {/* Riders list */}
                {!isLoading && riders.length > 0 && (
                    <>
                        <div className="space-y-4">
                            {riders.map((item: RiderView) => {
                                const {rider, person} = item;
                                const isUnverified = viewMode === "unverified";

                                return (
                                    <Card
                                        key={rider.id}
                                        className="overflow-hidden border border-border-secondary hover:shadow-lg transition-shadow duration-200"
                                    >
                                        <div
                                            className={cn(
                                                "p-5 sm:p-6",
                                                isUnverified
                                                    ? "bg-gradient-to-r from-amber-50/70 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/30"
                                                    : "bg-gradient-to-r from-emerald-50/70 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/30"
                                            )}
                                        >
                                            <div className="flex flex-col gap-5">
                                                {/* Main info */}
                                                <div className="flex items-start gap-5">
                                                    <div
                                                        className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                        {person.avatar ? (
                                                            <Image
                                                                src={person.avatar}
                                                                alt={person.name || person.displayName || t("admin.riders.unknown")}
                                                                width={28}
                                                                height={28}
                                                                className="w-7 h-7 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <UserCheck
                                                                className={cn("w-7 h-7", isUnverified ? "text-amber-600" : "text-emerald-600")}
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0 space-y-3">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <h3 className="text-lg sm:text-xl font-bold text-primary truncate">
                                                                {person.name || person.displayName || t("admin.riders.unknown")}
                                                            </h3>
                                                            <Badge
                                                                variant={isUnverified ? "secondary" : "default"}
                                                                className={cn(
                                                                    "text-xs sm:text-sm px-3 py-1",
                                                                    isUnverified
                                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                                )}
                                                            >
                                                                {isUnverified ? (
                                                                    <>
                                                                        <Loader2
                                                                            className="w-3.5 h-3.5 mr-1 animate-spin"/>
                                                                        {t("admin.riders.statusPending")}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle className="w-3.5 h-3.5 mr-1"/>
                                                                        {t("admin.riders.statusVerified")}
                                                                    </>
                                                                )}
                                                            </Badge>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                            <div>
                                                                <span
                                                                    className="font-medium">{t("admin.riders.vehicle")}:</span>{" "}
                                                                <span className="inline-flex items-center gap-1.5">
                                  {vehicleIconMap[rider.vehicleType]}
                                                                    {rider.vehicleType}
                                                                    {rider.vehiclePlateNumber && ` • ${rider.vehiclePlateNumber}`}
                                </span>
                                                            </div>

                                                            <div>
                                                                <span
                                                                    className="font-medium">{t("admin.riders.rating")}:</span>{" "}
                                                                <span className="inline-flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500"/>
                                                                    {rider.rating.toFixed(1)} ({rider.completedJobs}/{rider.totalJobs})
                                </span>
                                                            </div>

                                                            <div>
                                                                <span
                                                                    className="font-medium">{t("admin.riders.id")}:</span> {rider.id}
                                                            </div>

                                                            {rider.verifiedAt && (
                                                                <div>
                                                                    <span
                                                                        className="font-medium">{t("admin.riders.verifiedAt")}:</span>{" "}
                                                                    {new Date(rider.verifiedAt).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isUnverified && (
                                                    <div
                                                        className="flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                        {rejectingRiderId === rider.id ? (
                                                            <div className="space-y-3">
                                                                <textarea
                                                                    value={rejectReason}
                                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                                    placeholder={t("admin.riders.rejectionReasonPlaceholder")}
                                                                    className="w-full min-h-20 p-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                                                                    rows={2}
                                                                />
                                                                <div className="flex flex-col sm:flex-row gap-3">
                                                                    <Button
                                                                        className="flex-1 h-11 text-base bg-red-600 hover:bg-red-700 text-white"
                                                                        onClick={() => handleVerify(rider.id, false, rejectReason)}
                                                                        disabled={verifying}
                                                                    >
                                                                        {verifying && (
                                                                            <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                                                                        )}
                                                                        {t("admin.riders.actionReject")}
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="flex-1 h-11 text-base"
                                                                        onClick={() => setRejectingRiderId(null)}
                                                                        disabled={verifying}
                                                                    >
                                                                        {t("common.cancel") || "Cancel"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col sm:flex-row gap-3">
                                                                <Button
                                                                    className="flex-1 h-11 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    onClick={() => handleVerify(rider.id, true)}
                                                                    disabled={verifying}
                                                                >
                                                                    {verifying ? (
                                                                        <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                                                                    ) : (
                                                                        <CheckCircle className="w-5 h-5 mr-2"/>
                                                                    )}
                                                                    {t("admin.riders.actionApprove")}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="flex-1 h-11 text-base border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                                                    onClick={() => setRejectingRiderId(rider.id)}
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
                                    </Card>
                                );
                            })}
                        </div>

                        <div className="flex justify-center mt-8">
                            <PaginationControls
                                hasPrevious={hasPreviousPage}
                                hasNext={hasNextPage}
                                onPrevious={loadPreviousPage}
                                onNext={loadNextPage}
                                isLoading={isLoading}
                            />
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}