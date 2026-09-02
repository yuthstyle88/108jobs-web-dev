"use client";

import {PostForm} from "@/components/Job/PostForm";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
import NotFound from "@/components/Common/NotFound";
import {useParams} from "next/navigation";
import {isFailed} from "@/services/HttpService";
import {useTranslation} from "react-i18next";
import {AlertCircle, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/Button";

export default function EditPostPage() {
    const {t} = useTranslation();
    const { jobId, proposalId } = useParams() as { jobId: string; proposalId?: string };

    const {
        data: postResponse,
        isMutating: isLoading,
        state,
        execute: refetch,
    } = useHttpGet("getPost", {
        id: Number(jobId),
        proposalId: proposalId ? Number(proposalId) : undefined,
    });

    if (isLoading) return <LoadingBlur text="" />;

    if (isFailed(state)) {
        return (
            <main className="w-full min-h-screen bg-[#F6F9FE] pt-16 px-4 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                        {t("error.loadJobPostFailed")}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        {t("error.loadJobPostFailedDetail")}
                    </p>
                    <Button
                        type="button"
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t("global.buttonRetry")}
                    </Button>
                </div>
            </main>
        );
    }

    if (!postResponse?.postView) return <NotFound />;

    return (
        <main className="w-full min-h-screen bg-[#F6F9FE] pt-16">
            <PostForm mode="edit" postView={postResponse.postView} />
        </main>
    );
}
