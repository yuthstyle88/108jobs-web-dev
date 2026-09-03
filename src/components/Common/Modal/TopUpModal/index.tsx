import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCoins, faTimes} from "@fortawesome/free-solid-svg-icons";
import {useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {QRCodeCanvas} from "qrcode.react";
import {callHttp, isSuccess} from "@/services/HttpService";
import {type TopUpResponse, TopUpStatus} from "@108-plaza/jh-client";
import LoadingMultiCircle from "@/components/Common/Loading/LoadingMultiCircle";

interface TopUpModalProps {
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
    /** Baht, as typed into the coin page. Converted to satang on the wire. */
    selectedAmount: number | null;
}

/** How often to ask the server whether the money arrived. */
const POLL_INTERVAL_MS = 10_000;

const TopUpModal = ({
                        isModalOpen,
                        setIsModalOpen,
                        selectedAmount,
                    }: TopUpModalProps) => {
    const {t} = useTranslation();
    // An EMVCo payload string, not an image. The Payment-Platform returns the
    // payload and this component draws the QR; SCB used to return a ready-made
    // base64 PNG, which is why this used to be `qrImage`.
    const [qrPayload, setQrPayload] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
    const lastAmountRef = useRef<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const apiCheckRef = useRef<NodeJS.Timeout | null>(null);

    const canRequest = isModalOpen && typeof selectedAmount === "number" && selectedAmount > 0;

    // Format countdown time (MM:SS)
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    };

    // Open the top-up: one call now returns both the QR and the deadline.
    useEffect(() => {
        if (!canRequest) {
            setQrPayload(null);
            setError(null);
            setLoading(false);
            setPaymentStatus("pending");
            setPaymentIntentId(null);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (apiCheckRef.current) {
                clearInterval(apiCheckRef.current);
                apiCheckRef.current = null;
            }
            return;
        }

        if (qrPayload && lastAmountRef.current === selectedAmount) return;

        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                setQrPayload(null);
                setPaymentStatus("pending");
                setPaymentIntentId(null);

                // Satang on the wire. The server bounds this against its own
                // configured min/max and decides everything else about the
                // payment — the old endpoint let the client dictate the whole
                // bank QR body, amount included.
                const amountMinor = Math.round((selectedAmount ?? 0) * 100);
                const res = await callHttp("createTopUp", {amountMinor});
                if (!isSuccess<TopUpResponse>(res)) {
                    throw new Error((res as any).err?.message || "Failed to open the top-up");
                }
                if (cancelled) return;

                const topUp = res.data;
                if (!topUp?.paymentIntentId || !topUp?.qrPayload) {
                    setError("qrIdMissing");
                    setPaymentStatus("failed");
                    setLoading(false);
                    return;
                }

                setPaymentIntentId(topUp.paymentIntentId);
                setQrPayload(topUp.qrPayload);
                lastAmountRef.current = selectedAmount ?? null;

                // The deadline is the server's, read off the row it just wrote,
                // so the countdown cannot disagree with when the QR actually
                // lapses. It used to be a hardcoded 300 on each side.
                const secondsLeft = Math.max(
                    0,
                    Math.floor((new Date(topUp.expiresAt).getTime() - Date.now()) / 1000),
                );
                setCountdown(secondsLeft);

                timerRef.current = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            if (timerRef.current) {
                                clearInterval(timerRef.current);
                                timerRef.current = null;
                            }
                            if (apiCheckRef.current) {
                                clearInterval(apiCheckRef.current);
                                apiCheckRef.current = null;
                            }
                            setPaymentStatus("failed");
                            setError("stillDoNotPayYet");
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } catch (e: any) {
                if (!cancelled) {
                    setError(e?.message || "Unexpected error");
                    setPaymentStatus("failed");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (apiCheckRef.current) {
                clearInterval(apiCheckRef.current);
                apiCheckRef.current = null;
            }
        };
    }, [canRequest, selectedAmount, isModalOpen]);

    // Poll for payment. The server answers with a status, so there is nothing
    // left to infer -- the old code guessed from a bank code (`0 || 200 ||
    // 1000`) and treated any successful HTTP response as payment.
    useEffect(() => {
        if (!paymentIntentId || paymentStatus !== "pending") return;

        const stopTimers = () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (apiCheckRef.current) {
                clearInterval(apiCheckRef.current);
                apiCheckRef.current = null;
            }
        };

        const checkStatus = async () => {
            try {
                const res = await callHttp("getTopUpStatus", paymentIntentId);
                if (!isSuccess<TopUpResponse>(res)) return;
                if (res.data?.status === TopUpStatus.Success) {
                    stopTimers();
                    setPaymentStatus("success");
                } else if (res.data?.status === TopUpStatus.Expired) {
                    stopTimers();
                    setError("stillDoNotPayYet");
                    setPaymentStatus("failed");
                }
            } catch (e: any) {
                console.error(`Top-up status check failed for ${paymentIntentId}:`, e?.message);
            }
        };

        checkStatus();
        apiCheckRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

        return () => {
            if (apiCheckRef.current) {
                clearInterval(apiCheckRef.current);
                apiCheckRef.current = null;
            }
        };
    }, [paymentIntentId, paymentStatus]);

    if (!isModalOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
            <div
                className="bg-white rounded-2xl max-w-md w-full mx-4 relative overflow-hidden shadow-2xl transform transition-all duration-300 ease-in-out scale-100 hover:scale-[1.02]">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r coin-gradient p-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">
                        {t("profileCoins.topupModalTitle")}
                    </h3>
                    <button
                        className="text-white hover:text-gray-200 transition-colors duration-200"
                        onClick={() => setIsModalOpen(false)}
                        aria-label="Close modal"
                    >
                        <FontAwesomeIcon icon={faTimes} className="text-2xl"/>
                    </button>
                </div>
                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Amount Section */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-600 text-sm font-medium">{t("profileCoins.labelAmountToTopUp")}</p>
                        <p className="text-2xl font-bold text-primary">
                            {selectedAmount?.toLocaleString()} <FontAwesomeIcon
                            icon={faCoins}
                            className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                        />
                        </p>
                    </div>

                    {/* Countdown Timer */}
                    {paymentStatus === "pending" && qrPayload && (
                        <div className="text-center text-gray-700 text-sm font-medium">
                            Time remaining: {formatTime(countdown)}
                        </div>
                    )}

                    {/* QR Code or Status Section */}
                    <div className="rounded-lg p-4 border border-gray-100 bg-gray-50">
                        {paymentStatus === "success" ? (
                            <div className="text-green-600 text-center">
                                {t("profileCoins.topUpSuccessMessage")}
                            </div>
                        ) : paymentStatus === "failed" ? (
                            <div className="text-sm text-red-600 text-center">
                                {t(`profileCoins.${error}`)}
                            </div>
                        ) : (
                            <>
                                <p className="text-gray-700 text-sm font-medium mb-3">
                                    {t("profileCoins.scanQrToPay", {amount: selectedAmount?.toLocaleString()}) ||
                                        `Scan this QR code with your banking app to pay ${selectedAmount?.toLocaleString()} Coins`}
                                </p>
                                {loading && (
                                    <div className="flex justify-center items-center">
                                        <LoadingMultiCircle/>
                                    </div>
                                )}
                                {!loading && qrPayload && (
                                    <div className="flex justify-center bg-white rounded-lg shadow p-4">
                                        <QRCodeCanvas
                                            value={qrPayload}
                                            size={224}
                                            level="M"
                                            aria-label="PromptPay QR code"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
