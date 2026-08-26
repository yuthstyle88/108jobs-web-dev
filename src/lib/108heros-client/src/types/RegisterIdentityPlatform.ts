export type RegisterIdentityPlatform = {
    username: string;
    email?: string;
    phone?: string;
    password: string;
    selfPromotion?: boolean;
    honeypot?: string;
};
