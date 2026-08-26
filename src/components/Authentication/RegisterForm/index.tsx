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
import {normalizeThaiPhone} from "@/services/IdentityOtpService";
import {resolveApiErrorMessage} from "@/utils/errorMessage";
import {Phone} from "lucide-react";

interface RegisterFormProps {
    onSwitchToOtp?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({onSwitchToOtp}) => {
    const router = useRouter();
    const {t, i18n} = useTranslation();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";

    const [apiError, setApiError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const registerSchema = z.object({
        username: z
            .string()
            .min(3, t("authen.usernameMin3"))
            .max(32, t("authen.usernameMax32"))
            .regex(/^[a-zA-Z0-9_]+$/, t("authen.invalidName")),
        phone: z
            .string()
            .min(9, t("authen.errorPhoneLength")),
        email: z
            .string()
            .optional()
            .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
                message: t("authen.invalidEmail"),
            }),
        password: z
            .string()
            .min(6, t("authen.passwordMin6")),
        confirmPassword: z
            .string()
            .min(1, t("authen.errorPasswordVerifyRequired")),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t("authen.notMatchPassword"),
        path: ["confirmPassword"],
    });

    type RegisterFormValues = z.infer<typeof registerSchema>;

    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        mode: "onChange",
        defaultValues: {
            username: "",
            phone: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const {execute: registerUser} = useHttpPost("registerWithIdentityPlatform");

    const onSubmit = form.handleSubmit(async (data) => {
        setApiError(null);
        const normalizedPhone = normalizeThaiPhone(data.phone);
        if (!normalizedPhone) {
            form.setError("phone", {message: t("authen.errorPhoneLength")});
            return;
        }

        const payload = {
            username: data.username.trim(),
            phone: normalizedPhone,
            email: data.email?.trim() || undefined,
            password: data.password,
        };

        const res = await registerUser(payload);

        if (res.state === REQUEST_STATE.FAILED) {
            setApiError(resolveApiErrorMessage(res.err, t, {
                knownCodes: {
                    usernameAlreadyExists: t("authen.usernameAlreadyExists"),
                    identityPlatformUsernameTaken: t("authen.identityPlatformUsernameTaken"),
                    emailAlreadyExists: t("authen.emailAlreadyExists"),
                    identityPlatformEmailTaken: t("authen.identityPlatformEmailTaken"),
                    identityPlatformPasswordPolicyViolation: t("authen.identityPlatformPasswordPolicyViolation"),
                    identityPlatformPhoneRequired: t("authen.errorPhoneLength"),
                    invalidEmail: t("authen.invalidEmail"),
                    emptyPassword: t("authen.errorPasswordRequired"),
                    emptyUsername: t("authen.usernameMin3"),
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
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {apiError && (
                <p className="text-red-500 text-sm text-center mb-4">
                    {apiError}
                </p>
            )}

            <CustomInput
                label={t("authen.labelUsername")}
                type="text"
                name="username"
                autoComplete="username"
                placeholder={t("authen.placeholderUsername")}
                register={form.register("username")}
                error={errors.username?.message}
                required
            />

            <CustomInput
                label={t("authen.labelPhone")}
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder={t("authen.placeholderPhone")}
                register={form.register("phone")}
                error={errors.phone?.message}
                required
            />

            <CustomInput
                label={t("authen.labelEmail")}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("authen.placeholderEmail")}
                register={form.register("email")}
                error={errors.email?.message}
            />

            <CustomInput
                label={t("authen.labelPassword")}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                placeholder={t("authen.placeholderPassword")}
                register={form.register("password")}
                error={errors.password?.message}
                showPassword={showPassword}
                toggleShowPassword={() => setShowPassword((prev) => !prev)}
                required
            />

            <CustomInput
                label={t("authen.labelPasswordVerify")}
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder={t("authen.placeholderPasswordVerify")}
                register={form.register("confirmPassword")}
                error={errors.confirmPassword?.message}
                showPassword={showConfirmPassword}
                toggleShowPassword={() => setShowConfirmPassword((prev) => !prev)}
                required
            />

            <div className="text-center pt-2">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={form.formState.isSubmitting}
                >
                    {form.formState.isSubmitting ? <LoadingCircle/> : t("authen.titleCreateAccount")}
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
                        onClick={() => router.push(`/${i18n.language}/login`)}
                        className="hover:underline"
                    >
                        {t("authen.titleLoginForm")} ({t("global.labelLoginButton")})
                    </button>
                </div>
            </div>
        </form>
    );
};
