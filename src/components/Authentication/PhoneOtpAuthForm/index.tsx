"use client";
import LoadingCircle from "@/components/Common/Loading/LoadingCircle";
import {CustomInput} from "@/components/ui/InputField";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useCallback, useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {useTranslation} from "react-i18next";
import {useRouter, useSearchParams} from "next/navigation";
import {completeSignIn} from "@/services/authRedirect";
import {ApiError, REQUEST_STATE} from "@/services/HttpService";
import {normalizeThaiPhone, OtpChallenge, requestOtp, verifyOtp} from "@/services/IdentityOtpService";
import {
    enrollPasskey,
    isPasskeySupported,
    loginWithPasskey,
    rememberedPasskeyIdentifier,
} from "@/services/IdentityPasskeyService";
import {resolveApiErrorMessage} from "@/utils/errorMessage";
import {KeyRound} from "lucide-react";

// Sign in or create an account: a phone number, or nothing else -- mirrors
// 108heros-flutter's PhoneOtpAuthFlow, which the same widget backs for both
// its login and register pages. Login and register are functionally the
// same operation now (phone + OTP, registerIfAbsent always true on the
// server) so there is nothing left for two separate components to do
// differently beyond which page they link back to.
interface PhoneOtpAuthFormProps {
    mode: "login" | "register";
    onSwitchToPassword?: () => void;
}

const RESEND_COOLDOWN_SECONDS = 30;

type Step = "phone" | "code";

// Codes this flow has specific, better-than-generic copy for; anything else
// falls through to resolveApiErrorMessage()'s server-message/code-suffix
// fallback instead of a flat "something went wrong" for every unmapped case.
function errorMessage(t: (key: string, options?: Record<string, unknown>) => string, err?: ApiError): string {
    return resolveApiErrorMessage(err, t, {
        knownCodes: {
            invalid_code: t("authen.invalidOTP"),
            challenge_expired: t("authen.otpExpired"),
            invalid_challenge_state: t("authen.otpExpired"),
            challenge_not_found: t("authen.otpExpired"),
            rate_limited: t("authen.resendLimitReached"),
            too_many_attempts: t("authen.resendLimitReached"),
        },
        fallback: t("authen.apiErrorState"),
    });
}

