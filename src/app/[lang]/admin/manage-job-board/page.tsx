"use client";

import {ProfileImage} from "@/constants/images";
import Image from "next/image";
import Link from "next/link";
import {useRouter, useSearchParams, usePathname} from "next/navigation";
import {useCallback, useEffect, useMemo, useState} from "react";
import {
    CategoryId,
    IntendedUse,
    JobType,
    PostSortType,
    SearchCombinedView,
} from "@108-plaza/jh-client";
import {useTranslation} from "react-i18next";
import {
    formatBudget,
    formatDate,
    getCategoriesAtLevel,
    getJobTypeLabel,
    toCamelCaseLastSegment,
} from "@/utils/helpers";
import ErrorState from "@/components/ErrorState";
import {REQUEST_STATE, isSuccess, isFailed} from "@/services/HttpService";
import {useCategories} from "@/hooks/api/categories/useCategories";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faEye,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
import {toast} from "sonner";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useDebounce} from "@/hooks/utils/useDebounce";
import {useCursorPagination} from "@/hooks/data/useCursorPagination";
import {PaginationControls} from "@/components/PaginationControls";

const ITEMS_PER_PAGE = 20;

interface FilterState {
    category: CategoryId | undefined;
    jobType: JobType | undefined;
    intendedUse: IntendedUse | undefined;
    budgetMin: number | undefined;
    budgetMax: number | undefined;
    sort: PostSortType | undefined;
}

