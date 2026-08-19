"use client";

import Image from "next/image";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {CheckCircle, Eye, Loader2, UserCheck, UserX, Motorbike, Car, Star} from "lucide-react";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {JSX, useState} from "react";
import {cn} from "@/lib/utils";
import {Rider, RiderView, VehicleType} from "108jobs-client";
import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";

const vehicleIconMap: Record<VehicleType, JSX.Element> = {
    Motorcycle: <Motorbike className="w-4 h-4"/>,
    Car: <Car className="w-4 h-4"/>,
};

type ViewMode = "unverified" | "verified";

export default function AdminRidersManagementPage() {
    const {t} = useTranslation();

    const [viewMode, setViewMode] = useState<ViewMode>("unverified");

    // Placeholder for Task 13: the review modal isn't built yet, so nothing
    // reads `reviewingRider` and setting it is a visible no-op for now. The
    // Eye button below already wires the setter; Task 13 adds the modal that
    // consumes this state (and the approve/reject calls that used to live
    // inline in the row).
    const [reviewingRider, setReviewingRider] = useState<Rider | null>(null);

    const {
        riders,
        isLoading,
        error,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
    } = usePaginatedRiders({
        verified: viewMode === "verified",
        limit: 10,
    });

    const handleTabChange = (mode: ViewMode) => {
        setViewMode(mode);
        // The hook will automatically refetch with new `verified` param
    };

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto text-gray-600 dark:text-gray-300 p-6 space-y-8">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-light tracking-tight">{t("admin.riders.title")}</h1>
                        <p className="text-sm text-muted-foreground mt-1">{t("admin.riders.description")}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={viewMode === "unverified" ? "default" : "outline"}
                            onClick={() => handleTabChange("unverified")}
                        >
                            <UserX className="w-4 h-4 mr-2"/>
                            {t("admin.riders.tabUnverified")}
                        </Button>
                        <Button
                            variant={viewMode === "verified" ? "default" : "outline"}
                            onClick={() => handleTabChange("verified")}
                        >
                            <UserCheck className="w-4 h-4 mr-2"/>
                            {t("admin.riders.tabVerified")}
                        </Button>
                    </div>
                </header>

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

                                                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setReviewingRider(rider)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        <Eye className="w-4 h-4"/>
                                                    </Button>
                                                </div>
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