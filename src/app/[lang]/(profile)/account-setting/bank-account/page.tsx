"use client";

import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpPut} from "@/hooks/api/http/useHttpPut";
import {Pencil, Plus, Star, Trash2, Shield, ShieldOff, CheckCircle2} from "lucide-react";
import {useState} from "react";
import BankAccountModal, {BankAccountFormValues} from "@/components/Common/Modal/AddBankAccountModal";
import ConfirmDeleteModal from "@/components/Common/Modal/DeleteBankModal";
import LoadingBlur from "@/components/Common/Loading/LoadingBlur";
import {useTranslation} from "react-i18next";
import {isFailed, isSuccess} from "@/services/HttpService";
import {useBankAccountsStore} from "@/store/useBankAccountStore";
import {resolveApiErrorMessage} from "@/utils/errorMessage";

const MAX_ACCOUNTS = 3;

const BankAccount = () => {
    const {t} = useTranslation();
    const {
        bankAccounts,
        setDefaultBankAccount: setDefaultBankAccountStore,
        deleteBankAccount: deleteBankAccountStore,
        upsertBankAccount
    } = useBankAccountsStore();

    const [error, setError] = useState<string | null>(null);

    const {data: bankListRes, isMutating: isBankListLoading} = useHttpGet("listBanks");
    const {execute: createBankAccount} = useHttpPost("createBankAccount");
    const {execute: updateBankAccount} = useHttpPut("updateBankAccount");
    const {execute: setDefaultBankAccount} = useHttpPut("setDefaultBankAccount");
    const {execute: deleteBankAccount, isMutating: isDeleting} = useHttpDelete("deleteBankAccount");

    const bankList = bankListRes?.banks || [];

    const normalizedAccounts = (bankAccounts ?? [])
        .map((acc: any) => {
            const userBank = acc?.userBankAccount ?? acc?.userBankAccount;
            const bank = acc?.bank ?? acc?.Bank ?? undefined;
            if (!userBank) return null;
            return {userBankAccount: userBank, bank};
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
            if (a.userBankAccount.isDefault && !b.userBankAccount.isDefault) return -1;
            if (!a.userBankAccount.isDefault && b.userBankAccount.isDefault) return 1;
            if (a.userBankAccount.isVerified && !b.userBankAccount.isVerified) return -1;
            if (!a.userBankAccount.isVerified && b.userBankAccount.isVerified) return 1;
            return a.userBankAccount.accountName.localeCompare(b.userBankAccount.accountName);
        }) as any[];

    const totalAccounts = normalizedAccounts.length;
    const canAddMore = totalAccounts < MAX_ACCOUNTS;

    const [modalOpen, setModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<{ id?: number } & BankAccountFormValues | null>(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deletingAccountId, setDeletingAccountId] = useState<number | null>(null);

    const handleAdd = () => {
        if (!canAddMore) return;
        setEditingAccount(null);
        setModalOpen(true);
    };

    const handleEdit = (account: any) => {
        setEditingAccount({
            id: account.userBankAccount.id,
            bankId: String(account.userBankAccount.bankId),
            accountNumber: account.userBankAccount.accountNumber,
            accountName: account.userBankAccount.accountName,
        });
        setModalOpen(true);
    };

    const handleSubmit = async (data: BankAccountFormValues & { id?: number }) => {
        if (!canAddMore && !data.id) {
            setError(t("sellerBankAccount.maxAccountsLimit", {max: MAX_ACCOUNTS}));
            return;
        }

        const bank = bankList.find((b: any) => String(b.id) === data.bankId);
        if (!bank) return;

        let res;
        if (data.id) {
            res = await updateBankAccount({
                bankAccountId: data.id,
                bankId: Number(data.bankId),
                accountNumber: data.accountNumber,
                accountName: data.accountName,
            });
        } else {
            res = await createBankAccount({
                bankId: Number(data.bankId),
                accountNumber: data.accountNumber,
                accountName: data.accountName,
                countryId: bank.countryId,
            });
        }

        if (isSuccess(res)) {
            upsertBankAccount(res.data.bankAccount);
            setModalOpen(false);
            setError(null);
        }
        if (isFailed(res)) {
            // t() returns the key itself on a miss, not undefined, so an
            // unmapped code previously showed raw text like
            // "sellerBankAccount.someCode". defaultValue is the real check.
            const code = res.err?.name;
            const specific = code ? t(`sellerBankAccount.${code}`, {defaultValue: ""}) : "";
            setError(specific || resolveApiErrorMessage(res.err, t, {fallback: t("error.serverError")}));
        }
    };

    const handleSetDefault = async (id: number) => {
        const account = normalizedAccounts.find(a => a.userBankAccount.id === id);
        if (!account?.userBankAccount.isVerified) return;

        const res = await setDefaultBankAccount({bankAccountId: id});
        if (isSuccess(res)) {
            setDefaultBankAccountStore(id);
        }
    };

    const handleConfirmDelete = (id: number) => {
        setDeletingAccountId(id);
        setConfirmDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (deletingAccountId == null) return;
        const res = await deleteBankAccount({bankAccountId: deletingAccountId});
        if (isSuccess(res)) {
            deleteBankAccountStore(deletingAccountId);
        }
        setConfirmDeleteOpen(false);
        setDeletingAccountId(null);
    };

    return (
        <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {t("sellerBankAccount.bankInfoTitle")}
                        </h2>
                        <p className="text-gray-600 text-base leading-relaxed">
                            {t("sellerBankAccount.bankInfoDescription")}
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                            <span>{t("sellerBankAccount.accountsCount", {
                                count: totalAccounts,
                                max: MAX_ACCOUNTS
                            })}</span>
                            {totalAccounts >= MAX_ACCOUNTS && (
                                <span className="text-orange-600 font-medium">• {t("sellerBankAccount.limitReached")}</span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={!canAddMore}
                        className={`flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-medium transition-all shadow-md ${
                            canAddMore
                                ? "bg-primary text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transform hover:-translate-y-0.5"
                                : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        <Plus className="w-5 h-5"/>
                        <span className="hidden sm:inline">{t("sellerBankAccount.buttonAddBank")}</span>
                    </button>
                </div>
            </div>

            {/* Account List */}
            <div className="p-6 sm:p-8 space-y-5">
                {isBankListLoading && <LoadingBlur text=""/>}

                {normalizedAccounts.length === 0 && !isBankListLoading && (
                    <div className="text-center py-12">
                        <div
                            className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldOff className="w-10 h-10 text-gray-400"/>
                        </div>
                        <p className="text-gray-600 text-lg">{t("sellerBankAccount.noBankFound")}</p>
                        <p className="text-gray-500 text-sm mt-2">{t("sellerBankAccount.addFirstBankAccount")}</p>
                    </div>
                )}

                <div className="grid gap-5">
                    {normalizedAccounts.map((acc) => {
                        const {userBankAccount} = acc;
                        const isDefault = userBankAccount.isDefault;
                        const isVerified = userBankAccount.isVerified === true;

                        return (
                            <div
                                key={userBankAccount.id}
                                className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                                    isDefault
                                        ? "border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-md"
                                        : isVerified
                                            ? "border-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/50"
                                            : "border-gray-300 bg-gray-50"
                                }`}
                            >
                                <div className="p-5 sm:p-6">
                                    {/* Top Status Bar */}
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        {isDefault && (
                                            <span
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm">
                                                <Star className="w-4 h-4 fill-current"/>
                                                {t("sellerBankAccount.defaultAccount")}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {isVerified ? (
                                                <>
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600"/>
                                                    <span
                                                        className="text-emerald-700 font-medium text-sm">{t("global.verified")}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldOff className="w-5 h-5 text-gray-400"/>
                                                    <span
                                                        className="text-gray-500 text-sm">{t("global.unverified")}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bank Info */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                {acc.bank?.name ?? "Unknown Bank"}
                                            </h3>
                                            <div className="mt-2 space-y-1">
                                                <p className="text-gray-700 font-mono text-base">
                                                    •••• •••• •••• {userBankAccount.accountNumber.slice(-4)}
                                                </p>
                                                <p className="text-gray-600 capitalize">{userBankAccount.accountName}</p>
                                            </div>
                                        </div>

                                        {/* Action Buttons - Stack on mobile */}
                                        <div className="flex flex-wrap gap-2 sm:gap-3">
                                            {!isDefault && isVerified && (
                                                <button
                                                    onClick={() => handleSetDefault(userBankAccount.id)}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium shadow-sm hover:shadow"
                                                >
                                                    <Star className="w-4 h-4"/>
                                                    {t("sellerBankAccount.setAsDefault")}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleEdit(acc)}
                                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
                                            >
                                                <Pencil className="w-4 h-4"/>
                                                {t("global.buttonEdit")}
                                            </button>

                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleConfirmDelete(userBankAccount.id)}
                                                    className="flex items-center gap-2 px-4 py-2.5 border border-red-300 bg-white text-red-600 rounded-xl hover:bg-red-50 transition-all text-sm font-medium"
                                                >
                                                    <Trash2 className="w-4 h-4"/>
                                                    {t("global.buttonDelete")}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modals */}
            <BankAccountModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setError(null);
                }}
                initialData={editingAccount}
                onSubmit={handleSubmit}
                bankList={bankList}
                error={error || (!canAddMore && !editingAccount ? t("sellerBankAccount.maxAccountsLimit", {max: MAX_ACCOUNTS}) : null)}
            />

            <ConfirmDeleteModal
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={handleDelete}
                isLoading={isDeleting}
                title={t("sellerBankAccount.confirmDeleteTitle")}
                description={t("sellerBankAccount.confirmDeleteDescription")}
            />
        </div>
    );
};

export default BankAccount;