const AdminJobBoard = () => {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? decodeURIComponent(encoded).trim() : "";

    const [searchInput, setSearchInput] = useState(sanitizedQuery);

    useEffect(() => {
        setSearchInput(sanitizedQuery);
    }, [sanitizedQuery]);

    const handleSearchSubmit = useCallback(() => {
        const params = new URLSearchParams(searchParams);
        const trimmed = searchInput.trim();
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        router.push(`${pathname}?${params.toString()}`, {scroll: false});
    }, [searchInput, searchParams, router, pathname]);

    const [filters, setFilters] = useState<FilterState>({
        category: undefined,
        jobType: undefined,
        intendedUse: undefined,
        budgetMin: undefined,
        budgetMax: undefined,
        sort: undefined,
    });
    const pager = useCursorPagination();
    const [budgetError, setBudgetError] = useState<string | null>(null);

    const categoriesResponse = useCategories();
    const catalogData = getCategoriesAtLevel(categoriesResponse.categories ?? undefined, 3);

    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
        execute: refreshJobs,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: filters.category,
        pageCursor: pager.currentCursor,
        pageBack: pager.isGoingBack,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        jobType: filters.jobType,
        intendedUse: filters.intendedUse,
        limit: ITEMS_PER_PAGE,
    });

    const {execute: deleteJob} = useHttpDelete("deletePost");

    const totalJobs = useMemo(() => jobPostsPagination?.results?.length || 0, [jobPostsPagination?.results]);

    const handleFilterChange = useCallback(
        (key: keyof FilterState, value: unknown) => {
            pager.resetPagination();
            let updatedFilters: FilterState;

            setFilters((prev) => {
                updatedFilters = {
                    ...prev,
                    [key]:
                        key === "category"
                            ? typeof value === "string" && value
                                ? parseInt(value)
                                : undefined
                            : value,
                };
                return updatedFilters;
            });

            queueMicrotask(() => {
                const params = new URLSearchParams(searchParams);
                if (updatedFilters.category) params.set("category", updatedFilters.category.toString());
                else params.delete("category");
                if (updatedFilters.jobType) params.set("jobType", updatedFilters.jobType);
                else params.delete("jobType");
                if (updatedFilters.intendedUse) params.set("intendedUse", updatedFilters.intendedUse);
                else params.delete("intendedUse");
                if (updatedFilters.budgetMin) params.set("budgetMin", updatedFilters.budgetMin.toString());
                else params.delete("budgetMin");
                if (updatedFilters.budgetMax) params.set("budgetMax", updatedFilters.budgetMax.toString());
                else params.delete("budgetMax");
                if (updatedFilters.sort) params.set("sort", updatedFilters.sort);
                else params.delete("sort");

                router.push(`?${params.toString()}`, {scroll: false});
            });
        },
        [router, searchParams, pager]
    );

    const [budgetInputs, setBudgetInputs] = useState({min: "", max: ""});
    const debouncedBudget = useDebounce(budgetInputs, 500);

    useEffect(() => {
        const {min, max} = debouncedBudget;
        const minValue = min ? parseInt(min) : undefined;
        const maxValue = max ? parseInt(max) : undefined;

        if (minValue !== undefined && minValue < 0) {
            setBudgetError(t("profileJob.budgetNegativeError"));
            return;
        }
        setBudgetError(null);
        handleFilterChange("budgetMin", minValue);
        handleFilterChange("budgetMax", maxValue);
    }, [debouncedBudget, handleFilterChange, t]);

    const handleBudgetInput = (type: "min" | "max", value: string) => {
        setBudgetInputs((prev) => ({...prev, [type]: value}));
    };

    const handleDelete = async (jobId: number) => {
        if (!confirm(t("admin.confirmDeleteJob"))) return;

        const res = await deleteJob({postId: jobId});
        if (isSuccess(res)) {
            toast.success(t("admin.jobDeleted"));
            refreshJobs();
        } else if (isFailed(res)) {
            toast.error(t("admin.jobDeleteFailed"));
        }
    };

    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
        });
        setBudgetInputs({min: "", max: ""});
        setBudgetError(null);
        router.push(pathname, {scroll: false});
    }, [router, pathname]);

    const hasActiveFilters = useMemo(
        () =>
            filters.category ||
            filters.jobType ||
            filters.intendedUse ||
            filters.budgetMin ||
            filters.budgetMax ||
            filters.sort,
        [filters]
    );

    useEffect(() => {
        setFilters({
            category: searchParams.get("category") ? parseInt(searchParams.get("category")!) : undefined,
            jobType: searchParams.get("jobType") as JobType | undefined,
            intendedUse: searchParams.get("intendedUse") as IntendedUse | undefined,
            budgetMin: searchParams.get("budgetMin") ? parseInt(searchParams.get("budgetMin")!) : undefined,
            budgetMax: searchParams.get("budgetMax") ? parseInt(searchParams.get("budgetMax")!) : undefined,
            sort: searchParams.get("sort") as PostSortType | undefined,
        });
    }, [searchParams]);

    useEffect(() => {
        pager.resetPagination();
    }, [
        filters.category,
        filters.sort,
        filters.budgetMin,
        filters.budgetMax,
        filters.jobType,
        filters.intendedUse,
        sanitizedQuery,
        pager,
    ]);

    if (searchState.state === REQUEST_STATE.FAILED) {
        return (
            <AdminLayout>
                <ErrorState/>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="bg-[#F6F9FE] text-gray-600 min-h-screen">
                <div className="max-w-[1400px] mx-auto py-8 px-4 md:px-6 lg:px-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-primary mb-1">
                                {t("admin.jobBoardManagement")}
                            </h1>
                            <p className="text-gray-600">{t("admin.jobBoardSubtitle")}</p>
                        </div>
                        <Link
                            href={`/${i18n.language}/job-board/create-job`}
                            className="inline-flex items-center bg-primary text-white py-3 px-6 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            {t("profileJob.buttonPostJob")}
                        </Link>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-borderPrimary p-6">
                        {/* Filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                            {/* Search */}
                            <div className="flex gap-2 sm:col-span-2">
                                <input
                                    type="search"
                                    placeholder={t("admin.jobBoardSearchPlaceholder")}
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSearchSubmit();
                                    }}
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                />
                                <button
                                    onClick={handleSearchSubmit}
                                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                                >
                                    {t("admin.jobBoardSearchButton")}
                                </button>
                            </div>

                            {/* Category */}
                            <select
                                value={filters.category || ""}
                                onChange={(e) => handleFilterChange("category", e.target.value || undefined)}
                                className="px-4 py-2 border rounded-lg text-sm"
                            >
                                <option value="">{t("profileJob.dropdownSearchCategory")}</option>
                                {catalogData.map((cat) => (
                                    <option key={cat.category.id} value={cat.category.id}>
                                        {t(`catalogs.${toCamelCaseLastSegment(cat.category.path)}`)}
                                    </option>
                                ))}
                            </select>

                            {/* Job Type */}
                            <select
                                value={filters.jobType || ""}
                                onChange={(e) => handleFilterChange("jobType", e.target.value as JobType || undefined)}
                                className="px-4 py-2 border rounded-lg text-sm"
                            >
                                <option value="">{t("profileJob.tableAllJobTypesPlaceholder")}</option>
                                {Object.values(JobType).map((type) => (
                                    <option key={type} value={type}>
                                        {getJobTypeLabel(type, t)}
                                    </option>
                                ))}
                            </select>

                            {/* Budget Min/Max */}
                            <div className="flex gap-2 col-span-2">
                                <input
                                    type="number"
                                    placeholder={t("profileJob.minBudgetPlaceholder")}
                                    value={budgetInputs.min}
                                    onChange={(e) => handleBudgetInput("min", e.target.value)}
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder={t("profileJob.maxBudgetPlaceholder")}
                                    value={budgetInputs.max}
                                    onChange={(e) => handleBudgetInput("max", e.target.value)}
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        {budgetError && <p className="text-red-600 text-sm mb-4">{budgetError}</p>}

                        {/* Results Count */}
                        {!isJobsLoading && totalJobs > 0 && (
                            <p className="text-sm text-gray-600 mb-4">
                                {t("admin.showingJobs", {count: totalJobs, page: pager.cursorHistory.length + 1})}
                            </p>
                        )}

                        {/* Table */}
                        <div className="overflow-x-auto">
                            {isJobsLoading ? (
                                <div className="py-12 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderTitle")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderCategory")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderJobType")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderBudget")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderProposals")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderPostDate")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("admin.status")}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {t("profileJob.tableHeaderActions")}
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {jobPostsPagination?.results
                                        ?.filter((job): job is Extract<SearchCombinedView, {
                                            type_: "Post"
                                        }> => job.type_ === "Post")
                                        .map((job) => (
                                            <tr key={job.post.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">
                                                    <Link href={`/job-board/${job.post.id}`}
                                                          className="hover:text-primary">
                                                        {job.post.name || job.post.embedTitle || "Untitled"}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {t(`catalogs.${toCamelCaseLastSegment(job.category?.path)}`) || "-"}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {getJobTypeLabel(job.post.jobType, t)}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                    {formatBudget(job.post.budget)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{job.post.proposals}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {formatDate(job.post.publishedAt)}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                          <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  job.post.removed
                                      ? "bg-red-100 text-red-800"
                                      : "bg-green-100 text-green-800"
                              }`}
                          >
                            {job.post.removed ? t("admin.hidden") : t("admin.visible")}
                          </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => router.push(`/${i18n.language}/job-board/${job.post.id}`)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                            title={t("global.view")}
                                                        >
                                                            <FontAwesomeIcon icon={faEye}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(job.post.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title={t("global.delete")}
                                                        >
                                                            <FontAwesomeIcon icon={faTrash}/>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    {totalJobs === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-500">
                                                <div className="flex flex-col items-center">
                                                    <svg className="w-16 h-16 text-gray-300 mb-4" fill="none"
                                                         stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth="2"
                                                              d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                    </svg>
                                                    <p className="text-lg font-medium">
                                                        {hasActiveFilters || sanitizedQuery
                                                            ? t("admin.noJobsWithFilters")
                                                            : t("admin.noJobsFound")}
                                                    </p>
                                                    {(hasActiveFilters || sanitizedQuery) && (
                                                        <button onClick={clearFilters}
                                                                className="mt-3 text-primary hover:underline">
                                                            {t("profileJob.clearAllFilters")}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <PaginationControls
                            hasPrevious={pager.hasPreviousPage}
                            hasNext={!!jobPostsPagination?.nextPage}
                            onPrevious={pager.handlePrevPage}
                            onNext={() => pager.handleNextPage(jobPostsPagination?.nextPage)}
                            isLoading={isJobsLoading}
                        />
                    </div>

                    <div
                        className="mt-12 h-[148px] bg-[#D0E1FB] rounded-lg overflow-hidden flex justify-center items-center">
                        <Image src={ProfileImage.jobBoard} alt="Admin Job Board"/>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminJobBoard;