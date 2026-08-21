"use client";
import {ProfileImage} from "@/constants/images";
import Image from "next/image";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {useCallback, useEffect, useMemo, useState} from "react";
import {debounce} from "lodash";
import {CategoryId, IntendedUse, JobType, PostSortType, SearchCombinedView,} from "108jobs-client";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import JobBoardTab from "@/components/JobBoardTab";
import {useTranslation} from "react-i18next";
import {
    formatBudget,
    formatDate,
    getCategoriesAtLevel,
    getJobTypeLabel,
    toCamelCaseLastSegment
} from "@/utils/helpers";
import ErrorState from "@/components/ErrorState";
import {REQUEST_STATE} from "@/services/HttpService";
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
import {useCategories} from "@/hooks/api/categories/useCategories";
import {useDebounce} from "@/hooks/utils/useDebounce";
import {PaginationControls} from "@/components/PaginationControls";
import {faCoins} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {formatBudgetCompact} from "@/utils";
import {Badge} from "@/components/ui/Badge";

const ITEMS_PER_PAGE = 20;

interface FilterState {
    category: CategoryId | undefined;
    jobType: JobType | undefined;
    intendedUse: IntendedUse | undefined;
    budgetMin: number | undefined;
    budgetMax: number | undefined;
    sort: PostSortType | undefined;
}

