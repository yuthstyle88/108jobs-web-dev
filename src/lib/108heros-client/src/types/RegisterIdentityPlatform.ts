export type RegisterIdentityPlatform = {
    username?: string;
    email?: string;
    phone?: string;
    password: string;
    passwordVerify?: string;
    selfPromotion?: boolean;
    honeypot?: string;
};
