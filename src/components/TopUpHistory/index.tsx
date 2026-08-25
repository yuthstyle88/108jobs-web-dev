"use client";
import {faInfoCircle, faSync} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useTranslation} from "react-i18next";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useMemo, useState} from "react";
import {CategoryNodeView, ListTopUpRequestQuery, TopUpRequestView} from "108heros-client";
import {format} from "date-fns";
import {formatMinor} from "@/utils/format/money";

import {useCursorPagination} from "@/hooks/data/useCursorPagination";
import {PaginationControls} from "@/components/PaginationControls";

const TopUpHistory = () => {
    const {t} = useTranslation();

    // Filters state
    const [filters, setFilters] = useState<ListTopUpRequestQuery>({
        status: undefined,
        amountMinMinor: undefined,
        amountMaxMinor: undefined,
        limit: 5,
    });

    const pager = useCursorPagination();

    const {data, isLoading, execute: refetch} = useHttpGet("listTopUpRequests", {
        ...filters,
        pageCursor: pager.currentCursor,
    });

    const topUps: TopUpRequestView[] = data?.topUpRequests ?? [];

    const handleFilterChange = (key: keyof ListTopUpRequestQuery, value: any) => {
        setFilters((prev: ListTopUpRequestQuery) => ({...prev, [key]: value}));
        pager.resetPagination();
    };

    const handleRefresh = () => {
        refetch();
    };

    // Helper: Get status badge style
    const getStatusStyle = (status: string) => {
        switch (status) {
            case "Success":
                return "bg-emerald-100 text-green-800";
            case "Pending":
                return "bg-amber-100 text-yellow-700";
            case "Expired":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    // Helper: Get status icon
    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Success":
                return (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case "Pending":
                return (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case "Expired":
                return (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="text-3xl font-bold text-gray-900">
                    {t("profileCoins.sectionTopUpHistory")}
                </h2>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 disabled:opacity-60"
                >
                    <FontAwesomeIcon
                        icon={faSync}
                        className={`text-primary text-sm ${isLoading ? "animate-spin" : ""}`}
                    />
                    <span className="text-sm font-medium text-gray-700">{t("profileCoins.Refresh")}</span>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl text-gray-600 shadow-sm border border-gray-200 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("profileCoins.Status")}
                        </label>
                        <select
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-base"
                            value={filters.status ?? ""}
                            onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
                        >
                            <option value="">{t("profileCoins.AllStatus")}</option>
                            <option value="Pending">{t("profileCoins.Pending")}</option>
                            <option value="Success">{t("profileCoins.Success")}</option>
                            <option value="Expired">{t("profileCoins.Expired")}</option>
                        </select>
                    </div>

                    {/* Min Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("profileCoins.MinAmount")}
                        </label>
                        <input
                            type="number"
                            placeholder={t("e.g. 1000")}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder-gray-400 text-base"
                            value={filters.amountMinMinor !== undefined ? filters.amountMinMinor / 100 : ""}
                            onChange={(e) =>
                                handleFilterChange("amountMinMinor", e.target.value ? Number(e.target.value) * 100 : undefined)
                            }
                        />
                    </div>

                    {/* Max Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("profileCoins.MaxAmount")}
                        </label>
                        <input
                            type="number"
                            placeholder={t("e.g. 50000")}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder-gray-400 text-base"
                            value={filters.amountMaxMinor !== undefined ? filters.amountMaxMinor / 100 : ""}
                            onChange={(e) =>
                                handleFilterChange("amountMaxMinor", e.target.value ? Number(e.target.value) * 100 : undefined)
                            }
                        />
                    </div>

                    {/* Date Filter Group */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            {t("profileCoins.DateOptional")}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Year */}
                            <select
                                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-base"
                                value={filters.year ?? ""}
                                onChange={(e) => handleFilterChange("year", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("profileCoins.Year")}</option>
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>

                            {/* Month */}
                            <select
                                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-base"
                                value={filters.month ?? ""}
                                onChange={(e) => handleFilterChange("month", e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">{t("profileCoins.Month")}</option>
                                {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>
                                        {m.toString().padStart(2, "0")}
                                    </option>
                                ))}
                            </select>

                            {/* Day */}
                            <select
                                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-base"
                                value={filters.day ?? ""}
                                onChange={(e) => handleFilterChange("day", e.target.value ? Number(e.target.value) : undefined)}
                                disabled={!filters.year || !filters.month}
                            >
                                <option value="">{t("profileCoins.Day")}</option>
                                {(() => {
                                    const year = filters.year;
                                    const month = filters.month;
                                    if (!year || !month) return Array.from({length: 31}, (_, i) => i + 1);

                                    const daysInMonth = new Date(year, month, 0).getDate();
                                    return Array.from({length: daysInMonth}, (_, i) => i + 1);
                                })().map((d) => (
                                    <option key={d} value={d}>
                                        {d.toString().padStart(2, "0")}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Apply Filter */}
                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                pager.resetPagination();
                                refetch();
                            }}
                            className="w-full px-5 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V20a1 1 0 01-1.555.832l-4-2.5A1 1 0 013 17.5v-3.086a1 1 0 00-.293-.707L.293 7.293A1 1 0 010 6.586V4z"
                                />
                            </svg>
                            {t("profileCoins.ApplyFilter")}
                        </button>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div
                className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-8 flex items-start gap-3 shadow-sm">
                <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-xl mt-0.5 flex-shrink-0"/>
                <p className="text-sm text-blue-800 leading-relaxed">
                    {t("profileCoins.noteBalanceUpdate")}
                </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <tr>
                            {["PaymentCode", "Date", "Amount", "Status"].map((header) => (
                                <th
                                    key={header}
                                    className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                                >
                                    {t(`profileCoins.${header}`)}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="text-center py-12">
                                    <div className="flex justify-center items-center">
                                        <div
                                            className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-500">{t("profileCoins.Loading")}</p>
                                </td>
                            </tr>
                        ) : topUps.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-16">
                                    <div className="text-gray-400">
                                        <svg
                                            className="mx-auto h-12 w-12"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                            />
                                        </svg>
                                        <p className="mt-3 text-sm font-medium text-gray-600">{t("No topups found")}</p>
                                        <p className="mt-1 text-xs text-gray-500">{t("Try adjusting your filters")}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            topUps.map((item) => (
                                <tr
                                    key={item.topUpRequest.id}
                                    className="hover:bg-gray-50 transition-colors duration-150"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <code className="text-sm font-mono text-primary bg-gray-100 px-2 py-1 rounded">
                                            {item.topUpRequest.paymentIntentId}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {format(new Date(item.topUpRequest.createdAt), "dd MMM yyyy, HH:mm")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {formatMinor(item.topUpRequest.amountMinor)}
                                        </span>{" "}
                                        <span className="text-xs text-gray-500 uppercase">
                                            {/* TODO: source currency code from a currencies lookup once
                                                 multi-currency wallet schema is wired. Backend sends
                                                 currencyId (number) only; the old `currencyName`
                                                 field never existed on the wire so this span was
                                                 always blank — preserve that visual until the
                                                 lookup is added. */}
                                            {""}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(
                                                item.topUpRequest.status
                                            )}`}
                                        >
                                            {getStatusIcon(item.topUpRequest.status)}
                                            {t(`profileCoins.${item.topUpRequest.status}`)}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <PaginationControls
                hasPrevious={pager.hasPreviousPage}
                hasNext={Boolean(data?.nextPage)}
                onPrevious={pager.handlePrevPage}
                onNext={() => pager.handleNextPage(data?.nextPage)}
                isLoading={isLoading}
            />
        </div>
    );
};

export default TopUpHistory;