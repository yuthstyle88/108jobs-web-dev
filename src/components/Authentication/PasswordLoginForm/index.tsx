"use client";
import LoadingCircle from "@/components/Common/Loading/LoadingCircle";
import {CustomInput} from "@/components/ui/InputField";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useState} from "react";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "next/navigation";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {REQUEST_STATE} from "@/services/HttpService";
import {completeSignIn} from "@/services/authRedirect";
import {resolveApiErrorMessage} from "@/utils/errorMessage";

export const PasswordLoginForm: React.FC = () => {
    const {t} = useTranslation();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const [apiError, setApiError] = useState<string | null>(null);

    const passwordLoginSchema = z.object({
        usernameOrEmail: z.string().min(1, t("authen.errorUsernameOrEmailRequired")),
        password: z.string().min(1, t("authen.errorPasswordRequired")),
    });

    const form = useForm<z.infer<typeof passwordLoginSchema>>({
        resolver: zodResolver(passwordLoginSchema),
        mode: "onChange",
    });

    const {execute: login} = useHttpPost("loginWithIdentityPlatform");

    const onSubmit = form.handleSubmit(async (data) => {
        setApiError(null);
        const res = await login(data);
        if (res.state === REQUEST_STATE.FAILED) {
            setApiError(resolveApiErrorMessage(res.err, t, {
                knownCodes: {
                    identityPlatformLoginFailed: t("authen.invalidLoginCredentials"),
                },
                fallback: t("authen.apiErrorState"),
            }));
            return;
        }
        if (res.state === REQUEST_STATE.SUCCESS) {
            await completeSignIn(res.data.accessToken, res.data.refreshToken, redirectUrl);
        }
    });

    const errors = form.formState.errors;

    return (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {apiError && (
                <p className="text-red-500 text-sm text-center mb-4">
                    {apiError}
                </p>
            )}

            <CustomInput
                label={t("authen.labelUsernameOrEmail")}
                type="text"
                name="usernameOrEmail"
                autoComplete="username"
                placeholder={t("authen.placeholderUsernameOrEmail")}
                register={form.register("usernameOrEmail")}
                error={errors.usernameOrEmail?.message}
            />

            <CustomInput
                label={t("authen.labelPassword")}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder={t("authen.placeholderPassword")}
                register={form.register("password")}
                error={errors.password?.message}
            />

            <div className="text-center">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={form.formState.isSubmitting}
                >
                    {form.formState.isSubmitting ? <LoadingCircle/> : t("global.labelLoginButton")}
                </button>
            </div>
        </form>
    );
};
