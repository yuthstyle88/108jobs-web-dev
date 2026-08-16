"use client";

import {useState} from "react";
import {Card, CardContent} from "@/components/ui/Card";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Textarea} from "@/components/ui/Textarea";
import {Label} from "@/components/ui/Label";
import {Minus, CheckCircle, XCircle, Eye, CreditCard, Filter, ChevronDown, Loader2} from "lucide-react";
import {toast} from "sonner";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {PaginationControls} from "@/components/PaginationControls";
import {useTranslation} from "react-i18next";
import type {ListWithdrawRequestQuery, WithdrawRequestView, WithdrawStatus} from "108jobs-client";
import {Skeleton} from "@/components/ui/Skeleton";
import {cn} from "@/lib/utils";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCoins} from "@fortawesome/free-solid-svg-icons";
import {useDebounce} from "@/hooks/utils/useDebounce";
import {isSuccess, isFailed} from "@/services/HttpService";
import {format} from "date-fns";

const WithdrawCoins = () => {
    const {t} = useTranslation();

    const [filters, setFilters] = useState<ListWithdrawRequestQuery>({limit: 5});
    const [currentCursor, setCurrentCursor] = useState<string | undefined>();
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<WithdrawRequestView | null>(null);
    const [adminNote, setAdminNote] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const {data: bankListRes} = useHttpGet("listBanks");
    const bankList = bankListRes?.banks ?? [];

    const debouncedFilters = useDebounce(filters, 500);

    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("adminListWithdrawRequests", {
        ...debouncedFilters,
        pageCursor: currentCursor,
        pageBack: isGoingBack,
    });

    const withdrawRequests = data?.withdrawRequests ?? [];
    const hasNextPage = !!data?.nextPage;
    const hasPreviousPage = cursorHistory.length > 0;
    const isFetchFailed = isFailed(state);
    const showLoading = isLoading || isMutating;

    const {execute: approve, isMutating: approving} = useHttpPost("adminWithdrawWallet");
    const {execute: reject, isMutating: rejecting} = useHttpPost("adminRejectWithdrawRequest");

    const handleNextPage = () => {
        if (data?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(data.nextPage);
            setIsGoingBack(false);
        }
    };

    const handlePrevPage = () => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    };

    const handleApprove = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        const res = await approve({
            withdrawalId: request.withdrawRequest.id,
            reason: adminNote,
            targetUserId: request.localUser.id,
            amount: request.withdrawRequest.amount
        });
        if (isSuccess(res)) {
            toast.success(t("admin.withdraw.approved", {amount: request.withdrawRequest.amount.toLocaleString()}));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.withdraw.approveFailed"));
        }
    };

    const handleReject = async (request: WithdrawRequestView) => {
        if (!adminNote.trim()) {
            toast.warning(t("admin.withdraw.noteRequired"));
            return;
        }

        const res = await reject({withdrawalId: request.withdrawRequest.id, reason: adminNote});
        if (isSuccess(res)) {
            toast.success(t("admin.withdraw.rejected"));
            setAdminNote("");
            setSelectedRequest(null);
            await refetch();
        } else if (isFailed(res)) {
            toast.error(t("admin.withdraw.rejectFailed"));
        }
    };

    const getStatusConfig = (status: WithdrawStatus) => {
        const config: Partial<Record<WithdrawStatus, { color: string; icon: typeof Minus; label: string }>> = {
            Pending: { color: "bg-amber-500 text-white border-amber-400/30", icon: Minus, label: t("admin.withdraw.status.pending") },
            Completed: {
                color: "bg-green-600 text-white border-emerald-500/30",
                icon: CheckCircle,
                label: t("admin.withdraw.status.approved"),
            },
            Rejected: { color: "bg-red-500 text-white border-rose-500/30", icon: XCircle, label: t("admin.withdraw.status.rejected") },
        };
        return config[status] ?? { color: "bg-gray-500/15 text-gray-600", icon: Minus, label: status };
    };

    const getBankName = (bankId: number) => bankList.find((b) => b.id === bankId)?.name ?? t("admin.withdraw.unknownBank");

    const handleFilterChange = (key: keyof ListWithdrawRequestQuery, value: any) => {
        setFilters((prev: ListWithdrawRequestQuery) => ({...prev, [key]: value}));
    };

    const applyFilters = () => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
        setIsGoingBack(false);
    };

    const RequestSkeleton = () => (
        <div
            className="flex flex-col sm:flex-row justify-between p-5 bg-card rounded-2xl border border-border/50 backdrop-blur-sm animate-pulse">
            <div className="flex items-start gap-4 flex-1">
                <Skeleton className="w-11 h-11 rounded-lg"/>
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-48"/>
                    <Skeleton className="h-4 w-64"/>
                    <Skeleton className="h-4 w-56"/>
                </div>
            </div>
            <Skeleton className="h-9 w-24 mt-4 sm:mt-0"/>
        </div>
    );

    return (
        <AdminLayout>
            <div
                className="min-h-screen bg-gradient-to-br text-gray-600 from-slate-50 via-white to-blue-50/30 p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="backdrop-blur-xl bg-white/70 border border-white/20 rounded-3xl p-6 shadow-lg">
                        <h1 className="text-4xl font-bold bg-primary bg-clip-text text-transparent">
                            {t("admin.withdraw.title")}
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">{t("admin.withdraw.description")}</p>
                    </div>

                    {/* Filters (Collapsible) */}
                    <Card
                        className="backdrop-blur-xl bg-white/60 border-white/30 shadow-xl overflow-hidden transition-all duration-300">
                        <div
                            className="p-5 cursor-pointer flex items-center justify-between hover:bg-white/40 transition-colors"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <div className="flex items-center gap-3">
                                <Filter className="w-5 h-5"/>
                                <h3 className="font-semibold">{t("admin.withdraw.filters.title") || "Filters"}</h3>
                            </div>
                            <ChevronDown
                                className={cn("w-5 h-5 text-muted-foreground transition-transform", showFilters && "rotate-180")}/>
                        </div>

                        {showFilters && (
                            <div
                                className="px-5 pb-5 border-t border-border/50 pt-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                                    <div>
                                        <Label
                                            className="text-xs font-medium">{t("admin.withdraw.filters.status")}</Label>
                                        <select
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                            value={filters.status ?? ""}
                                            onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
                                        >
                                            <option value="">{t("admin.withdraw.filters.all")}</option>
                                            <option value="Pending">{t("admin.withdraw.status.pending")}</option>
                                            <option value="Completed">{t("admin.withdraw.status.approved")}</option>
                                            <option value="Rejected">{t("admin.withdraw.status.rejected")}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <Label
                                            className="text-xs font-medium">{t("admin.withdraw.filters.minAmount")}</Label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.amountMin ?? ""}
                                            onChange={(e) => handleFilterChange("amountMin", e.target.value ? Number(e.target.value) : undefined)}
                                        />
                                    </div>

                                    <div>
                                        <Label
                                            className="text-xs font-medium">{t("admin.withdraw.filters.maxAmount")}</Label>
                                        <input
                                            type="number"
                                            placeholder="999999"
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.amountMax ?? ""}
                                            onChange={(e) => handleFilterChange("amountMax", e.target.value ? Number(e.target.value) : undefined)}
                                        />
                                    </div>

                                    <div>
                                        <Label
                                            className="text-xs font-medium">{t("admin.withdraw.filters.year")}</Label>
                                        <select
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.year ?? ""}
                                            onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                                        >
                                            <option value="">{new Date().getFullYear()}</option>
                                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((y) => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <Label
                                            className="text-xs font-medium">{t("admin.withdraw.filters.month")}</Label>
                                        <select
                                            className="mt-1 w-full px-3 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-primary transition-all"
                                            value={filters.month ?? ""}
                                            onChange={(e) => handleFilterChange("month", e.target.value ? Number(e.target.value) : undefined)}
                                        >
                                            <option value="">MM</option>
                                            {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                                                <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-end">
                                        <Button onClick={applyFilters}
                                                className="w-full h-10 rounded-xl shadow-md hover:shadow-lg transition-all">
                                            {t("admin.withdraw.filters.apply")}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid gap-5 md:grid-cols-3">
                        {[
                            {
                                icon: Minus,
                                label: t("admin.withdraw.stats.pendingThisPage"),
                                color: "from-amber-400 to-orange-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Pending").length
                            },
                            {
                                icon: CheckCircle,
                                label: t("admin.withdraw.stats.approvedThisPage"),
                                color: "from-emerald-400 to-teal-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Completed").length
                            },
                            {
                                icon: XCircle,
                                label: t("admin.withdraw.stats.rejectedThisPage"),
                                color: "from-rose-400 to-pink-500",
                                value: withdrawRequests.filter((r: WithdrawRequestView) => r.withdrawRequest.status === "Rejected").length
                            },
                        ].map((stat, i) => (
                            <Card key={i}
                                  className="group relative overflow-hidden backdrop-blur-xl bg-white/70 border-white/30 shadow-lg hover:shadow-2xl transition-all duration-300">
                                <div
                                    className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", stat.color)}></div>
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="p-3 rounded-2xl bg-white/80 shadow-md group-hover:scale-110 transition-transform">
                                            <stat.icon className="w-7 h-7 text-gray-700"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{stat.label}</p>
                                            <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Main Content: List + Side Panel */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Request List */}
                        <div className="lg:col-span-2 space-y-4">
                            {showLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => <RequestSkeleton key={i}/>)}
                                </div>
                            ) : isFetchFailed ? (
                                <Card className="p-12 text-center bg-red-50 border-red-100">
                                    <div
                                        className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                        <CreditCard className="w-8 h-8 text-red-500"/>
                                    </div>
                                    <p className="text-lg font-medium text-red-600">{t("admin.withdraw.list.fetchError")}</p>
                                </Card>
                            ) : withdrawRequests.length === 0 ? (
                                <Card className="p-12 text-center backdrop-blur-xl bg-white/60 border-white/30">
                                    <div
                                        className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                        <CreditCard className="w-8 h-8 text-muted-foreground"/>
                                    </div>
                                    <p className="text-lg font-medium">{t("admin.withdraw.list.noResults")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("admin.withdraw.list.noResultsHint")}</p>
                                </Card>
                            ) : (
                                withdrawRequests.map((req: WithdrawRequestView) => {
                                    const w = req.withdrawRequest;
                                    const bank = req.bankAccount;
                                    const user = req.localUser;
                                    const status = getStatusConfig(w.status);

                                    return (
                                        <Card
                                            key={w.id}
                                            className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-2xl border border-white/40 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer select-none"
                                            onClick={() => {
                                                setSelectedRequest(req);
                                                setAdminNote("");
                                            }}
                                        >
                                            {/* Shimmer Effect */}
                                            <div
                                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"/>

                                            {/* Gradient Border Glow (on hover) */}
                                            <div
                                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                                <div
                                                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/30 via-purple-400/30 to-pink-400/30 blur-xl scale-110"/>
                                            </div>

                                            <div
                                                className="relative p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                                                {/* Left: Avatar + Info */}
                                                <div className="flex items-start gap-4 flex-1">
                                                    {/* Gradient Icon Avatar */}
                                                    <div
                                                        className="relative p-3.5 rounded-2xl shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                                        <CreditCard className="w-6 h-6 text-primary drop-shadow-md"/>
                                                        {/* Pulse Ring */}
                                                        <div
                                                            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 to-transparent opacity-0 group-hover:opacity-100 animate-pulse"/>
                                                    </div>

                                                    {/* Text Content */}
                                                    <div className="flex-1 space-y-3">
                                                        {/* User + Status */}
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <h4 className="font-bold text-lg truncate max-w-[200px] sm:max-w-none group-hover:text-primary transition-colors">
                                                                {user.email}
                                                            </h4>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-xs font-semibold px-2.5 py-0.5 border rounded-full shadow-sm transition-all duration-300",
                                                                    status.color,
                                                                    "group-hover:scale-105"
                                                                )}
                                                            >
                                                                <status.icon className="w-3.5 h-3.5 mr-1.5"/>
                                                                {status.label}
                                                            </Badge>
                                                        </div>

                                                        {/* Details Grid */}
                                                        <div
                                                            className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"/>
                                                                <span className="font-medium">{t("admin.withdraw.fields.amount")}</span>
                                                                <span className="font-bold">
                            {w.amount.toLocaleString()}
                                                                    <span
                                                                        className="text-xs font-normal text-muted-foreground"> <FontAwesomeIcon
                                                                        icon={faCoins}
                                                                        className="text-xl text-yellow-500 transition-transform hover:scale-110"
                                                                    /></span>
                        </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"/>
                                                                <span className="font-medium">{t("admin.withdraw.fields.bank")}</span>
                                                                <span
                                                                    className="truncate max-w-[120px]">{getBankName(bank.bankId)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Account + Date */}
                                                        <div
                                                            className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-muted-foreground/80 mt-1">
                                                            {/* Account Line */}
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">{t("admin.withdraw.fields.account")}</span>
                                                                <span className="font-mono text-foreground/90 truncate">
            {bank.accountName} • **** {bank.accountNumber.slice(-4)}
        </span>
                                                            </div>

                                                            {/* Requested Line */}
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <span
                                                                    className="font-medium text-foreground/70 whitespace-nowrap">{t("admin.withdraw.fields.requested")}</span>
                                                                <span className="font-mono text-foreground/90">
            {format(new Date(w.createdAt), "MMM d, HH:mm")}
        </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Action Button */}
                                                <div className="flex justify-end w-full sm:w-auto">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={cn(
                                                            "group/btn relative overflow-hidden rounded-xl px-4 py-2 font-medium text-primary hover:text-primary-foreground transition-all duration-300",
                                                            "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/10 before:via-primary/20 before:to-primary/10 before:-translate-x-full before:transition-transform before:duration-700",
                                                            "hover:before:translate-x-full hover:shadow-lg hover:scale-105"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRequest(req);
                                                            setAdminNote("");
                                                        }}
                                                    >
                                                        <Eye
                                                            className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform"/>
                                                        {t("admin.withdraw.review")}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Bottom Accent Bar */}
                                            <div
                                                className={cn(
                                                    "absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                                    w.status === "Pending" && "from-amber-400 to-orange-500",
                                                    w.status === "Completed" && "from-emerald-400 to-teal-500",
                                                    w.status === "Rejected" && "from-rose-400 to-pink-500"
                                                )}
                                            />
                                        </Card>
                                    );
                                })
                            )}
                        </div>

                        {/* Side Panel */}
                        <div className="space-y-6">
                            {selectedRequest && (
                                <Card
                                    className="sticky top-6 text-gray-600 backdrop-blur-xl bg-white/80 border-white/40 shadow-2xl overflow-hidden">
                                    <div
                                        className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-pink-500/5"></div>
                                    <CardContent className="p-6 space-y-5 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-lg">{selectedRequest.localUser.email}</h4>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => setSelectedRequest(null)}
                                            >
                                                <XCircle className="w-4 h-4"/>
                                            </Button>
                                        </div>

                                        <div
                                            className="p-5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-500/20">
                                            <p className="text-3xl font-bold">
                                                {selectedRequest.withdrawRequest.amount.toLocaleString()} <span
                                                className="text-lg font-normal text-muted-foreground">coins</span>
                                            </p>
                                        </div>

                                        <div className="space-y-3 text-sm">
                                            <h5 className="font-semibold">{t("admin.withdraw.bankInfo")}:</h5>
                                            <div className="space-y-2 p-3 bg-muted/30 rounded-xl">
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.bank")}</span> {getBankName(selectedRequest.bankAccount.bankId)}
                                                </div>
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.accountNumber")}</span> {selectedRequest.bankAccount.accountNumber}
                                                </div>
                                                <div><span
                                                    className="font-medium">{t("admin.withdraw.fields.name")}</span> {selectedRequest.bankAccount.accountName}
                                                </div>
                                            </div>
                                        </div>

                                        {selectedRequest.withdrawRequest.reason && (
                                            <div className="space-y-2">
                                                <h5 className="font-semibold text-sm">{t("admin.withdraw.reason")}:</h5>
                                                <p className="text-sm p-3 bg-muted/30 rounded-xl text-muted-foreground italic">
                                                    &quot;{selectedRequest.withdrawRequest.reason}&quot;
                                                </p>
                                            </div>
                                        )}

                                        {selectedRequest.withdrawRequest.status === "Pending" && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="admin-note" className="font-medium">
                                                        {t("admin.withdraw.adminNote")} <span
                                                        className="text-red-500">*</span>
                                                    </Label>
                                                    <Textarea
                                                        id="admin-note"
                                                        placeholder={t("admin.withdraw.notePlaceholder")}
                                                        value={adminNote}
                                                        onChange={(e) => setAdminNote(e.target.value)}
                                                        className="resize-none rounded-xl focus:ring-2 focus:ring-primary"
                                                        rows={3}
                                                    />
                                                </div>

                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleReject(selectedRequest)}
                                                        className="flex-1 border-rose-500/30 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                                        disabled={!adminNote.trim() || rejecting}
                                                    >
                                                        {rejecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> :
                                                            <XCircle className="w-4 h-4 mr-2"/>}
                                                        {t("admin.withdraw.reject")}
                                                    </Button>

                                                    <Button
                                                        onClick={() => handleApprove(selectedRequest)}
                                                        className="flex-1 bg-primary text-white shadow-lg disabled:opacity-50"
                                                        disabled={!adminNote.trim() || approving}
                                                    >
                                                        {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> :
                                                            <CheckCircle className="w-4 h-4 mr-2"/>}
                                                        {t("admin.withdraw.approve")}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-center">
                        <PaginationControls
                            hasPrevious={hasPreviousPage}
                            hasNext={hasNextPage}
                            onPrevious={handlePrevPage}
                            onNext={handleNextPage}
                            isLoading={showLoading}
                        />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default WithdrawCoins;