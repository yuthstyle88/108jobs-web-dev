"use client";
import {Button} from "@/components/ui/Button";
import {ProfileImage} from "@/constants/images";
import {zodResolver} from "@hookform/resolvers/zod";
import {AlertTriangle, ArrowLeft, Info} from "lucide-react";
import Image from "next/image";
import {useParams, useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useCallback} from "react";
import {CreateProposal, PostId} from "108jobs-client";
import {REQUEST_STATE} from "@/services/HttpService";
import useNotification from "@/hooks/ui/useNotification";
import {resolveApiErrorMessage} from "@/utils/errorMessage";

const createJobApplicationSchema = (t: (key: string, options?: any) => string) =>
    z.object({
        whyHireYou: z.string().min(100, t("jobApplication.whyHireYou.required")),
    });

type JobApplicationFormData = z.infer<ReturnType<typeof createJobApplicationSchema>>;

const JobApplication = () => {
    const {t} = useTranslation();
    const route = useRouter();
    const {successMessage, errorMessage} = useNotification();
    const {jobId} = useParams<{ jobId: string }>();
    const postId: PostId = parseInt(jobId, 10);

    const {
        register,
        handleSubmit,
        watch,
        formState: {errors},
    } = useForm<JobApplicationFormData>({
        resolver: zodResolver(createJobApplicationSchema(t)),
    });

    const {execute: createComment} = useHttpPost("createComment");
    const handleCreateSuccess = useCallback(async () => {
            route.replace("/job-board");
        },
        [route]);
    const onSubmit = useCallback(
        async (data: JobApplicationFormData) => {
            try {
                const payload: CreateProposal = {
                    postId,
                    content: data.whyHireYou,
                };

                const response = await createComment(payload);

                if (response.state === REQUEST_STATE.FAILED) {
                    const errName = response.err?.name ?? "unknownError";
                    if (errName === 'alreadyProposed') {
                        const messageError = t("errors.alreadyProposed", { defaultValue: t("global.submissionFailed") || "You have already submitted proposal on this job." });
                        errorMessage(null, null, messageError);
                        return;
                    }
                    // Previously fell through to handleCreateSuccess() below
                    // for any OTHER failure code -- a rejected submission
                    // silently navigated away as though it had succeeded.
                    errorMessage(null, null, resolveApiErrorMessage(response.err, t, {fallback: t("global.submissionFailed")}));
                    return;
                }

                await handleCreateSuccess();
            } catch (error) {
                errorMessage(null, null, t("global.submissionFailed") ?? "Submission failed!");
            }
        },
        [createComment, handleCreateSuccess, successMessage, errorMessage, t]
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
            <div className="max-w-[1280px] w-[88vw] mx-auto px-6 py-8">
                <div className="flex items-center gap-6 mb-8">
                    <button onClick={() => route.back()}
                            className="text-gray-700 hover:text-primary transition-colors">
                        <ArrowLeft className="w-6 h-6"/>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[441px_1fr] gap-10">
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h1 className="text-3xl text-gray-900 font-bold mb-4">
                            {t("jobApplication.pageTitle")}
                        </h1>
                        <p className="text-gray-600 mb-6">
                            {t("jobApplication.pageSubheading")}
                        </p>
                        <div className="w-full flex justify-center items-center">
                            <Image
                                src={ProfileImage.proposal}
                                alt="proposal"
                                width={300}
                                height={200}
                                className="rounded-lg object-cover"
                            />
                        </div>
                    </div>

                    <div>
                        <div
                            className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-start gap-3 animate-pulse">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5"/>
                            <p className="text-sm text-yellow-800">
                                {t("jobApplication.warningMessage")}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <div
                                className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <Info className="w-5 h-5 text-primary mt-0.5"/>
                                <p className="text-sm text-blue-800">
                                    {t("jobApplication.publicInfoMessage")}
                                </p>
                            </div>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t("jobApplication.whyHireYou.label")}
                                    </label>
                                    <textarea
                                        {...register("whyHireYou")}
                                        placeholder={t("jobApplication.whyHireYou.placeholder")}
                                        className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
                                    />
                                    {errors.whyHireYou ? (
                                        <p className="text-red-500 text-sm mt-1">{errors.whyHireYou.message}</p>
                                    ) : (
                                        <div className="text-xs text-gray-500 text-right mt-1">
                                            {t("jobApplication.whyHireYou.characterCount", {count: watch("whyHireYou")?.length || 0})}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-4 pt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => route.back()}
                                        className="text-gray-900 border-gray-300 hover:bg-gray-50"
                                    >
                                        {t("jobApplication.buttons.cancel")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-primary hover:bg-[#063a68] text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                                    >
                                        {t("jobApplication.buttons.submit")}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobApplication;