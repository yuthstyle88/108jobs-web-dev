import {create} from "zustand";
import type {BankAccountId, BankAccountView} from "108heros-client";

export type BankAccountsStore = {
    bankAccounts: BankAccountView[] | null;

    // Actions
    setBankAccounts: (data: BankAccountView[] | null) => void;
    upsertBankAccount: (account: BankAccountView) => void;
    setDefaultBankAccount: (accountId: BankAccountId) => void;
    deleteBankAccount: (accountId: BankAccountId) => void;
    clear: () => void;
};

export const useBankAccountsStore = create<BankAccountsStore>((set, get) => ({
    bankAccounts: null,

    setBankAccounts: (data) => set({bankAccounts: data}),

    upsertBankAccount: (account) =>
        set((state) => {
            if (!state.bankAccounts) return {bankAccounts: [account]};

            const exists = state.bankAccounts.find(
                (a) => a.userBankAccount.id === account.userBankAccount.id
            );

            // Update if exists, otherwise add new
            const updated = exists
                ? state.bankAccounts.map((a) =>
                    a.userBankAccount.id === account.userBankAccount.id ? account : a
                )
                : [...state.bankAccounts, account];

            return {bankAccounts: updated};
        }),

    setDefaultBankAccount: (accountId) =>
        set((state) => {
            if (!state.bankAccounts) return state;

            const updated = state.bankAccounts.map((a) => ({
                ...a,
                userBankAccount: {
                    ...a.userBankAccount,
                    isDefault: a.userBankAccount.id === accountId,
                },
            }));

            return {bankAccounts: updated};
        }),

    deleteBankAccount: (accountId) =>
        set((state) => {
            if (!state.bankAccounts) return state;

            const updated = state.bankAccounts.filter(
                (a) => a.userBankAccount.id !== accountId
            );

            return {bankAccounts: updated.length ? updated : null};
        }),

    clear: () => set({bankAccounts: null}),
}));
