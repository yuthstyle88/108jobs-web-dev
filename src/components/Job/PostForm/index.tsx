'use client'
import React, {useCallback, useEffect, useState} from "react";
import {notFound, useRouter} from "next/navigation";
import useNotification from "@/hooks/ui/useNotification";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {CreatePost, IntendedUse, JobType, PostId, PostView} from "108jobs-client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCoins, faExclamationCircle, faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {z} from "zod";
import {getCategoriesAtLevel, toCamelCaseLastSegment} from "@/utils/helpers";
import {useTranslation} from "react-i18next";
import {REQUEST_STATE} from "@/services/HttpService";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useCategories} from "@/hooks/api/categories/useCategories";
import {useUserStore} from "@/store/useUserStore";
import {resolveApiErrorMessage} from "@/utils/errorMessage";


interface PostFormProps {
    redirectUrl?: string,
    history?: any,
    setApiError?: (err: string) => void,
    postView?: PostView | null,
    mode: "create" | "edit",
}

const postJobSchema = (t: (key: string) => string) => z.object({
    categoryId: z.coerce.number().int().positive(t("validation.categoryIdPositive")),
    jobTitle: z.string().min(5,
        t("validation.jobTitleMinLength")),
    description: z.string().min(20,
        t("validation.descriptionMinLength")),
    budget: z
        .string()
        .refine((val) => !isNaN(Number(val)) && Number(val) > 0,
            {
                message: t("validation.budgetPositive"),
            })
        .transform((val) => Number(val)),
    workingFrom: z.nativeEnum(JobType),
    intendedUse: z.nativeEnum(IntendedUse),
    url: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().url(t("validation.urlInvalid")).optional()),
    isEnglishRequired: z.boolean().optional(),
    deadline: z
        .string()
        .optional()
        .refine((val) => {
                if (!val) return true;
                const selected = new Date(val);
                const now = new Date();
                return selected.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
            },
            {
                message: t("validation.deadlineMin"),
            })
        .transform((val) => {
            if (!val) return undefined;
            return `${val}T23:59:59Z`;
        }),
});


