"use client";

import {ProfileImage} from "@/constants/images";
import {PostId} from "108jobs-client";
import {formatDateToLong} from "@/utils";
import {ArrowLeft, Coins} from "lucide-react";
import Image from "next/image";
import InfoMessage from "../InfoMessage";
import {Badge} from "../ui/Badge";
import {Button} from "../ui/Button";
import JobBoardProposal from "./components/JobBoardProposal";
import {useParams, useRouter} from "next/navigation";
import {UserService} from "@/services";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useTranslation} from "react-i18next";
import {toCamelCaseLastSegment} from "@/utils/helpers";
import {getLocale} from "@/utils/date";
import {useUserStore} from "@/store/useUserStore";

type Props = {
    jobId: PostId;
};

const JobBoardDetail = ({jobId}: Props) => {
    const {t} = useTranslation();
    const isLoggedIn = UserService.Instance.isLoggedIn;
    const isGuest = !isLoggedIn;

    const route = useRouter();
    const {data: jobDetailData} = useHttpGet("getPost", {id: jobId});
    const {person} = useUserStore();

    const isVerify = person?.isVerified;
    // Show proposal button only for logged-in users who are NOT the job creator
    const canShowProposalButton = !isGuest && (!!person?.id && person?.id !== jobDetailData?.postView?.creator?.id);
    const params = useParams();
    const locale = params.lang as string
    const currentLocale = getLocale(locale);
    const calculateDaysUntil = (dateString: string) => {
        const targetDate = new Date(dateString);
        const today = new Date();
        targetDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = targetDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const handleProposalClick = () => {
        if (isVerify === "Pending") {
            return;
        }
        route.push(`${jobId}/proposal`);
    };

    return (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <button
                        type="button"
                        onClick={() => route.back()}
                        className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900 px-3 py-1 rounded-md hover:bg-gray-50"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4"/>
                        {t("jobBoardDetail.back")}
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <Badge className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                {t("global.open")}
                            </Badge>
                            <Badge variant="outline"
                                   className="text-xs bg-amber-500 font-medium px-3 py-1 rounded-full border-gray-300">
                                {t(`catalogs.${toCamelCaseLastSegment(jobDetailData?.categoryView.category.path)}`, {defaultValue: jobDetailData?.categoryView.category.name})}
                            </Badge>
                            {jobDetailData?.postView.post.isEnglishRequired && (
                                <Badge variant="outline"
                                       className="text-xs bg-yellow-900 font-medium px-3 py-1 rounded-full border-gray-300">
                                    {t("jobBoardDetail.englishRequire")}
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 break-words">
                            {jobDetailData?.postView.post.name}
                        </h1>
                        {!!jobDetailData?.postView.tags.length && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {jobDetailData?.postView.tags.map((tag) => (
                                    <Badge
                                        key={tag.id}
                                        variant="outline"
                                        className="text-xs bg-gray-100 text-gray-800 font-medium px-3 py-1 rounded-full border-gray-200"
                                    >
                                        {tag.displayName}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-gray-600">
                            <Image
                                src={jobDetailData?.postView.creator.avatar || ProfileImage.avatar}
                                alt="avatar"
                                className="w-12 h-12 rounded-full border-2 border-gray-200"
                                width={48}
                                height={48}
                                onError={(e) => {
                                    e.currentTarget.src =
                                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNEMUQ1REIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIgZmlsbD0iIzZCNzI4MCIvPgo8cGF0aCBkPSJtNCA0IDUgNWgtMTBhMTEuOTYzIDExLjk2MyAwIDAgMCA0LjUxNCA5LjY1OGM0LjczMiA5Ljc1NCA5LjUyNiA5LjI1OCAxMi0yLjMzNGMzLjMzNCA0LjM0NiA2IDYuNjY2IDEwIDEwaCIvPgo8L3N2Zz4K";
                                }}
                            />
                            <div>
                <span className="font-semibold text-gray-800">
                  {jobDetailData?.postView.creator.displayName || t("jobBoardDetail.anonymous")}
                </span>
                                <span className="text-sm text-gray-500 block">
                  (@{jobDetailData?.postView.creator.name})
                </span>
                            </div>
                        </div>
                    </div>
                    {canShowProposalButton && (
                        <Button
                            variant="default"
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
                            onClick={handleProposalClick}
                        >
                            {t("jobBoardDetail.submit")}
                        </Button>
                    )}
                </div>
                <div className="text-sm text-gray-500 mt-4 flex flex-wrap gap-4">
                    <span>{t("jobBoardDetail.posted")} {formatDateToLong(jobDetailData?.postView.post.publishedAt, currentLocale)}</span>
                    {jobDetailData?.postView.post.updatedAt !==
                        jobDetailData?.postView.post.publishedAt && (
                            <span>{t("jobBoardDetail.updated")} {formatDateToLong(jobDetailData?.postView.post.updatedAt, currentLocale)}</span>
                        )}
                </div>
            </div>

            {/* Project Information */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{t("jobBoardDetail.projectInfo")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-600 font-medium">{t("jobBoardDetail.deadline")}:</span>
                        <span className="ml-2 text-gray-800">
              {jobDetailData?.postView.post.deadline ? (
                  <>
                      {formatDateToLong(jobDetailData?.postView.post.deadline, currentLocale)}
                      {calculateDaysUntil(jobDetailData?.postView.post?.deadline || "2") > 0 ? (
                          <span className="text-green-600 ml-1">
                      ({calculateDaysUntil(jobDetailData?.postView.post?.deadline || "2")} days left)
                    </span>
                      ) : (
                          <span className="text-red-600 ml-1">({t("jobBoardDetail.expired")})</span>
                      )}
                  </>
              ) : (
                  "--"
              )}
            </span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-gray-600 font-medium">
                            {t("jobBoardDetail.budget")}:
                        </span>
                        <span className="ml-2 flex items-center text-gray-800">
                            {Number(jobDetailData?.postView.post.budget).toFixed()}
                            <Coins className="ml-1 w-7 h-7 text-yellow-500"/>
                        </span>
                    </div>

                    <div>
                        <span className="text-gray-600 font-medium">{t("jobBoardDetail.workType")}:</span>
                        <span
                            className="ml-2 text-gray-800">{t(`jobBoardDetail.${jobDetailData?.postView.post.jobType}`)}</span>
                    </div>
                    <div>
                        <span className="text-gray-600 font-medium">{t("jobBoardDetail.category")}:</span>
                        <span
                            className="ml-2 text-gray-800"> {t(`catalogs.${toCamelCaseLastSegment(jobDetailData?.categoryView.category.path)}`, {defaultValue: jobDetailData?.categoryView.category.name})}</span>
                    </div>
                    {jobDetailData?.postView.post.isEnglishRequired && (
                        <div>
                            <span className="text-gray-600 font-medium">{t("jobBoardDetail.specialReq")}</span>
                            <span className="ml-2 text-blue-600 font-medium">{t("jobBoardDetail.english")}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Job Details */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{t("jobBoardDetail.jobDetail")}</h3>
                <div className="space-y-4 text-gray-700">
                    <p className="break-words whitespace-pre-wrap">{jobDetailData?.postView.post.body}</p>
                    {jobDetailData?.postView.post.url && (
                        <div>
                            <span className="font-medium text-gray-600">{t("jobBoardDetail.referenceUrl")}: </span>
                            <a
                                href={jobDetailData?.postView.post.url}
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                {jobDetailData?.postView.post.url}
                            </a>
                        </div>
                    )}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">{t("jobBoardDetail.additionInfo")}</h4>
                    <div className="text-sm">
                        <span className="text-gray-600 font-medium">{t("jobBoardDetail.intendedUse")}:</span>
                        <span
                            className="ml-2 text-gray-800">{t(`jobBoardDetail.${jobDetailData?.postView.post.intendedUse}`)}</span>
                    </div>
                </div>
            </div>

            {/* Interested Freelancers */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <InfoMessage
                    message={t("jobBoardDetail.recommendation")}
                    className="bg-blue-50 text-blue-800 p-4 rounded-lg"
                />
                <JobBoardProposal postId={jobDetailData?.postView?.post.id}
                                  jobCreatorId={jobDetailData?.postView?.creator?.id}/>
            </div>

        </section>
    );
};

export default JobBoardDetail;