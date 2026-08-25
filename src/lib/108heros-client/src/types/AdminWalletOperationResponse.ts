import {WalletId} from "./WalletId";
import {Coin} from "./Coin";

export type AdminWalletOperationResponse = {
    walletId: WalletId;
    newBalance: Coin;
    operationAmount: Coin;
    reason: string;
    success: boolean;
};
