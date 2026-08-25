export type BankAccount = {
  id: number;
  bankId: number;
  bankName: string;
  bankCountryId: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
};

export type BankAccountsResponse = {
  bankAccounts: BankAccount[];
};