export const PostForm: React.FC<PostFormProps> = ({
                                                      postView,
                                                      mode
                                                  }) => {
    const {person} = useUserStore();
    const {t} = useTranslation();
    if (mode === "edit") {
        const isOwner = postView?.creator.id === person?.id;
        if (!isOwner) {
            notFound();
        }
    }

    const router = useRouter();
    const {execute: createPost} = useHttpPost("createPost");
    const {execute: editPost} = useHttpPost("editPost");
    const title = mode === "create"
        ? t('createJob.pageTitle')
        : t('jobBoardDetail.jobDetail');

    const {successMessage, errorMessage} = useNotification();
    const [postId, setPostId] = useState<PostId>(0);
    const categoriesResponse = useCategories();
    const catalogData = getCategoriesAtLevel(categoriesResponse.categories ?? undefined, 3);
    // Create schema with translations
    const jobSchema = postJobSchema(t);

    const formMethods = useForm<z.input<typeof jobSchema>, never, z.output<typeof jobSchema>>({
        resolver: zodResolver(jobSchema),
        mode: "onChange",
        criteriaMode: "all",
        defaultValues: {
            categoryId: undefined,
            jobTitle: "",
            description: "",
            workingFrom: JobType.Freelance,
            intendedUse: IntendedUse.Personal,
            budget: "",
            deadline: "",
            url: "",
            isEnglishRequired: false,
        },
    });

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        watch,
        formState: {errors}
    } = formMethods;

    useEffect(() => {
            if (postView && mode === "edit") {
                const post = postView.post
                reset({
                    categoryId: post.categoryId,
                    jobTitle: post.name,
                    description: post.body ?? "",
                    isEnglishRequired: post.isEnglishRequired,
                    url: post.url ?? "",
                    budget: post.budget != null ? String(post.budget) : "",
                    deadline: post.deadline ? post.deadline.split("T")[0] : "",
                    workingFrom: post.jobType,
                    intendedUse: post.intendedUse,
                });
                setPostId(post.id);
            }
        },
        [postView]);

    const handleCreateSuccess = useCallback(async () => {
            router.replace("/job-board");
        },
        [router]);

    const onSubmit = useCallback(
        async (data: z.infer<typeof jobSchema>) => {
            try {
                const payload: CreatePost = {
                    name: data.jobTitle,
                    body: data.description,
                    jobType: data.workingFrom,
                    categoryId: data.categoryId,
                    deadline: data.deadline,
                    isEnglishRequired: data.isEnglishRequired ?? false,
                    url: data.url,
                    intendedUse: data.intendedUse,
                    budget: data.budget,
                };

                const response = postId
                    ? await editPost({postId, ...payload})
                    : await createPost(payload);

                if (response.state === REQUEST_STATE.FAILED) {
                    // t()'s own `?? t(...)` fallback above never actually
                    // fired -- i18next returns the key itself for a miss, not
                    // undefined, so an unmapped code showed raw text like
                    // "createJob.someCode". defaultValue is the real check.
                    const namespace = postId ? "editJob" : "createJob";
                    const code = response.err?.name;
                    const specific = code ? t(`${namespace}.${code}`, {defaultValue: ""}) : "";
                    const messageError = specific || resolveApiErrorMessage(response.err, t, {fallback: t("global.serverError")});
                    errorMessage(null, null, messageError);
                    return;
                }

                successMessage(null, null, t("notification.jobCreateJobBoardSuccess") ?? "Success!");
                await handleCreateSuccess();
            } catch (error) {
                errorMessage(null, null, t("global.submissionFailed") ?? "Submission failed!");
            }
        },
        [createPost, editPost, handleCreateSuccess, successMessage, errorMessage, postId, t]
    );

    return (
        <div className="bg-[#F6F9FE] min-h-screen py-8">
            <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    {/* Info Notice */}
                    <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                        <FontAwesomeIcon icon={faInfoCircle} className="text-primary mt-1 mr-3 flex-shrink-0"/>
                        <p className="text-blue-800 text-sm sm:text-base">
                            {t("createJob.jobPostingNotice")}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
                        <h1 className="text-4xl font-bold text-gray-900 bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                            {title}
                        </h1>
                    </div>


                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                        {/* Job Title */}
                        <div className="mb-6">
                            <label
                                htmlFor="jobTitle"
                                className="block text-gray-700 font-medium mb-2"
                            >
                                {t("createJob.jobTitleLabel")}
                            </label>
                            <input
                                id="jobTitle"
                                {...register("jobTitle")}
                                placeholder={t("createJob.jobTitlePlaceholder")}
                                className={`w-full text-text-primary placeholder:text-text-secondary placeholder:font-sans p-3 border rounded-lg focus:outline-none focus:ring-1 ${
                                    errors.jobTitle
                                        ? "border-red-200 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-blue-500"
                                }`}
                            />

                            {errors.jobTitle && (
                                <p className="mt-1 text-red-500 text-sm flex items-center">
                                    <FontAwesomeIcon
                                        icon={faExclamationCircle}
                                        className="mr-1"
                                    />
                                    {errors.jobTitle.message}
                                </p>
                            )}
                        </div>

                        {/* Working From */}
                        <div className="mb-6">
                            <label className="block text-gray-700 font-medium mb-2">
                                {t("createJob.employmentTypeLabel")}
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="flex items-center p-3 border border-gray-300 rounded-lg">
                                    <input
                                        type="radio"
                                        id="freelance"
                                        value={JobType.Freelance}
                                        {...register("workingFrom")}
                                        className="h-4 w-4 text-primary"
                                    />
                                    <label htmlFor="freelance" className="ml-2 text-gray-700">
                                        {t("createJob.employmentTypeFreelance")}
                                    </label>
                                </div>

                                <div className="flex items-center p-3 border border-gray-300 rounded-lg">
                                    <input
                                        type="radio"
                                        id="contract"
                                        value={JobType.Contract}
                                        {...register("workingFrom")}
                                        className="h-4 w-4 text-primary"
                                    />
                                    <label htmlFor="contract" className="ml-2 text-gray-700">
                                        {t("createJob.employmentTypeContract")}
                                    </label>
                                </div>

                                <div className="flex items-center p-3 border border-gray-300 rounded-lg">
                                    <input
                                        type="radio"
                                        id="parttime"
                                        value={JobType.PartTime}
                                        {...register("workingFrom")}
                                        className="h-4 w-4 text-primary"
                                    />
                                    <label htmlFor="parttime" className="ml-2 text-gray-700">
                                        {t("createJob.employmentTypePartTime")}
                                    </label>
                                </div>

                                <div className="flex items-center p-3 border border-gray-300 rounded-lg">
                                    <input
                                        type="radio"
                                        id="fulltime"
                                        value={JobType.FullTime}
                                        {...register("workingFrom")}
                                        className="h-4 w-4 text-primary"
                                    />
                                    <label htmlFor="fulltime" className="ml-2 text-gray-700">
                                        {t("createJob.employmentTypeFullTime")}
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Job Description */}
                        <div className="mb-6">
                            <label
                                htmlFor="description"
                                className="block text-gray-700 font-medium mb-2"
                            >
                                {t("createJob.jobDescriptionLabel")}
                            </label>
                            <p className="text-gray-500 text-sm mb-2">
                                {t("createJob.jobDescriptionNotice")}
                            </p>
                            <textarea
                                id="description"
                                {...register("description")}
                                placeholder={t("createJob.jobDescriptionDetails")}
                                className={`text-text-primary placeholder:text-text-secondary placeholder:font-sans w-full p-3 border rounded-lg focus:outline-none focus:ring-1 min-h-[200px] ${
                                    errors.description
                                        ? "border-red-200 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-blue-500"
                                }`}
                            />

                            {errors.description && (
                                <p className="mt-1 text-red-500 text-sm flex items-center">
                                    <FontAwesomeIcon
                                        icon={faExclamationCircle}
                                        className="mr-1"
                                    />
                                    {errors.description.message}
                                </p>
                            )}
                        </div>

                        {/* English Required Checkbox */}
                        <div className="mb-6">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isEnglishRequired"
                                    {...register("isEnglishRequired")}
                                    className="h-4 w-4 text-primary"
                                />
                                <label
                                    htmlFor="isEnglishRequired"
                                    className="ml-2 text-gray-700"
                                >
                                    {t("createJob.englishSpeakerLabel")}
                                </label>
                            </div>
                        </div>

                        {/* Example URL and Service Catalog */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label
                                    htmlFor="exampleUrl"
                                    className="block text-gray-700 font-medium mb-2"
                                >
                                    {t("createJob.exampleUrl")}
                                </label>
                                <input
                                    id="url"
                                    {...register("url")}
                                    placeholder={t("createJob.serviceCategoryPlaceholderUrl")}
                                    className={`text-text-primary placeholder:text-text-secondary placeholder:font-sans w-full p-3 border rounded-lg focus:outline-none focus:ring-1`}
                                />

                            </div>

                            <div>
                                <label
                                    htmlFor="categoryId"
                                    className="block text-gray-700 font-medium mb-2"
                                >
                                    {t("createJob.serviceCategoryLabel")}
                                </label>
                                <select
                                    id="categoryId"
                                    {...register("categoryId")}
                                    className={`text-text-primary placeholder:text-text-secondary placeholder:font-sans w-full p-3 border rounded-lg focus:outline-none focus:ring-1 ${
                                        errors.categoryId
                                            ? "border-red-200 focus:ring-red-500"
                                            : "border-gray-300 focus:ring-blue-500"
                                    }`}
                                >
                                    <option disabled value="">
                                        {t("createJob.serviceCategoryPlaceholderSelect")}
                                    </option>
                                    {catalogData
                                        .map((catalog) => (
                                            <option key={catalog.category.id} value={catalog.category.id}>
                                                {t(`catalogs.${toCamelCaseLastSegment(catalog.category.path)}`)}
                                            </option>
                                        ))}
                                </select>

                                {errors.categoryId && (
                                    <p className="mt-1 text-red-500 text-sm flex items-center">
                                        <FontAwesomeIcon
                                            icon={faExclamationCircle}
                                            className="mr-1"
                                        />
                                        {errors.categoryId.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Budget and Deadline */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label
                                    htmlFor="budget"
                                    className="block text-gray-700 font-medium mb-2"
                                >
                                    {t("createJob.budgetLabel")}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2  text-yellow-500 ">
                                        <FontAwesomeIcon icon={faCoins}/>
                                    </div>
                                    <input
                                        type="number"
                                        id="budget"
                                        {...register("budget")}
                                        placeholder="0"
                                        onFocus={(e) => e.target.select()}
                                        className={`text-text-primary placeholder:text-text-secondary placeholder:font-sans w-full p-3 pl-10 border rounded-lg focus:outline-none focus:ring-1 ${
                                            errors.budget
                                                ? "border-red-200 focus:ring-red-500"
                                                : "border-gray-300 focus:ring-blue-500"
                                        }`}
                                    />
                                </div>
                                {errors.budget && (
                                    <p className="mt-1 text-red-500 text-sm flex items-center">
                                        <FontAwesomeIcon icon={faExclamationCircle} className="mr-1"/>
                                        {errors.budget.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="deadline"
                                    className="block text-gray-700 font-medium mb-2"
                                >
                                    {t("createJob.deadlineLabel")}
                                </label>
                                <input
                                    type="date"
                                    id="deadline"
                                    {...register("deadline")}
                                    min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0]}
                                    className={`text-text-primary placeholder:text-text-secondary placeholder:font-sans w-full p-3 border rounded-lg focus:outline-none focus:ring-1 ${
                                        errors.deadline
                                            ? "border-red-200 focus:ring-red-500"
                                            : "border-gray-300 focus:ring-blue-500"
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Intended Use */}
                        <div className="mb-6">
                            <label className="block text-gray-700 font-medium mb-2">
                                {t("createJob.intendedUseLabel")}
                            </label>
                            <p className="text-gray-500 text-sm mb-2">
                                {t("createJob.intendedUseNotice")}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer ${
                                        watch("intendedUse") === "Business"
                                            ? "bg-blue-100 border border-blue-300"
                                            : "bg-white border border-gray-200"
                                    }`}
                                    onClick={() => setValue("intendedUse",
                                        IntendedUse.Business)}
                                >
                                    <div className="text-primary mb-2">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-8 w-8"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-gray-700">
                                        {t("createJob.intendedUseBusiness")}
                                    </span>
                                </div>

                                <div
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer ${
                                        watch("intendedUse") === "Personal"
                                            ? "bg-blue-100 border border-blue-300"
                                            : "bg-white border border-gray-200"
                                    }`}
                                    onClick={() => setValue("intendedUse",
                                        IntendedUse.Personal)}
                                >
                                    <div className="text-primary mb-2">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-8 w-8"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-gray-700">
                                        {t("createJob.intendedUsePersonal")}
                                    </span>
                                </div>
                                <div
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer ${
                                        watch("intendedUse") === "Unknown"
                                            ? "bg-blue-100 border border-blue-300"
                                            : "bg-white border border-gray-200"
                                    }`}
                                    onClick={() => setValue("intendedUse",
                                        IntendedUse.Unknown)}
                                >
                                    <div className="text-primary mb-2">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-8 w-8"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-gray-700">
                                        {t("createJob.intendedUseUnknown")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end space-x-4 mt-10">
                            <button
                                onClick={() => router.replace("/job-board")}
                                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                            >
                                {t("createJob.previewButton")}
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-[#063a68] disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                                {t("createJob.submitButton")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};