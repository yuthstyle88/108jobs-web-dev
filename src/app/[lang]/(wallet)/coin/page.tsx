"use client";
import TopUpHistory from "@/components/TopUpHistory";
import {faCoins} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useState} from "react";
import {useTranslation} from "react-i18next";
import TopUpModal from "@/components/Common/Modal/TopUpModal";
import {useUserStore} from "@/store/useUserStore";
import WithdrawalModal from "@/components/Common/Modal/WithdrawalModal";
import {useBankAccountsStore} from "@/store/useBankAccountStore";
import {BankAccountId, SubmitWithdrawRequest} from "108jobs-client";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {isSuccess} from "@/services/HttpService";
import {toast} from "sonner";
import WithdrawHistory from "@/components/WithdrawHistory";

const Coins108Heros = () => {
    const {t} = useTranslation();
    const {userInfo} = useUserStore();
    const {bankAccounts} = useBankAccountsStore();
    const [activeTab, setActiveTab] = useState<"top-up" | "withdraw">("top-up");
    const [amount, setAmount] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    // Withdrawal Modal States
    const [isIsWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);
    const [withdrawAmount, setWithdrawAmount] = useState<string>("");
    const [withdrawReason, setWithdrawReason] = useState<string>("");

    const {execute: submitWithdraw} = useHttpPost("submitWithdraw");

    const wallet = userInfo?.wallet;
    const banks = bankAccounts || [];

    // Default bank (first one if exists). Not stored in state since nothing
    // in this component lets the user pick a different bank independently.
    const selectedBank: BankAccountId = banks[0]?.userBankAccount.id ?? 0;

    // Check if amount is valid
    const isValidAmount = !isNaN(parseFloat(amount)) && amount.trim() !== "";
    const isValidWithdrawAmount = !isNaN(parseFloat(withdrawAmount)) && parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= (wallet?.balanceTotal || 0);

    const handleTopUpClick = (amt: number | string) => {
        setSelectedAmount(typeof amt === "string" ? parseFloat(amt) || null : amt);
        setIsModalOpen(true);
    };

    const handleWithdrawSubmit = async () => {
        if (!isValidWithdrawAmount || !selectedBank) return;

        const payload: SubmitWithdrawRequest = {
            walletId: wallet?.id ?? 0,
            bankAccountId: selectedBank,
            amount: parseFloat(withdrawAmount),
            // TODO: source currencyId from wallet/default-currency endpoint once
            // multi-currency wallet schema is wired. Hard-coded to THB (id 1) until then.
            currencyId: 1,
            reason: withdrawReason ?? t("profileCoins.withdrawRequest"),
        };

        const res = await submitWithdraw(payload);
        if (isSuccess(res)) {
            toast(t("profileCoins.withdrawalRequestSent"));
            setIsWithdrawOpen(false);
            setWithdrawAmount("");
            setWithdrawReason("");
        }
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 font-sans">
            {/* Header Section */}
            <div
                className="relative h-[250px] sm:h-[200px] bg-gradient-to-r coin-gradient px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
                <h1 className="relative text-3xl sm:text-4xl font-extrabold text-white drop-shadow-md">
                    {t("profileCoins.titleFastworkCoin")}
                </h1>
                <p className="relative text-lg sm:text-xl text-white/90 text-center max-w-2xl mt-2">
                    {t("profileCoins.subtitleFastworkCoin")}
                </p>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fadeIn">
                <div className="grid grid-cols-1 gap-8">
                    {/* Coin Balance Card */}
                    <div className="flex justify-center">
                        <div
                            className="max-w-lg w-full coin-gradient bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20">
                            <p className="text-indigo-200 text-center text-sm font-medium">
                                {t("profileCoins.labelYourCoin")}
                            </p>
                            <p className="text-5xl font-bold text-center mt-2">
                                {wallet?.balanceTotal?.toLocaleString() || 0}
                            </p>

                            {/* Withdraw Button */}
                            <button
                                onClick={() => setIsWithdrawOpen(true)}
                                className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition-all hover:scale-105 focus:ring-2 focus:ring-red-500"
                            >
                                {t("profileCoins.buttonWithdraw") || "Withdraw Coins"}
                            </button>
                        </div>
                    </div>

                    {/* Top-Up Section */}
                    <div className="max-w-lg mx-auto w-full space-y-8">
                        {/* Specify Amount */}
                        <div>
                            <h3 className="text-gray-800 text-lg font-semibold">
                                {t("profileCoins.labelSpecifyAmount")}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {t("profileCoins.noteMinMax")}
                            </p>
                            <div
                                className="mt-4 flex items-center space-x-4 bg-white p-4 rounded-xl shadow-md border border-gray-100">
                                <FontAwesomeIcon
                                    icon={faCoins}
                                    className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                                />
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Specify the amount 100-500,000"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-800 placeholder-gray-400"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        aria-label="Specify top-up amount"
                                    />
                                    <FontAwesomeIcon
                                        icon={faCoins}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                </div>
                                <button
                                    className={`bg-primary text-white px-6 py-3 rounded-lg transition-all font-medium ${
                                        !isValidAmount ? "opacity-50 cursor-not-allowed" : "hover:scale-105 focus:ring-2"
                                    }`}
                                    onClick={() => handleTopUpClick(amount)}
                                    disabled={!isValidAmount}
                                    aria-label="Top up custom amount"
                                >
                                    {t("profileCoins.buttonTopUp")}
                                </button>
                            </div>
                        </div>

                        {/* Predefined Amounts */}
                        <div>
                            <h3 className="text-gray-800 text-lg font-semibold mb-4">
                                {t("profileCoins.labelChooseAmount")}
                            </h3>
                            <div className="space-y-4">
                                {[5000, 10000].map((coin) => (
                                    <div
                                        key={coin}
                                        className="flex items-center justify-between p-4 bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <FontAwesomeIcon
                                                icon={faCoins}
                                                className="text-2xl text-yellow-500 transition-transform hover:scale-110"
                                            />
                                            <span className="text-gray-800 font-medium">
                                                {coin.toLocaleString()}
                                            </span>
                                        </div>
                                        <button
                                            className="bg-primary text-white px-5 py-2 rounded-lg transition-all hover:scale-105 focus:ring-2"
                                            onClick={() => handleTopUpClick(coin)}
                                            aria-label={`Top up ${coin} coins`}
                                        >
                                            {t("profileCoins.buttonTopUp")} {coin.toLocaleString()}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ---------- Tabs: Top-Up & Withdraw History ---------- */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab("top-up")}
                            className={`flex-1 py-4 px-6 font-medium text-sm transition-all ${
                                activeTab === "top-up"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t("profileCoins.sectionTopUpHistory")}
                        </button>
                        <button
                            onClick={() => setActiveTab("withdraw")}
                            className={`flex-1 py-4 px-6 font-medium text-sm transition-all ${
                                activeTab === "withdraw"
                                    ? "text-red-600 border-b-2 border-red-600"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t("profileCoins.sectionWithdrawHistory")}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === "top-up" ? <TopUpHistory /> : <WithdrawHistory />}
                    </div>
                </div>
            </div>

            {/* Top-Up Modal */}
            <TopUpModal
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                selectedAmount={selectedAmount}
            />

            {/* Withdrawal Request Modal */}
            <WithdrawalModal
                isOpen={isIsWithdrawOpen}
                onClose={() => setIsWithdrawOpen(false)}
                balance={wallet?.balanceAvailable ?? 0}
                banks={banks}
                withdrawAmount={withdrawAmount}
                setWithdrawAmount={setWithdrawAmount}
                withdrawReason={withdrawReason}
                setWithdrawReason={setWithdrawReason}
                onSubmit={handleWithdrawSubmit}
            />

            {/* Custom CSS for Animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out;
                }
            `}</style>
        </div>
    );
};

export default Coins108Heros;