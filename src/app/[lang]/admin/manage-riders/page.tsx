"use client";

import Image from "next/image";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {CheckCircle, Eye, Loader2, UserCheck, UserX, Motorbike, Car, Star} from "lucide-react";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {RiderReviewModal} from "@/modules/admin/components/Modal/RiderReviewModal";
import {JSX, useState} from "react";
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
    // The rider currently open in RiderReviewModal, or null when the modal
    // is closed. The Eye button on each row sets this; the modal itself
    // fetches the full application for `reviewingRider.id`.
    const [reviewingRider, setReviewingRider] = useState<Rider | null>(null);

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
                    <Card className="border-dashed p-12 text-center">
                        <UserX className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </Card>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div
                            className="w-8 h-8 border-2 border-t-transparent border-foreground/30 rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && riders.length === 0 && !error && (
                    <Card className="border-dashed p-12 text-center">
                        <UserX className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                        <p className="text-sm text-muted-foreground">
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
                                        className="p-5 hover:shadow-sm transition-shadow duration-200 border"
                                    >
                                        <div className="flex flex-col gap-5">
                                            {/* Main info */}
                                            <div className="flex items-start gap-5">
                                                <Avatar className="h-11 w-11 shrink-0">
                                                    <AvatarImage src={person.avatar}/>
                                                    <AvatarFallback className="text-xs font-medium">
                                                        {(person.name || person.displayName || "?").charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0 space-y-3">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-bold text-primary truncate">
                                                            {person.name || person.displayName || t("admin.riders.unknown")}
                                                        </h3>
                                                        <Badge
                                                            variant={isUnverified ? "secondary" : "default"}
                                                            className="text-xs sm:text-sm px-3 py-1"
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
                                                    aria-label={t("admin.riders.reviewRiderLabel")}
                                                    className="text-muted-foreground hover:text-foreground"
                                                >
                                                    <Eye className="w-4 h-4"/>
                                                </Button>
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
