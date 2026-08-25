"use client";

import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Card} from "@/components/ui/Card";
import {CheckCircle, Loader2, CreditCard, Filter} from "lucide-react";
import {toast} from "sonner";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {useState, useEffect} from "react";
import {cn} from "@/lib/utils";
import {BankAccountId, BankAccountView} from "108heros-client";
import {isSuccess, isFailed} from "@/services/HttpService";

type ViewMode = "unverified" | "verified";

import {useCursorPagination} from "@/hooks/data/useCursorPagination";

export default function AdminBankVerificationList() {
    const {t} = useTranslation();

    const [viewMode, setViewMode] = useState<ViewMode>("unverified");

    const pager = useCursorPagination();

    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListBankAccounts", {
        pageCursor: pager.currentCursor,
        pageBack: pager.isGoingBack,
        limit: 5,
        isVerified: viewMode === "verified",
    });

    const bankAccounts = data?.bankAccounts ?? [];
    const isFetchFailed = isFailed(state);
    const showLoading = isLoading || isMutating;

    const {execute: verify, isMutating: verifying} = useHttpPost("adminVerifyBankAccount");

    // Reset pagination when mode changes
    useEffect(() => {
        pager.resetPagination();
    }, [viewMode]);

    const handleVerify = async (bankAccountId: BankAccountId) => {
        const res = await verify({bankAccountId});
        if (isSuccess(res)) {
            toast.success(t("admin.bankManagement.actionApprove"));
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.bankManagement.verifyFailed"));
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 text-gray-700">
                {/* Header */}
                <div className="text-center space-y-5">
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t("admin.bankManagement.title")}
                    </h1>

                    {/* Mode Toggle - Responsive */}
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            onClick={() => setViewMode("unverified")}
                            className={cn(
                                "flex-1 min-w-[140px] sm:min-w-0 px-5 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                                viewMode === "unverified"
                                    ? "bg-primary text-white shadow-lg"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >
                            <Filter className="w-4 h-4"/>
                            {t("admin.bankManagement.tabUnverified")}
                        </button>
                        <button
                            onClick={() => setViewMode("verified")}
                            className={cn(
                                "flex-1 min-w-[140px] sm:min-w-0 px-5 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                                viewMode === "verified"
                                    ? "bg-emerald-600 text-white shadow-lg"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                        >
                            <CheckCircle className="w-4 h-4"/>
                            {t("admin.bankManagement.tabVerified")}
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {showLoading && (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Card key={i} className="p-5 animate-pulse">
                                <div className="space-y-4">
                                    <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                                    <div className="space-y-2">
                                        <div className="h-5 bg-gray-200 rounded w-full"></div>
                                        <div className="h-5 bg-gray-200 rounded w-5/6"></div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {!showLoading && isFetchFailed && (
                    <Card className="p-12 text-center bg-red-50 border border-red-100">
                        <CreditCard className="w-16 h-16 mx-auto text-red-400 mb-4"/>
                        <p className="text-lg font-medium text-red-600">
                            {t("admin.bankManagement.fetchError")}
                        </p>
                    </Card>
                )}

                {/* Empty State */}
                {!showLoading && !isFetchFailed && bankAccounts.length === 0 && (
                    <Card className="p-12 text-center bg-gray-50">
                        <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4"/>
                        <p className="text-lg font-medium text-gray-700">
                            {viewMode === "unverified"
                                ? t("admin.bankManagement.emptyUnverified")
                                : t("admin.bankManagement.emptyVerified")}
                        </p>
                    </Card>
                )}

                {/* List */}
                {!showLoading && !isFetchFailed && bankAccounts.length > 0 && (
                    <>
                        <div className="space-y-4">
                            {bankAccounts.map((item: BankAccountView) => {
                                const bank = item.bank;
                                const acc = item.userBankAccount;

                                return (
                                    <Card
                                        key={acc.id}
                                        className="overflow-hidden border border-border-secondary hover:shadow-lg transition-shadow"
                                    >
                                        <div
                                            className={cn(
                                                "p-5 sm:p-6",
                                                viewMode === "unverified"
                                                    ? "bg-gradient-to-r from-amber-50/70 to-orange-50/50"
                                                    : "bg-gradient-to-r from-emerald-50/70 to-teal-50/50"
                                            )}
                                        >
                                            {/* Mobile: Vertical Stack */}
                                            <div className="flex flex-col gap-5">
                                                {/* Top: Bank Info */}
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-white rounded-2xl shadow-sm flex-shrink-0">
                                                        <CreditCard
                                                            className={cn(
                                                                "w-7 h-7",
                                                                viewMode === "unverified" ? "text-amber-600" : "text-emerald-600"
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-3">
                                                        <h3 className="text-lg sm:text-xl font-bold text-primary truncate">
                                                            {bank.name}
                                                        </h3>
                                                        <div className="font-mono sm:text-lg tracking-wider text-primary">
                                                            <p className="truncate">
                                                                <span
                                                                    className="font-medium">{t("admin.bankManagement.accountHolder")}:</span>{" "}
                                                                {acc.accountName}
                                                            </p>
                                                            <p className="font-mono sm:text-lg tracking-wider text-primary">
                                                                <span
                                                                    className="font-medium">{t("admin.bankManagement.accountNumber")}:</span>{" "}
                                                                {acc.accountNumber}
                                                            </p>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-black">
                                                                    <span
                                                                        className="font-medium">{t("admin.bankManagement.userId")}:</span>{" "}
                                                                    {acc.localUserId}
                                                                </p>
                                                                {/* Status Badge */}
                                                                <Badge
                                                                    variant={viewMode === "unverified" ? "secondary" : "default"}
                                                                    className={cn(
                                                                        "text-xs sm:text-sm",
                                                                        viewMode === "unverified"
                                                                            ? "bg-amber-100 text-amber-800"
                                                                            : "bg-emerald-100 text-emerald-800"
                                                                    )}
                                                                >
                                                                    {viewMode === "unverified" ? (
                                                                        <>
                                                                            <Loader2 className="w-3.5 h-3.5 mr-1"/>
                                                                            {t("admin.bankManagement.statusPending")}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <CheckCircle className="w-3.5 h-3.5 mr-1"/>
                                                                            {t("admin.bankManagement.statusVerified")}
                                                                        </>
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                        </div>


                                                    </div>
                                                </div>

                                                {/* Actions - Full width on mobile */}
                                                {viewMode === "unverified" && (
                                                    <div
                                                        className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200">
                                                        <Button
                                                            className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            onClick={() => handleVerify(acc.id)}
                                                            disabled={verifying}
                                                        >
                                                            {verifying ? (
                                                                <Loader2 className="w-5 h-5 animate-spin"/>
                                                            ) : (
                                                                <CheckCircle className="w-5 h-5 mr-2"/>
                                                            )}
                                                            {t("admin.bankManagement.actionApprove")}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-center mt-8">
                            <PaginationControls
                                hasPrevious={pager.hasPreviousPage}
                                hasNext={Boolean(data?.nextPage)}
                                onPrevious={pager.handlePrevPage}
                                onNext={() => pager.handleNextPage(data?.nextPage)}
                                isLoading={showLoading}
                            />
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}