"use client";
import {Badge} from "@/components/ui/Badge";
import {ProfileImage} from "@/constants/images";
import {formatBudgetCompact, formatDateTime} from "@/utils";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useState} from "react";
import ConfirmCloseJob from "@/components/Common/Modal/ConfirmCloseJobsModal";
import JobBoardTab from "@/components/JobBoardTab";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useTranslation} from "react-i18next";
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
import {getJobTypeLabel} from "@/utils/helpers";
import {JobType} from "108jobs-client";
import {PaginationControls} from "@/components/PaginationControls";
import {faCoins} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

const ITEMS_PER_PAGE = 20;

const MyJobs = () => {
    const {t, i18n} = useTranslation();
    const router = useRouter();

    const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const {
        data: response,
        isMutating: isJobsLoading,
    } = useHttpGet("listPersonCreated", {
        pageCursor: currentCursor,
        limit: ITEMS_PER_PAGE,
    });

    const jobPosts = response?.created || [];
    const [selectedJob, setSelectedJob] = useState<{ id: string } | null>(null);

    const handleCloseModal = () => setSelectedJob(null);
    const handleConfirmDelete = async () => {
        if (selectedJob) setSelectedJob(null);
    };

    const hasPreviousPage = useMemo(() => cursorHistory.length > 0, [cursorHistory]);
    const hasNextPage = useMemo(() => !!response?.nextPage, [response?.nextPage]);

    const handleNextPage = useCallback(() => {
        if (response?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(response.nextPage);
        }
    }, [response?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
        }
    }, [cursorHistory]);

    useEffect(() => {
        setIsLoading(isJobsLoading);
    }, [isJobsLoading]);

    const getStatusBadge = (isOpen: boolean) => {
        return isOpen ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                {t("global.open")}
            </Badge>
        ) : (
            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                {t("global.closed")}
            </Badge>
        );
    };

    const getJobTypeBadgeColor = (type: JobType) => {
        const colors = {
            [JobType.FullTime]: "bg-emerald-100 text-emerald-800",
            [JobType.PartTime]: "bg-blue-100 text-blue-800",
            [JobType.Contract]: "bg-purple-100 text-purple-800",
            [JobType.Freelance]: "bg-amber-100 text-amber-800",
        };
        return colors[type] || "bg-gray-100 text-gray-800";
    };

    return (
        <div className="bg-[#F6F9FE] min-h-screen">
            <div className="bg-gradient-to-b min-h-screen py-12 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="border-1 border-borderPrimary bg-white p-4 rounded-lg">
                        <div className="border-b">
                            <JobBoardTab/>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            {isJobsLoading ? (
                                <div className="py-32 text-center">
                                    <LoadingBlur text={t("profileJob.loadingJobs")}/>
                                </div>
                            ) : jobPosts.length > 0 ? (
                                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                        <tr>
                                            {[
                                                "tableHeaderTitle",
                                                "tableHeaderBudget",
                                                "tableHeaderStatus",
                                                "tableHeaderJobType",
                                                "tableHeaderPostDate",
                                                "tableHeaderProposals",
                                                "tableHeaderDeadline",
                                                "tableHeaderActions",
                                            ].map((header) => (
                                                <th key={header}
                                                    className="px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                    {t(`profileJob.${header}`)}
                                                </th>
                                            ))}
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                        {jobPosts.map((job: any, index: number) => (
                                            <tr
                                                key={job.post.id}
                                                className="group cursor-pointer transition-all duration-300 hover:bg-blue-50/60 hover:shadow-md hover:-translate-y-0.5"
                                                style={{transitionDelay: `${index * 50}ms`}}
                                                onClick={() => router.push(`/${i18n.language}/job-board/${job.post.id}`)}
                                            >
                                                <td className="px-6 py-6 w-full max-w-0">
                                                    <div className="flex items-center space-x-4">
                                                        <div
                                                            className="flex-shrink-0 w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                                                            <svg className="w-6 h-6 text-blue-600" fill="none"
                                                                 stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={2}
                                                                      d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                            </svg>
                                                        </div>
                                                        {/* Truncated Title with Tooltip */}
                                                        <span
                                                            className="font-semibold text-gray-900  transition-colors line-clamp-2">
                                                            {job.post.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                        <span className="text-lg font-bold text-gray-900">
                                                            {formatBudgetCompact(job.post.budget)}
                                                        </span>
                                                    <FontAwesomeIcon
                                                        icon={faCoins}
                                                        className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                                                    />
                                                </td>
                                                <td className="px-6 py-6">{getStatusBadge(!job.post.pending)}</td>
                                                <td className="px-6 py-6">
                                                    <Badge
                                                        className={`font-semibold ${getJobTypeBadgeColor(job.post.jobType)}`}>
                                                        {getJobTypeLabel(job.post.jobType, t)}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-6 text-sm text-gray-600 font-medium">
                                                    {formatDateTime(job.post.publishedAt, "datetime")}
                                                </td>
                                                <td className="px-6 py-6">
                                                        <span
                                                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                                                            {job.post.proposals}
                                                        </span>
                                                </td>
                                                <td className="px-6 py-6 text-sm text-gray-600">
                                                    {job.post.deadline ? formatDateTime(job.post.deadline, "date") : "—"}
                                                </td>
                                                <td className="px-6 py-6">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/${i18n.language}/job-board/edit/${job.post.id}`);
                                                        }}
                                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 hover:shadow-md transform hover:scale-105 transition-all duration-200"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                             viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={2}
                                                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                        </svg>
                                                        {t("profileJob.tableHeaderActionEdit")}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-24">
                                    <div className="bg-gray-50 rounded-2xl py-16 max-w-md mx-auto">
                                        <p className="text-2xl font-bold text-gray-600 mb-2">{t("profileJob.noJob")}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden p-4 space-y-5">
                            {isJobsLoading ? (
                                <div className="py-32 text-center">
                                    <LoadingBlur text={t("profileJob.loadingJobs")}/>
                                </div>
                            ) : jobPosts.length > 0 ? (
                                jobPosts.map((job: any) => (
                                    <div
                                        key={job.post.id}
                                        onClick={() => router.push(`/${i18n.language}/job-board/${job.post.id}`)}
                                        className="relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl group"
                                    >
                                        <div className="absolute top-4 right-4 z-20">
                                            <Badge
                                                className={`px-4 py-2 font-bold shadow-lg ${getJobTypeBadgeColor(job.post.jobType)}`}>
                                                {getJobTypeLabel(job.post.jobType, t)}
                                            </Badge>
                                        </div>

                                        <div className="p-6">
                                            <div className="flex items-start gap-4 mb-5">
                                                <div
                                                    className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-blue-100 flex-shrink-0">
                                                    <svg className="w-8 h-8 text-blue-600" fill="none"
                                                         stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth={2}
                                                              d="M9 12h6m-3-3v6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                    </svg>
                                                </div>
                                                {/* Mobile: 2 lines max + tooltip */}
                                                <h3 className="text-sm font-bold text-gray-900 leading-tight pr-24 line-clamp-2 transition-colors">
                                                    {job.post.name}
                                                </h3>
                                            </div>

                                            <div className="mb-5">
                                                <p className="text-3xl font-extrabold text-gray-900">
                                                    {formatBudgetCompact(job.post.budget)}
                                                    <FontAwesomeIcon
                                                        icon={faCoins}
                                                        className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                                                    />
                                                </p>
                                                <div className="flex items-center gap-3 mt-3">
                                                    {getStatusBadge(!job.post.pending)}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-100">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderPostDate")}</p>
                                                    <p className="font-bold text-gray-800 mt-1">{formatDateTime(job.post.publishedAt, "date")}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderProposals")}</p>
                                                    <p className="font-bold text-gray-800 mt-1">{job.post.proposals}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("profileJob.tableHeaderDeadline")}</p>
                                                    <p className="font-bold text-gray-800 mt-1">
                                                        {job.post.deadline ? formatDateTime(job.post.deadline, "date") : "No deadline"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 flex justify-end">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/${i18n.language}/job-board/edit/${job.post.id}`);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transform hover:scale-105 shadow-lg hover:shadow-xl transition-all duration-300"
                                                >
                                                    {t("profileJob.tableHeaderActionEdit")}
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor"
                                                         viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-24">
                                    <div className="bg-gray-50 rounded-3xl p-12">
                                        <p className="text-2xl font-bold text-gray-700 mb-3">{t("profileJob.noJob")}</p>
                                        <p className="text-gray-500">Your posted jobs will appear here</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-center py-8">
                            <PaginationControls
                                hasPrevious={hasPreviousPage}
                                hasNext={hasNextPage}
                                onPrevious={handlePrevPage}
                                onNext={handleNextPage}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>

                    {/* Decorative Banner */}
                    <div
                        className="mt-12 h-48 bg-gradient-to-r from-blue-100 to-blue-200 rounded-2xl overflow-hidden flex justify-center items-center shadow-lg hover:shadow-xl transition-all duration-500">
                        <Image
                            src={ProfileImage.jobBoard}
                            alt="My Jobs"
                            className="transition-transform duration-700 hover:scale-110"
                            priority
                        />
                    </div>
                </div>

                <ConfirmCloseJob
                    isDeleteLoading={false}
                    isOpen={!!selectedJob}
                    onClose={handleCloseModal}
                    handleConfirmChange={handleConfirmDelete}
                />
            </div>
        </div>
    );
};

export default MyJobs;