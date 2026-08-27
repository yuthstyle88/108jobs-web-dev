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

interface RegisterFormProps {
    onSwitchToOtp?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({onSwitchToOtp}) => {
    const {t, i18n} = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const [apiError, setApiError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const registerSchema = z.object({
        phone: z
            .string()
            .min(9, t("authen.placeholderPhone"))
            .regex(/^[0-9+() -]+$/, t("authen.placeholderPhone")),
        password: z
            .string()
            .min(6, t("authen.passwordMin6")),
    });

    type RegisterFormData = z.infer<typeof registerSchema>;

    const form = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        mode: "onChange",
        defaultValues: {
            phone: "",
            password: "",
        },
    });

    const {execute: register} = useHttpPost("registerWithIdentityPlatform");

    const onSubmit = form.handleSubmit(async (data) => {
        setApiError(null);
        const res = await register({
            phone: data.phone.trim(),
            password: data.password,
        });

        if (res.state === REQUEST_STATE.FAILED) {
            setApiError(
                resolveApiErrorMessage(res.err, t, {
                    knownCodes: {
                        identityPlatformPhoneTaken: t("authen.phoneTaken") || "Phone number already exists",
                        identityPlatformPhoneRequired: t("authen.placeholderPhone"),
                    },
                    fallback: t("authen.apiErrorState"),
                })
            );
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
                label={t("authen.placeholderPhone")}
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder={t("authen.placeholderPhone")}
                register={form.register("phone")}
                error={errors.phone?.message}
                required
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

            <div className="text-center">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={form.formState.isSubmitting}
                >
                    {form.formState.isSubmitting ? (
                        <LoadingCircle/>
                    ) : (
                        t("authen.titleCreateAccount")
                    )}
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
                        {t("global.labelLoginButton")}
                    </button>
                </div>
            </div>
        </form>
    );
};