const JobBoard = () => {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();

    const encoded = searchParams.get("q");
    const sanitizedQuery = encoded ? encoded.trim() : "";

    const [filters, setFilters] = useState<FilterState>({
        category: undefined,
        jobType: undefined,
        intendedUse: undefined,
        budgetMin: undefined,
        budgetMax: undefined,
        sort: undefined,
    });

    const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [budgetError, setBudgetError] = useState<string | null>(null);
    const categoriesResponse = useCategories();
    const catalogData = getCategoriesAtLevel(categoriesResponse.categories ?? undefined, 3);

    const debouncedFilters = useDebounce(filters, 500);

    const {
        state: searchState,
        data: jobPostsPagination,
        isMutating: isJobsLoading,
    } = useHttpGet("search", {
        type: "Posts",
        q: sanitizedQuery,
        categoryId: debouncedFilters.category,
        pageCursor: currentCursor,
        budgetMin: debouncedFilters.budgetMin,
        budgetMax: debouncedFilters.budgetMax,
        jobType: debouncedFilters.jobType,
        intendedUse: debouncedFilters.intendedUse,
        limit: ITEMS_PER_PAGE,
    });

    const hasPreviousPage = useMemo(() => cursorHistory.length > 0, [cursorHistory]);
    const hasNextPage = useMemo(() => !!jobPostsPagination?.nextPage, [jobPostsPagination?.nextPage]);
    const totalJobs = useMemo(() => jobPostsPagination?.results?.length || 0, [jobPostsPagination?.results]);

    const handleFilterChange = useCallback(
        (key: keyof FilterState, value: unknown) => {
            const newFilters: FilterState = {
                ...filters,
                [key]:
                    key === "category"
                        ? typeof value === "string" && value
                            ? parseInt(value)
                            : undefined
                        : value,
            };

            setFilters(newFilters);

            const params = new URLSearchParams(searchParams);

            if (newFilters.category)
                params.set("category", newFilters.category.toString());
            else params.delete("category");

            if (newFilters.jobType)
                params.set("jobType", newFilters.jobType);
            else params.delete("jobType");

            if (newFilters.intendedUse)
                params.set("intendedUse", newFilters.intendedUse);
            else params.delete("intendedUse");

            if (newFilters.budgetMin !== undefined)
                params.set("budgetMin", newFilters.budgetMin.toString());
            else params.delete("budgetMin");

            if (newFilters.budgetMax !== undefined)
                params.set("budgetMax", newFilters.budgetMax.toString());
            else params.delete("budgetMax");

            router.push(`?${params.toString()}`, {scroll: false});

            if (key === "budgetMin") setBudgetError(null);
        },
        [router, searchParams, filters]
    );


    const debouncedHandleBudgetInput = useMemo(
        () => debounce((type: 'min' | 'max', value: string) => {
            const numValue = value ? parseInt(value) : undefined;
            if (numValue !== undefined && numValue < 0) {
                setBudgetError(t("profileJob.budgetNegativeError"));
                return;
            }
            setBudgetError(null);
            handleFilterChange(type === 'min' ? 'budgetMin' : 'budgetMax', numValue);
        }, 50),
        [handleFilterChange, filters.budgetMin, t]
    );

    const handleNextPage = useCallback(() => {
        if (jobPostsPagination?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(jobPostsPagination.nextPage);
        }
    }, [jobPostsPagination?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
        }
    }, [cursorHistory]);

    const handleJobClick = useCallback(
        (jobId: number) => {
            router.push(`/job-board/${jobId}`);
        },
        [router]
    );

    const clearFilters = useCallback(() => {
        setFilters({
            category: undefined,
            jobType: undefined,
            intendedUse: undefined,
            budgetMin: undefined,
            budgetMax: undefined,
            sort: undefined,
        });

        router.push(`?q=${sanitizedQuery}`, {scroll: false});
    }, [router, sanitizedQuery]);


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
        setFilters((prev) => ({
            ...prev,
            category: searchParams.get("category")
                ? parseInt(searchParams.get("category")!)
                : undefined,
            jobType: (searchParams.get("jobType") as JobType) ?? undefined,
            intendedUse: (searchParams.get("intendedUse") as IntendedUse) ?? undefined,
            budgetMin: searchParams.get("budgetMin")
                ? parseInt(searchParams.get("budgetMin")!)
                : undefined,
            budgetMax: searchParams.get("budgetMax")
                ? parseInt(searchParams.get("budgetMax")!)
                : undefined,
            sort: (searchParams.get("sort") as PostSortType) ?? undefined,
        }));
    }, [searchParams]);

    useEffect(() => {
        setCurrentCursor(undefined);
        setCursorHistory([]);
    }, [filters.category, filters.sort, filters.budgetMin, filters.budgetMax, filters.jobType, filters.intendedUse]);

    useEffect(() => {
        setIsLoading(isJobsLoading);
    }, [isJobsLoading]);

    if (searchState.state === REQUEST_STATE.FAILED) {
        return (
            <ErrorState/>
        );
    }

    return (
        <div className="bg-[#F6F9FE] min-h-screen">
            <div className="max-w-[1283px] mx-auto py-8 px-4 md:px-6 lg:px-8 rounded-lg shadow-sm">
                <div className="mb-6 flex items-center justify-between space-x-4">
                    <div>
                        <h1 className="text-2xl font-bold text-primary mb-1">{t("profileJob.sectionJobBoard")}</h1>
                        <p className="text-gray-600">{t("profileJob.subtitleJobBoard")}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <Link
                            prefetch={false}
                            href={`/${i18n.language}/job-board/create-job`}
                            className="inline-flex items-center bg-primary text-white py-3 px-6 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                      d="M12 4v16m8-8H4"/>
                            </svg>
                            {t("profileJob.buttonPostJob")}
                        </Link>
                    </div>
                </div>

                <div className="border-1 border-borderPrimary bg-white p-4 rounded-lg">
                    <div className="border-b">
                        <JobBoardTab/>
                    </div>

                    <div
                        className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-lg p-6 sm:p-8 mb-8 space-y-6 md:space-y-0 md:flex md:flex-wrap md:items-end md:justify-between transition-all duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                            <div className="relative group">
                                <label
                                    htmlFor="category-filter"
                                    className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-hover:text-primary"
                                >
                                    {t("profileJob.dropdownSearchCategory")}
                                </label>
                                <select
                                    id="category-filter"
                                    className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-3 px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 hover:border-blue-300"
                                    value={filters.category || ""}
                                    onChange={(e) => handleFilterChange("category", e.target.value || undefined)}
                                    aria-label={t("profileJob.dropdownSearchCategory")}
                                >
                                    <option value="">{t("profileJob.dropdownSearchCategory")}</option>
                                    {catalogData.map((category) => (
                                        <option key={category.category.id} value={category.category.id}>
                                            {t(`catalogs.${toCamelCaseLastSegment(category.category.path)}`)}
                                        </option>
                                    ))}
                                </select>
                                <div
                                    className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 top-7">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </div>
                            </div>

                            <div className="relative group">
                                <label
                                    htmlFor="job-type-filter"
                                    className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-hover:text-primary"
                                >
                                    {t("profileJob.dropdownSearchType")}
                                </label>
                                <select
                                    id="job-type-filter"
                                    className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-3 px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 hover:border-blue-300"
                                    value={filters.jobType || ""}
                                    onChange={(e) => handleFilterChange("jobType", e.target.value as JobType || undefined)}
                                    aria-label={t("profileJob.dropdownSearchType")}
                                >
                                    <option value="">{t("profileJob.tableAllJobTypesPlaceholder")}</option>
                                    <option value={JobType.FullTime}>{getJobTypeLabel(JobType.FullTime, t)}</option>
                                    <option value={JobType.PartTime}>{getJobTypeLabel(JobType.PartTime, t)}</option>
                                    <option value={JobType.Contract}>{getJobTypeLabel(JobType.Contract, t)}</option>
                                    <option value={JobType.Freelance}>{getJobTypeLabel(JobType.Freelance, t)}</option>
                                </select>
                                <div
                                    className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 top-7">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </div>
                            </div>

                            <div className="relative group">
                                <label
                                    htmlFor="intended-use-filter"
                                    className="block text-sm font-semibold text-gray-700 mb-1.5 transition-colors group-hover:text-primary"
                                >
                                    {t("profileJob.dropdownSearchIntendedUse")}
                                </label>
                                <select
                                    id="intended-use-filter"
                                    className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-3 px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 hover:border-blue-300"
                                    value={filters.intendedUse || ""}
                                    onChange={(e) => handleFilterChange("intendedUse", e.target.value as IntendedUse || undefined)}
                                    aria-label={t("profileJob.dropdownSearchIntendedUse")}
                                >
                                    <option value="">{t("profileJob.tableAllIntendedUsesPlaceholder")}</option>
                                    <option
                                        value={IntendedUse.Personal}>{t("profileJob.tablePersonalSelection")}</option>
                                    <option
                                        value={IntendedUse.Business}>{t("profileJob.tableBusinessSelection")}</option>
                                    <option value={IntendedUse.Unknown}>{t("profileJob.tableUnknownSelection")}</option>
                                </select>
                                <div
                                    className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 top-7">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label
                                    className="block text-sm font-semibold text-gray-700">{t("profileJob.dropdownSearchBudget")}</label>
                                <div className="flex gap-3">
                                    <input
                                        id="budget-min"
                                        type="number"
                                        min="0"
                                        placeholder={t("profileJob.minBudgetPlaceholder")}
                                        value={filters.budgetMin || ""}
                                        onChange={(e) => debouncedHandleBudgetInput("min", e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 hover:border-blue-300"
                                        aria-label={t("profileJob.minBudgetPlaceholder")}
                                    />
                                    <input
                                        id="budget-max"
                                        type="number"
                                        min="0"
                                        placeholder={t("profileJob.maxBudgetPlaceholder")}
                                        value={filters.budgetMax || ""}
                                        onChange={(e) => debouncedHandleBudgetInput("max", e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 hover:border-blue-300"
                                        aria-label={t("profileJob.maxBudgetPlaceholder")}
                                    />
                                </div>
                                {budgetError && (
                                    <p className="text-sm text-red-600 mt-1">{budgetError}</p>
                                )}
                            </div>
                        </div>

                    </div>

                    {!isLoading && totalJobs > 0 && (
                        <div className="mb-4 text-sm text-gray-600">
                            {t("admin.showingJobs", {count: totalJobs, page: cursorHistory.length + 1})}
                        </div>
                    )}

                    {/* Replace the entire table section with this responsive block */}
                    <div className="overflow-x-auto border border-borderPrimary rounded-lg">
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <LoadingBlur text={""}/>
                            </div>
                        ) : jobPostsPagination?.results?.length ? (
                            <>
                                {/* Desktop & Tablet: Table Layout */}
                                <div className="hidden md:block">
                                    <table className="min-w-full divide-y divide-gray-200" role="table"
                                           aria-label="Job listings">
                                        <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                                                {t("profileJob.tableHeaderTitle")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                                                {t("profileJob.tableHeaderCategory")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                                                {t("profileJob.tableHeaderJobType")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                                                {t("profileJob.tableHeaderBudget")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                                                {t("profileJob.tableHeaderProposals")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                                {t("profileJob.tableHeaderPostDate")}
                                            </th>
                                            <th scope="col"
                                                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                                {t("profileJob.tableHeaderDeadline")}
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        {jobPostsPagination.results
                                            .filter((job: SearchCombinedView): job is Extract<SearchCombinedView, {
                                                type_: "Post"
                                            }> => job.type_ === "Post")
                                            .map((job) => (
                                                <tr
                                                    key={job.post.id}
                                                    onClick={() => handleJobClick(job.post.id)}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-start">
                                                            <div className="mr-3 mt-1 flex-shrink-0">
                                                                <svg className="h-5 w-5 text-gray-400"
                                                                     viewBox="0 0 24 24" fill="none">
                                                                    <path
                                                                        d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                                        stroke="currentColor" strokeWidth="2"
                                                                        strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Link
                                                                    prefetch={false}
                                                                    href={`/${i18n.language}/job-board/${job.post.id}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="hover:text-primary font-medium text-base text-text-primary block truncate max-w-[220px]"
                                                                    title={job.post.name || job.post.embedTitle || "Untitled"}
                                                                >
                                                                    {job.post.name || job.post.embedTitle || "Untitled"}
                                                                </Link>
                                                                {job.tags.length > 0 && (
                                                                    <div
                                                                        className="mt-1.5 flex flex-wrap gap-1.5 whitespace-normal max-w-[220px]">
                                                                        {job.tags.map((tag: { id?: string | number; displayName?: string }) => (
                                                                            <Badge
                                                                                key={tag.id}
                                                                                variant="outline"
                                                                                className="bg-gray-100 text-gray-800 border-gray-200"
                                                                            >
                                                                                {tag.displayName}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                                                        {t(`catalogs.${toCamelCaseLastSegment(job.category?.path)}`) || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                                                        {getJobTypeLabel(job.post.jobType, t)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900 font-medium">
                                                        {formatBudgetCompact(job.post.budget)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-text-primary">
                                                        {job.post.proposals}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-text-primary">
                                                        {formatDate(job.post.publishedAt)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-base text-text-primary">
                                                        {job.post.deadline ? formatDate(job.post.deadline) : "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile: Card Layout */}
                                <div className="md:hidden space-y-4 p-2">
                                    {jobPostsPagination.results
                                        .filter((job: SearchCombinedView): job is Extract<SearchCombinedView, {
                                            type_: "Post"
                                        }> => job.type_ === "Post")
                                        .map((job) => {
                                            const jobTypeLabel = getJobTypeLabel(job.post.jobType, t);

                                            const badgeColor: string = {
                                                [JobType.FullTime]: "bg-emerald-100 text-emerald-800",
                                                [JobType.PartTime]: "bg-blue-100 text-blue-800",
                                                [JobType.Contract]: "bg-purple-100 text-purple-800",
                                                [JobType.Freelance]: "bg-amber-100 text-amber-800",
                                            }[job.post.jobType as string] || "bg-gray-100 text-gray-800";

                                            return (
                                                <div
                                                    key={job.post.id}
                                                    onClick={() => handleJobClick(job.post.id)}
                                                    className="relative bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-gray-300 cursor-pointer transition-all duration-300 group overflow-hidden"
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            handleJobClick(job.post.id);
                                                        }
                                                    }}
                                                >
                                                    {/* Top section with title + badge (safe zone for long titles) */}
                                                    <div
                                                        className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                            <div
                                                                className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                                                <svg className="w-5 h-5 text-gray-500" fill="none"
                                                                     stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                                          strokeWidth={2}
                                                                          d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                                </svg>
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="text-lg font-bold text-text-primary leading-tight line-clamp-2 pr-20">
                                                                    {job.post.name || job.post.embedTitle || "Untitled"}
                                                                </h3>
                                                                {job.tags.length > 0 && (
                                                                    <div className="mt-2 flex flex-wrap gap-1.5 pr-20">
                                                                        {job.tags.map((tag: { id?: string | number; displayName?: string }) => (
                                                                            <Badge
                                                                                key={tag.id}
                                                                                variant="outline"
                                                                                className="bg-gray-100 text-gray-800 border-gray-200"
                                                                            >
                                                                                {tag.displayName}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Job Type Badge – positioned absolutely but with safe margin */}
                                                        <div className="absolute top-4 right-4 z-10">
                                                            <span
                                                                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${badgeColor}`}>
                                                                {jobTypeLabel}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Budget – big & bold */}
                                                    <div className="px-5">
                                                        <p className="text-2xl font-bold text-primary">
                                                            {formatBudgetCompact(job.post.budget)}
                                                            <FontAwesomeIcon
                                                                icon={faCoins}
                                                                className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                                                            />
                                                        </p>
                                                    </div>

                                                    {/* Details grid */}
                                                    <div
                                                        className="mt-5 px-5 pb-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm border-t border-gray-100 pt-4">
                                                        <div>
                                                            <p className="text-xs text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderCategory")}</p>
                                                            <p className="font-medium text-gray-900 truncate mt-0.5">
                                                                {t(`catalogs.${toCamelCaseLastSegment(job.category?.path)}`) || "-"}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderProposals")}</p>
                                                            <p className="font-semibold text-text-primary mt-0.5">
                                                                {job.post.proposals} proposal{job.post.proposals !== 1 && "s"}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderPostDate")}</p>
                                                            <p className="font-medium text-gray-900 mt-0.5">
                                                                {formatDate(job.post.publishedAt)}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderDeadline")}</p>
                                                            <p className="font-medium text-gray-900 mt-0.5">
                                                                {job.post.deadline ? formatDate(job.post.deadline) : "--"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="h-1 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                                                </div>
                                            );
                                        })}
                                </div>
                            </>
                        ) : (
                            /* No results state remains unchanged */
                            <div className="text-center py-12 px-4">
                                <div className="flex flex-col items-center">
                                    <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor"
                                         viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>
                                    <p className="text-lg font-medium text-gray-900">
                                        {hasActiveFilters || sanitizedQuery
                                            ? t("profileJob.noJobsTitleWithFilters")
                                            : t("profileJob.noJobsTitleNoFilters")}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2 max-w-md">
                                        {hasActiveFilters || sanitizedQuery
                                            ? t("profileJob.noJobsDescriptionWithFilters") +
                                            (sanitizedQuery ? ` Try searching for something else or adjusting filters.` : "")
                                            : t("profileJob.noJobsDescriptionNoFilters")}
                                    </p>
                                    {(hasActiveFilters || sanitizedQuery) && (
                                        <button onClick={clearFilters}
                                                className="mt-4 text-primary hover:text-blue-800 font-medium">
                                            {t("profileJob.clearAllFilters")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-center mt-8">
                        <PaginationControls
                            hasPrevious={hasPreviousPage}
                            hasNext={hasNextPage}
                            onPrevious={handlePrevPage}
                            onNext={handleNextPage}
                            isLoading={isLoading}
                        />
                    </div>

                    <div
                        className="mt-12 h-[148px] bg-[#D0E1FB] rounded-lg overflow-hidden flex justify-center items-center">
                        <Image src={ProfileImage.jobBoard} alt="Job Board"
                               priority={false}/>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobBoard;