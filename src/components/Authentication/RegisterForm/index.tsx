"use client";
import LoadingCircle from "@/components/Common/Loading/LoadingCircle";
import {CustomInput} from "@/components/ui/InputField";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useCallback, useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "next/navigation";
import {UserService} from "@/services";
import {jwtDecode} from "jwt-decode";
import {isAdminClaims, Claims} from "@/services/UserService";
import {ApiError, REQUEST_STATE} from "@/services/HttpService";
import {normalizeThaiPhone, OtpChallenge, requestOtp, verifyOtp} from "@/services/IdentityOtpService";

interface RegisterFormProps {
    setApiError?: (err: string) => void;
}

const RESEND_COOLDOWN_SECONDS = 30;

type Step = "phone" | "code";

// Identity-Platform's stable error codes (see error_response() in
// Identity-Platform-dev) mapped onto the copy this form already has.
function errorMessage(t: (key: string) => string, err?: ApiError): string {
    switch (err?.error) {
        case "invalid_code":
            return t("authen.invalidOTP");
        case "challenge_expired":
        case "invalid_challenge_state":
        case "challenge_not_found":
            return t("authen.otpExpired");
        case "rate_limited":
        case "too_many_attempts":
            return t("authen.resendLimitReached");
        default:
            return t("authen.apiErrorState");
    }
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
                                                                setApiError,
                                                            }) => {
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const {t} = useTranslation();

    const [step, setStep] = useState<Step>("phone");
    const [apiErrorState, setApiErrorState] = useState<string | null>(null);
    const [phone, setPhone] = useState("");
    const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
    const [cooldown, setCooldown] = useState(0);

    // register/page.tsx threads a setApiError prop through but never renders
    // the state it sets -- always keep our own copy so this form's error
    // banner works regardless of what (if anything) the parent does with it.
    const handleApiError = useCallback((err: string) => {
            setApiErrorState(err);
            setApiError?.(err);
        },
        [setApiError]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const phoneSchema = z.object({
        phone: z.string().min(9, t("authen.errorPhoneLength")),
    });
    const phoneForm = useForm<z.infer<typeof phoneSchema>>({
        resolver: zodResolver(phoneSchema),
        mode: "onChange",
    });

    const codeSchema = z.object({
        code: z.string().min(4, t("authen.invalidOTP")).regex(/^\d+$/, t("authen.invalidOTP")),
    });
    const codeForm = useForm<z.infer<typeof codeSchema>>({
        resolver: zodResolver(codeSchema),
        mode: "onChange",
    });

    const sendCode = useCallback(async (rawPhone: string) => {
            const normalized = normalizeThaiPhone(rawPhone);
            if (!normalized) {
                phoneForm.setError("phone", {message: t("authen.errorPhoneLength")});
                return;
            }
            handleApiError("");
            const res = await requestOtp(normalized);
            if (res.state === REQUEST_STATE.FAILED) {
                handleApiError(errorMessage(t, res.err));
                return;
            }
            setPhone(normalized);
            setChallenge(res.data);
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setStep("code");
        },
        [handleApiError, phoneForm, t]);

    const onSubmitPhone = phoneForm.handleSubmit((data) => sendCode(data.phone));

    const onResend = useCallback(async () => {
            if (cooldown > 0 || !phone) return;
            await sendCode(phone);
        },
        [cooldown, phone, sendCode]);

    const onChangeNumber = () => {
        handleApiError("");
        codeForm.reset();
        setChallenge(null);
        setStep("phone");
    };

    const onSubmitCode = codeForm.handleSubmit(async (data) => {
        if (!challenge) return;
        handleApiError("");
        const res = await verifyOtp(challenge.challengeId, data.code);
        if (res.state === REQUEST_STATE.FAILED) {
            handleApiError(errorMessage(t, res.err));
            return;
        }
        const {login} = res.data;
        await UserService.Instance.login(login.accessToken, login.refreshToken);
        const claims = jwtDecode<Claims>(login.accessToken);
        if (isAdminClaims(claims)) {
            window.location.href = "/admin/dashboard";
            return;
        }
        window.location.href = redirectUrl;
    });

    const phoneErrors = phoneForm.formState.errors;
    const codeErrors = codeForm.formState.errors;

    if (step === "phone") {
        return (
            <form onSubmit={onSubmitPhone} className="space-y-5" noValidate>
                {apiErrorState && (
                    <p className="text-red-500 text-sm text-center mb-4">
                        {apiErrorState}
                    </p>
                )}

                <CustomInput
                    label={t("authen.labelPhone")}
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder={t("authen.placeholderPhone")}
                    register={phoneForm.register("phone")}
                    error={phoneErrors.phone?.message}
                />

                <div className="text-center">
                    <button
                        type="submit"
                        className="submit-button py-3"
                        disabled={phoneForm.formState.isSubmitting}
                    >
                        {phoneForm.formState.isSubmitting ? <LoadingCircle/> : t("authen.sendCodeButton")}
                    </button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={onSubmitCode} className="space-y-5" noValidate>
            {apiErrorState && (
                <p className="text-red-500 text-sm text-center mb-4">
                    {apiErrorState}
                </p>
            )}

            <p className="text-sm text-gray-600 text-center -mt-2">
                {t("authen.labelOTP")}<br/>
                <span className="font-medium text-gray-800">{phone}</span>
            </p>

            <CustomInput
                label={t("authen.labelOTP")}
                type="text"
                name="code"
                autoComplete="one-time-code"
                placeholder={t("authen.placeholderOTP")}
                register={codeForm.register("code")}
                error={codeErrors.code?.message}
            />

            <div className="text-center">
                <button
                    type="submit"
                    className="submit-button py-3"
                    disabled={codeForm.formState.isSubmitting}
                >
                    {codeForm.formState.isSubmitting ? <LoadingCircle/> : t("authen.btnVerifyOTP")}
                </button>

                <div className="flex justify-between text-sm text-primary mt-4">
                    <button type="button" onClick={onChangeNumber} className="hover:underline">
                        {t("authen.changePhoneNumber")}
                    </button>
                    <button
                        type="button"
                        onClick={onResend}
                        disabled={cooldown > 0}
                        className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                    >
                        {cooldown > 0 ? `${t("authen.resendCode")} (${cooldown}s)` : t("authen.resendCode")}
                    </button>
                </div>
            </div>
        </form>
    );
};