export const PhoneOtpAuthForm: React.FC<PhoneOtpAuthFormProps> = ({mode, onSwitchToPassword}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || "/";
    const {t, i18n} = useTranslation();

    const [step, setStep] = useState<Step>("phone");
    const [apiError, setApiError] = useState<string | null>(null);
    const [phone, setPhone] = useState("");
    const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const [passkeyIdentifier, setPasskeyIdentifier] = useState<string | null>(null);
    const [passkeyBusy, setPasskeyBusy] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const finishSignIn = useCallback(
        (accessToken: string, refreshToken?: string) => completeSignIn(accessToken, refreshToken, redirectUrl),
        [redirectUrl]);

    const attemptPasskeyLogin = useCallback(async (identifier: string, silent: boolean) => {
            setPasskeyBusy(true);
            if (!silent) setApiError(null);
            const res = await loginWithPasskey(identifier);
            setPasskeyBusy(false);
            if (res.state === REQUEST_STATE.FAILED) {
                // A silent, page-load auto-attempt failing (no matching credential on
                // this device/browser profile, user dismissed the OS prompt, etc.) is
                // routine, not something to alarm someone who hasn't touched anything
                // yet -- only an explicit button press surfaces an error.
                if (!silent) setApiError(errorMessage(t, res.err));
                return;
            }
            await finishSignIn(res.data.accessToken, res.data.refreshToken);
        },
        [finishSignIn, t]);

    // Google sign-in is a plain top-level link to /api/auth/google/start (see
    // that route) -- Identity-Platform does the whole OAuth round trip
    // server-to-server and redirects back here with the session already set,
    // so there is no client-side handler for it. This only surfaces the
    // error state /api/auth/google/callback redirects to on failure.
    useEffect(() => {
        if (searchParams.get("error") === "google") {
            setApiError(t("authen.apiErrorState"));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mirrors 108heros-flutter's PhoneOtpAuthFlow(autoPasskey: ...): login
    // auto-attempts a passkey sign-in for whichever identifier this browser
    // last enrolled one for; register never does (unsolicited biometric
    // prompt on a screen nobody has claimed an account on yet).
    useEffect(() => {
        if (!isPasskeySupported()) return;
        const identifier = rememberedPasskeyIdentifier();
        setPasskeyIdentifier(identifier);
        if (mode === "login" && identifier) {
            void attemptPasskeyLogin(identifier, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

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
            setApiError(null);
            const res = await requestOtp(normalized);
            if (res.state === REQUEST_STATE.FAILED) {
                setApiError(errorMessage(t, res.err));
                return;
            }
            setPhone(normalized);
            setChallenge(res.data);
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setStep("code");
        },
        [phoneForm, t]);

    const onSubmitPhone = phoneForm.handleSubmit((data) => sendCode(data.phone));

    const onResend = useCallback(async () => {
            if (cooldown > 0 || !phone) return;
            await sendCode(phone);
        },
        [cooldown, phone, sendCode]);

    const onChangeNumber = () => {
        setApiError(null);
        codeForm.reset();
        setChallenge(null);
        setStep("phone");
    };

    const onSubmitCode = codeForm.handleSubmit(async (data) => {
        if (!challenge) return;
        setApiError(null);
        const res = await verifyOtp(challenge.challengeId, data.code);
        if (res.state === REQUEST_STATE.FAILED) {
            setApiError(errorMessage(t, res.err));
            return;
        }
        const {login} = res.data;
        // Offered, not required: awaited so the OS prompt gets a chance to
        // show and resolve before the redirect below tears down the page
        // (a hard navigation kills any WebAuthn ceremony still in flight).
        // Skipped when this device already has a passkey for this identifier.
        if (rememberedPasskeyIdentifier() !== phone) {
            await enrollPasskey(login.identityId, login.accessToken, phone);
        }
        await finishSignIn(login.accessToken, login.refreshToken);
    });

    const phoneErrors = phoneForm.formState.errors;
    const codeErrors = codeForm.formState.errors;

    if (step === "phone") {
        return (
            // Both steps render <form> -> CustomInput -> <input> in the same
            // position, so without distinct keys React reconciles them into ONE
            // reused <input> DOM node. react-hook-form registers uncontrolled
            // (ref-based) inputs and never rewrites .value, so whatever the user
            // typed on one step stays visible -- and gets SUBMITTED -- on the
            // other: the phone number arrived pre-filled in the OTP box and was
            // sent as the code, answering a blameless user with "Invalid OTP".
            <form key="phone" onSubmit={onSubmitPhone} className="space-y-5" noValidate>
                {apiError && (
                    <p className="text-red-500 text-sm text-center mb-4">
                        {apiError}
                    </p>
                )}

                {passkeyIdentifier && (
                    <button
                        type="button"
                        onClick={() => attemptPasskeyLogin(passkeyIdentifier, false)}
                        disabled={passkeyBusy}
                        className="cursor-pointer w-full py-3 rounded-md border border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {passkeyBusy ? <LoadingCircle/> : t("authen.signInWithPasskey")}
                    </button>
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

                    {mode === "login" && onSwitchToPassword && (
                        <>
                            <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 border-t border-gray-200"/>
                                <span className="text-xs text-gray-400">{t("authen.labelOr")}</span>
                                <div className="flex-1 border-t border-gray-200"/>
                            </div>
                            <button
                                type="button"
                                onClick={onSwitchToPassword}
                                className="flex items-center justify-center gap-2 cursor-pointer w-full py-3 rounded-md border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition duration-300"
                            >
                                <KeyRound className="h-[18px] w-[18px]"/>
                                {t("authen.buttonLoginPassword")}
                            </button>
                        </>
                    )}

                    {mode === "login" && (
                        <div className="text-sm text-primary mt-4">
                            <button type="button" onClick={() => router.push(`/${i18n.language}/register`)} className="hover:underline">
                                {t("authen.linkCreateAccount")}
                            </button>
                        </div>
                    )}
                </div>
            </form>
        );
    }

    return (
        // Keyed apart from the phone step -- see the comment there.
        <form key="code" onSubmit={onSubmitCode} className="space-y-5" noValidate>
            {apiError && (
                <p className="text-red-500 text-sm text-center mb-4">
                    {apiError}
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
