"use client";
import LoadingCircle from "@/components/Common/Loading/LoadingCircle";
import {CustomInput} from "@/components/ui/InputField";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useState} from "react";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useRouter, useSearchParams} from "next/navigation";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {REQUEST_STATE} from "@/services/HttpService";
import {completeSignIn} from "@/services/authRedirect";
import {resolveApiErrorMessage} from "@/utils/errorMessage";
import {Phone} from "lucide-react";

interface PasswordLoginFormProps {
    onSwitchToOtp?: () => void;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({onSwitchToOtp}) => {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const [apiError, setApiError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const passwordLoginSchema = z.object({
        usernameOrEmail: z.string().min(1, t("authen.errorUsernameOrEmailRequired")),
        password: z.string().min(1, t("authen.errorPasswordRequired")),
    });

    const form = useForm<z.infer<typeof passwordLoginSchema>>({
        resolver: zodResolver(passwordLoginSchema),
        mode: "onChange",
        defaultValues: {
            usernameOrEmail: "",
            password: "",
        },
    });

    const {execute: login} = useHttpPost("loginWithIdentityPlatform");

    const onSubmit = form.handleSubmit(async (data) => {
        setApiError(null);
        const trimmed = data.usernameOrEmail.trim();
        const digits = trimmed.replace(/\D/g, "");
        const normalizedUsernameOrEmail =
            (trimmed.startsWith("0") || digits.startsWith("0")) &&
            digits.length >= 9 &&
            digits.length <= 10 &&
            !trimmed.includes("@")
                ? `+66${digits.slice(1)}`
                : trimmed;

        const res = await login({
            ...data,
            usernameOrEmail: normalizedUsernameOrEmail,
        });
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
                required
            />

            <CustomInput
                label={t("authen.labelPassword")}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder={t("authen.placeholderPassword")}
                register={form.register("password")}
                error={errors.password?.message}
                showPassword={showPassword}
                toggleShowPassword={() => setShowPassword((prev) => !prev)}
                required
            />

            <div className="text-center">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={form.formState.isSubmitting}
                >
                    {form.formState.isSubmitting ? <LoadingCircle/> : t("global.labelLoginButton")}
                </button>

                {onSwitchToOtp && (
                    <>
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 border-t border-gray-200"/>
                            <span className="text-xs text-gray-400">{t("authen.labelOr")}</span>
                            <div className="flex-1 border-t border-gray-200"/>
                        </div>
                        <button
                            type="button"
                            onClick={onSwitchToOtp}
                            className="flex items-center justify-center gap-2 cursor-pointer w-full py-3 rounded-md border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition duration-300"
                        >
                            <Phone className="h-[18px] w-[18px]"/>
                            {t("authen.buttonLoginOtp")}
                        </button>
                    </>
                )}

                <div className="text-sm text-primary mt-4">
                    <button
                        type="button"
                        onClick={() => router.push(`/${i18n.language}/register`)}
                        className="hover:underline"
                    >
                        {t("authen.linkCreateAccount")}
                    </button>
                </div>
            </div>
        </form>
    );
};
