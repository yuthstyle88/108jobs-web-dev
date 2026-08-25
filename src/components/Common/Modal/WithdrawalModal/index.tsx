"use client";

import { faCoins, faUniversity, faPlus, faShieldAlt, faShield } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import { Dispatch, SetStateAction, useState } from "react";
import { BankAccountId, BankAccountView } from "108heros-client";
import { useRouter } from "next/navigation";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    banks: BankAccountView[];
    withdrawAmount: string;
    setWithdrawAmount: Dispatch<SetStateAction<string>>;
    withdrawReason: string;
    setWithdrawReason: Dispatch<SetStateAction<string>>;
    onSubmit: () => void;
};

const WithdrawalModal = ({
                             isOpen,
                             onClose,
                             balance,
                             banks,
                             withdrawAmount,
                             setWithdrawAmount,
                             withdrawReason,
                             setWithdrawReason,
                             onSubmit,
                         }: Props) => {
    const { t, i18n } = useTranslation();
    const router = useRouter();

    // Filter only verified banks for selection, but keep default selection logic
    const verifiedBanks = banks.filter(b => b.userBankAccount.isVerified);
    const hasVerifiedBank = verifiedBanks.length > 0;

    const [selectedBankId, setSelectedBankId] = useState<BankAccountId | null>(null);

    // Auto-select first verified bank when banks change: use the user's explicit
    // selection if it's still a valid verified bank, otherwise fall back to the
    // first verified bank. Computed during render instead of via an effect.
    const bankId: BankAccountId =
        (selectedBankId !== null && verifiedBanks.some(b => b.userBankAccount.id === selectedBankId)
            ? selectedBankId
            : verifiedBanks[0]?.userBankAccount.id) ?? 0;

    // ---- Validation ---------------------------------------------------------
    const amountNum = parseFloat(withdrawAmount) || 0;
    const isValid =
        amountNum > 0 &&
        amountNum <= balance &&
        hasVerifiedBank &&
        !!bankId &&
        withdrawReason.trim().length > 0;

    // ---- Handlers -----------------------------------------------------------
    const handleConfirm = () => {
        if (!isValid) return;
        onSubmit();
        setWithdrawAmount("");
        setWithdrawReason("");
        onClose();
    };

    const handleCancel = () => {
        setWithdrawAmount("");
        setWithdrawReason("");
        onClose();
    };

    const handleAddBank = () => {
        router.push(`/${i18n.language}/account-setting/bank-account`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                    {t("profileCoins.withdrawRequest") || "Withdrawal Request"}
                </h2>

                {/* ---------- Amount ---------- */}
                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("profileCoins.amount") || "Amount (Coins)"}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="100"
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-800 text-lg font-medium"
                        />
                        <FontAwesomeIcon
                            icon={faCoins}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600 text-lg"
                        />
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                        <span className="text-gray-500">
                            {t("profileCoins.available") || "Available"}: <strong>{balance.toLocaleString()}</strong> coins
                        </span>
                        {withdrawAmount && amountNum > balance && (
                            <span className="text-red-600 font-medium">Insufficient balance</span>
                        )}
                    </div>
                </div>

                {/* ---------- Bank Selection ---------- */}
                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("profileCoins.selectBank") || "Select Bank Account"}
                    </label>

                    {hasVerifiedBank ? (
                        <div className="relative">
                            <select
                                value={bankId}
                                onChange={(e) => setSelectedBankId(Number(e.target.value))}
                                className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-800 appearance-none font-medium"
                            >
                                {verifiedBanks.map((b) => (
                                    <option key={b.userBankAccount.id} value={b.userBankAccount.id}>
                                        {b.bank.name} •••• {b.userBankAccount.accountNumber.slice(-4)} ({b.userBankAccount.accountName})
                                    </option>
                                ))}
                            </select>
                            <FontAwesomeIcon
                                icon={faUniversity}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-lg pointer-events-none"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    ) : banks.length > 0 ? (
                        /* Has banks but none verified */
                        <div className="space-y-3">
                            <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <FontAwesomeIcon icon={faShield} className="w-5 h-5 text-orange-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-orange-900">{t("profileCoins.bankVerificationNotice.title")}</p>
                                        <p className="text-sm text-orange-800 mt-1">
                                            {t("profileCoins.bankVerificationNotice.description")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Show unverified banks (disabled) */}
                            <div className="space-y-2">
                                {banks.map((b) => (
                                    <div
                                        key={b.userBankAccount.id}
                                        className="flex items-center justify-between p-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl opacity-60"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FontAwesomeIcon icon={faShieldAlt} className="text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-700">{b.bank.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {b.userBankAccount.accountNumber} • {b.userBankAccount.accountName}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                                            {t("sellerBankAccount.unverified")}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleAddBank}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                {t("sellerBankAccount.buttonAddBank") || "Add New Bank Account"}
                            </button>
                        </div>
                    ) : (
                        /* No banks at all */
                        <div className="p-5 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-center">
                            <p className="text-yellow-900 font-medium mb-3">
                                {t("profileCoins.noBank") || "No bank account added yet"}
                            </p>
                            <button
                                onClick={handleAddBank}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                {t("sellerBankAccount.buttonAddBank") || "Add Bank Account"}
                            </button>
                        </div>
                    )}
                </div>

                {/* ---------- Reason ---------- */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("profileCoins.reason") || "Reason for Withdrawal"}
                    </label>
                    <textarea
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder="e.g., Monthly earnings payout, project completion..."
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-800 resize-none"
                    />
                </div>

                {/* ---------- Buttons ---------- */}
                <div className="flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all shadow-md ${
                            isValid
                                ? "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:shadow-lg transform hover:-translate-y-0.5"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        {t("global.buttonConfirm") || "Confirm Withdrawal"}
                    </button>
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all"
                    >
                        {t("global.buttonCancel") || "Cancel"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WithdrawalModal;