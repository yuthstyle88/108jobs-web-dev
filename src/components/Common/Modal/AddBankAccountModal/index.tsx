"use client";

import * as z from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import React, {useEffect} from "react";
import Modal from "@/components/ui/Modal";
import {Bank} from "108heros-client";
import {CustomInput} from "@/components/ui/InputField";
import {useTranslation} from "react-i18next";
import {Clock} from "lucide-react";

// Zod schema with dynamic account number validation
const getSchema = (bankList: Bank[], t: (key: string) => string) =>
    z.object({
        bankId: z.string().min(1, t("sellerBankAccount.errorBankRequired")),
        accountNumber: z.string().min(6, t("sellerBankAccount.errorAccountNumberMin")),
        accountName: z.string().min(1, t("sellerBankAccount.errorAccountNameRequired")),
    }).refine(
        (data) => {
            const {bankId, accountNumber} = data;
            if (!bankId) return true; // No bank selected, skip account number validation

            const selectedBank = bankList.find((b) => b.id.toString() === bankId);
            const accountNum = accountNumber.replace(/\s/g, "");

            if (selectedBank?.countryId === "VN") {
                return /^[0-9A-Za-z]{9,15}$/.test(accountNum);
            } else if (selectedBank?.countryId === "TH") {
                return /^\d{10}$/.test(accountNum);
            }
            return true;
        },
        {
            message: t("sellerBankAccount.errorInvalidAccountNumber"),
            path: ["accountNumber"],
        }
    );

export type BankAccountFormValues = z.infer<ReturnType<typeof getSchema>>;

interface BankAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: BankAccountFormValues & { id?: number }) => void; // Change to number
    initialData?: BankAccountFormValues & { id?: number } | null; // Change to number
    bankList?: Bank[];
    isBankListLoading?: boolean;
    isBankListFailed?: boolean;
    onRetryBankList?: () => void;
    error: string | null;
}

const BankAccountModal: React.FC<BankAccountModalProps> = ({
                                                               isOpen,
                                                               onClose,
                                                               onSubmit,
                                                               initialData,
                                                               bankList = [],
                                                               isBankListLoading = false,
                                                               isBankListFailed = false,
                                                               onRetryBankList,
                                                               error
                                                           }) => {
    const {t} = useTranslation();

    const {
        setValue,
        watch,
        handleSubmit,
        reset,
        formState: {errors},
        trigger,
    } = useForm<BankAccountFormValues>({
        resolver: zodResolver(getSchema(bankList, t)),
        defaultValues: {
            bankId: "",
            accountNumber: "",
            accountName: "",
        },
    });

    // Watch form values
    const formValues = watch();
    const {bankId, accountNumber, accountName} = formValues;

    // Trigger re-validation of accountNumber when bankId changes
    useEffect(() => {
        if (bankId) {
            trigger("accountNumber");
        }
    }, [bankId, trigger]);

    // Reset form when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            reset(initialData || {bankId: "", accountNumber: "", accountName: ""});
        }
    }, [initialData, isOpen, reset]);

    const onSubmitForm = (data: BankAccountFormValues) => {
        onSubmit({...data, id: initialData?.id});
    };

    const selectedBank = bankList.find((bank) => bank.id.toString() === bankId);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                onClose();
            }}
            title={
                initialData
                    ? t("sellerBankAccount.buttonEditBank")
                    : t("sellerBankAccount.buttonAddBank")
            }
        >
            {isOpen && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <Clock className="w-5 h-5 text-amber-700"/>
                        </div>
                        <div className="text-sm text-amber-900 leading-relaxed">
                            <p className="font-medium mb-1">
                                {t("sellerBankAccount.verificationWarningTitle", "Yêu cầu xác minh tài khoản")}
                            </p>
                            <p>
                                {initialData
                                    ? t("sellerBankAccount.verificationWarningEdit")
                                    : t("sellerBankAccount.verificationWarningAdd")}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-text-primary">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        {t("sellerBankAccount.bankNameLabel")}
                    </label>
                    {isBankListFailed ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
                            <span className="text-sm text-red-600">
                                {t("error.serverError", "Failed to load banks")}
                            </span>
                            {onRetryBankList && (
                                <button
                                    type="button"
                                    onClick={onRetryBankList}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline ml-2"
                                >
                                    {t("global.buttonRetry", "Retry")}
                                </button>
                            )}
                        </div>
                    ) : (
                        <select
                            value={bankId}
                            disabled={isBankListLoading}
                            onChange={(e) => {
                                setValue("bankId", e.target.value, {shouldValidate: true});
                                console.log("bankId changed:", e.target.value); // Debug
                            }}
                            className="w-full border rounded-md px-3 py-2 text-text-primary"
                            aria-describedby={errors.bankId ? "bankId-error" : undefined}
                        >
                            <option value="">{t("sellerBankAccount.bankNamePlaceholder")}</option>
                            {bankList.map((bank) => (
                                <option key={String(bank.id)} value={String(bank.id)}>
                                    {bank.name} {bank.bankCode && `(${bank.bankCode})`}
                                </option>
                            ))}
                        </select>
                    )}
                    {errors.bankId && (
                        <p id="bankId-error" className="text-red-500 text-sm mt-1">
                            {errors.bankId.message}
                        </p>
                    )}
                </div>


                <div>
                    <CustomInput
                        tag="input"
                        type="text"
                        name={"accountNumber"}
                        value={accountNumber}
                        onChange={(e) => {
                            setValue("accountNumber", e.target.value, {shouldValidate: true});
                        }}
                        label={t("sellerBankAccount.bankAccountNumberLabel")}
                        placeholder={t("sellerBankAccount.bankAccountNumberPlaceholder")}
                        error={errors.accountNumber?.message}
                        required
                        aria-describedby={errors.accountNumber ? "accountNumber-error" : undefined}
                    />
                    {selectedBank && (
                        <p className="text-xs text-gray-600 mt-1">
                            {selectedBank.countryId === "VN"
                                ? t("profileInfo.accountNumberHelperVN", "9-15 digits or letters")
                                : selectedBank.countryId === "TH"
                                    ? t("profileInfo.accountNumberHelperTH", "Exactly 10 digits")
                                    : ""}
                        </p>
                    )}
                </div>

                <div>
                    <CustomInput
                        tag="input"
                        type="text"
                        name={"accountName"}
                        value={accountName}
                        onChange={(e) => {
                            setValue("accountName", e.target.value, {shouldValidate: true});
                            console.log("accountName changed:", e.target.value); // Debug
                        }}
                        label={t("sellerBankAccount.bankAccountName")}
                        placeholder="John Smith"
                        error={errors.accountName?.message}
                        required
                        aria-describedby={errors.accountName ? "accountName-error" : undefined}/>
                </div>

                {error && (
                    <p id="bankId-error" className="text-red-500 text-sm mt-1">
                        {error}
                    </p>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-[#063a68]"
                    >
                        {t("global.buttonSave") || "Save"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default BankAccountModal;