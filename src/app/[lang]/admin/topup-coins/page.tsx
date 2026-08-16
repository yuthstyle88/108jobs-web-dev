"use client";
import {useState, useCallback} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {ListTopUpRequestQuery, TopUpRequestView} from "108jobs-client";
import {format} from "date-fns";
import {toast} from "sonner";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {
    ArrowRightLeft, Calendar, User, CreditCard, Hash, Clock,
    CheckCircle2, XCircle
} from "lucide-react";
import {TransferConfirmModal} from "@/modules/admin/components/Modal/TransferConfirmModal";
import {PaginationControls} from "@/components/PaginationControls";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {AdminTopUpWallet} from "108jobs-client";
import {REQUEST_STATE, isFailed} from "@/services/HttpService";
import {TopupGuide} from "@/modules/admin/components/TopupGuide";
import {useTranslation} from "react-i18next";
import {useDebounce} from "@/hooks/utils/useDebounce";
import {formatMinor} from "@/utils/format/money";

const TopUpCoins = () => {
    const {t} = useTranslation();
    const [filters, setFilters] = useState<ListTopUpRequestQuery>({limit: 10});
    const [currentCursor, setCurrentCursor] = useState<string | undefined>();
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);

    const debouncedFilters = useDebounce(filters, 500);

    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListTopUpRequests", {
        ...debouncedFilters,
        pageCursor: currentCursor,
        pageBack: isGoingBack,
    });

    const {execute: adminTopUpWallet, isMutating: isToppingUp} = useHttpPost("adminTopUpWallet");

    const topUps: TopUpRequestView[] = data?.topUpRequests ?? [];
    const hasNextPage = !!data?.nextPage;
    const hasPreviousPage = cursorHistory.length > 0;
    const isFetchFailed = isFailed(state);
    const showLoading = isLoading || isMutating;

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<TopUpRequestView | null>(null);

    const handleFilterChange = (key: keyof ListTopUpRequestQuery, value: any) => {
        setFilters((prev: ListTopUpRequestQuery) => ({...prev, [key]: value}));
    };

    const applyFilters = () => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
        setIsGoingBack(false);
        refetch();
    };

    const handleNextPage = useCallback(() => {
        if (data?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(data.nextPage);
            setIsGoingBack(false);
        }
    }, [data?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    }, [cursorHistory]);

    const openTransferModal = (topUp: TopUpRequestView) => {
        setSelectedTransfer(topUp);
        setIsTransferModalOpen(true);
    };

    const confirmTransfer = async () => {
        if (!selectedTransfer) return;

        const payload: AdminTopUpWallet = {
            targetUserId: selectedTransfer.localUser.id,
            paymentIntentId: selectedTransfer.topUpRequest.paymentIntentId,
            reason: "Admin top-up from payment",
        };

        const res = await adminTopUpWallet(payload);
        if (res.state === REQUEST_STATE.FAILED) {
            toast.error(t("topupCoins.toast.error"));
            return;
        }
        toast.success(t("topupCoins.toast.success", {
            amount: formatMinor(selectedTransfer.topUpRequest.amountMinor),
            email: selectedTransfer.localUser.email,
        }));
        refetch();
        setIsTransferModalOpen(false);
        setSelectedTransfer(null);
    };

    const getStatusBadge = (status: string, transferred: boolean) => {
        if (transferred) {
            return (
                <Badge className="bg-green-600 text-white border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1"/>
                    {t("topupCoins.status.transferred")}
                </Badge>
            );
        }

        switch (status) {
            case "Success":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.paid")}
                    </Badge>
                );
            case "Pending":
                return (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Clock className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.awaitingPayment")}
                    </Badge>
                );
            case "Expired":
                return (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                        <XCircle className="w-3 h-3 mr-1"/>
                        {t("topupCoins.status.expired")}
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6 p-4 sm:p-6 text-gray-600 lg:p-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold">
                        {t("topupCoins.title")}
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        {t("topupCoins.description")}
                    </p>
                </div>

                <TopupGuide/>

                {/* Filters */}
                <div className="bg-card p-6 rounded-2xl border shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.status")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.status ?? ""}
                                onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                <option value="Pending">{t("topupCoins.filters.pending")}</option>
                                <option value="Success">{t("topupCoins.filters.paid")}</option>
                                <option value="Expired">{t("topupCoins.filters.expired")}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.minAmount")}
                            </label>
                            <input
                                type="number"
                                placeholder={t("topupCoins.filters.placeholderMin")}
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.amountMinMinor !== undefined ? filters.amountMinMinor / 100 : ""}
                                onChange={(e) => handleFilterChange("amountMinMinor", e.target.value ? Number(e.target.value) * 100 : undefined)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.maxAmount")}
                            </label>
                            <input
                                type="number"
                                placeholder={t("topupCoins.filters.placeholderMax")}
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.amountMaxMinor !== undefined ? filters.amountMaxMinor / 100 : ""}
                                onChange={(e) => handleFilterChange("amountMaxMinor", e.target.value ? Number(e.target.value) * 100 : undefined)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.year")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.year ?? ""}
                                onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.month")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.month ?? ""}
                                onChange={(e) => handleFilterChange("month", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t("topupCoins.filters.day")}
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
                                value={filters.day ?? ""}
                                onChange={(e) => handleFilterChange("day", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("topupCoins.filters.all")}</option>
                                {Array.from({length: 31}, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>{d.toString().padStart(2, "0")}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-end sm:col-span-2 lg:col-span-6">
                            <Button onClick={applyFilters} className="w-full">
                                {t("topupCoins.filters.apply")}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Top-up List */}
                <div className="space-y-4">
                    {showLoading ? (
                        <div className="text-center py-12">
                            <div
                                className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="mt-3 text-sm text-muted-foreground">
                                {t("topupCoins.list.loading")}
                            </p>
                        </div>
                    ) : isFetchFailed ? (
                        <div className="text-center py-16 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-lg font-medium text-red-600">
                                {t("topupCoins.list.fetchError")}
                            </p>
                        </div>
                    ) : topUps.length === 0 ? (
                        <div className="text-center py-16 bg-muted/30 rounded-lg">
                            <p className="text-lg font-medium text-muted-foreground">
                                {t("topupCoins.list.noResults")}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t("topupCoins.list.noResultsHint")}
                            </p>
                        </div>
                    ) : (
                        topUps.map((item) => {
                            const wt = item.topUpRequest;
                            const canTransfer = wt.status === "Success" && !wt.transferred;

                            return (
                                <div key={wt.id}
                                     className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-card rounded-xl border shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div
                                            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <CreditCard className="w-6 h-6 text-primary"/>
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-semibold">
                                                    {item.localUser.email}
                                                </h4>
                                                {getStatusBadge(wt.status, wt.transferred)}
                                                {wt.paymentIntentId && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Hash className="w-3 h-3 mr-1"/>
                                                        {wt.paymentIntentId}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="text-sm space-y-1">
                                                <div className="flex flex-wrap gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5"/>
                              {format(new Date(wt.createdAt), "dd MMM yyyy, HH:mm")}
                          </span>
                                                    <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5"/>
                            ID: {item.localUser.id}
                          </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 sm:mt-0">
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-success">
                                                +{wt.amountCoin.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {t("topupCoins.list.coins")}
                                            </div>
                                        </div>

                                        {canTransfer && (
                                            <Button
                                                size="sm"
                                                className="flex items-center gap-1.5"
                                                onClick={() => openTransferModal(item)}
                                            >
                                                <ArrowRightLeft className="w-4 h-4"/>
                                                {t("topupCoins.list.transfer")}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <PaginationControls
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    onPrevious={handlePrevPage}
                    onNext={handleNextPage}
                    isLoading={showLoading}
                />

                <TransferConfirmModal
                    isOpen={isTransferModalOpen}
                    onClose={() => {
                        setIsTransferModalOpen(false);
                        setSelectedTransfer(null);
                    }}
                    onConfirm={confirmTransfer}
                    isLoading={isToppingUp}
                    transfer={
                        selectedTransfer
                            ? {
                                userName: selectedTransfer.localUser.email || t("topupCoins.transferModal.unknownUser"),
                                reason: "User paid via QR",
                                amount: selectedTransfer.topUpRequest.amountMinor / 100,
                                paymentCode: selectedTransfer.topUpRequest.paymentIntentId || undefined,
                                date: format(new Date(selectedTransfer.topUpRequest.createdAt), "dd MMM yyyy, HH:mm"),
                            }
                            : null
                    }
                />
            </div>
        </AdminLayout>
    );
};

export default TopUpCoins;