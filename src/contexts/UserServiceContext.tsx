"use client";
import React, {createContext, useContext, useMemo, useRef, useLayoutEffect, useState} from "react";
import {UserService} from "@/services/UserService";
import {useUserStore} from "@/store/useUserStore";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {RoomView} from "@/modules/chat/types";
import {useGlobalLoader} from "@/hooks/ui/GlobalLoaderContext";
import {getAuthJWTCookie, IsoData} from "@/utils";
import {useSiteStore} from "@/store/useSiteStore";
import {useCategoriesStore} from "@/store/useCategoriesStore";
import {useBankAccountsStore} from "@/store/useBankAccountStore";
import {BankAccountView} from "108heros-client";

// Instance type for the singleton user service
type UserClient = UserService;

interface UserServiceContextType {
    user: UserClient;
}

// Narrowing helpers to avoid `as any` and keep calls type-safe

function hasSetToken(x: unknown): x is { setToken: (t?: string | null) => unknown } {
    return !!x && typeof (x as any).setToken === "function";
}

const UserServiceContext = createContext<UserServiceContextType | undefined>(
    undefined
);

interface UserServiceProviderProps {
    children: React.ReactNode;
    isoData: IsoData | null
}

export function UserServiceProvider({children, isoData}: UserServiceProviderProps) {
    // Snapshot ISO data once per mount
    const isoMyUser = useMemo(() => isoData ?? null, []);
    const token = isoData?.jwt ?? getAuthJWTCookie();
    const initialRooms: RoomView[] = useMemo(
        () => ((isoMyUser?.chatRooms?.rooms ?? []).map(r => ({...r, isActive: false})) as RoomView[]),
        [isoMyUser]
    );
    const initialBankAccounts: BankAccountView[] = useMemo(() => ((isoMyUser?.bankAccounts?.bankAccounts ?? []).map(b => ({...b})) as BankAccountView[]), [isoMyUser])
    const setUser = useUserStore((s) => s.setUser);
    const setPerson = useUserStore((s) => s.setPerson);
    const setUserInfo = useUserStore((s) => s.setUserInfo);
    const setRoom = useRoomsStore((s) => s.setRooms);
    const setPagination = useRoomsStore((s) => s.setPagination);
    const setSiteRes = useSiteStore((s) => s.setSiteRes);
    const setCategories = useCategoriesStore((s) => s.setCategories);
    const setBankAccounts = useBankAccountsStore((s) => s.setBankAccounts);
    const user = UserService.Instance;

    const seededRef = useRef(false);
    const [ready, setReady] = useState(false);

    const {showLoader, hideLoader} = useGlobalLoader();

    // Run-once hydration: useLayoutEffect so it happens before paint (earlier than useEffect)
    useLayoutEffect(() => {
        if (seededRef.current) return;
        seededRef.current = true;

        // Seed stores from ISO snapshot
        if (isoMyUser) {
            // user-related
            setUser(isoMyUser?.myUserInfo?.localUserView?.localUser ?? null);
            setPerson(isoMyUser?.myUserInfo?.localUserView?.person ?? null);
            setUserInfo(isoMyUser.myUserInfo ?? null);
            setRoom(initialRooms);
            setPagination(isoMyUser.chatRooms?.nextPage ?? null);
            setBankAccounts(initialBankAccounts);
            // site + categories
            if (isoMyUser.siteRes) {
                setSiteRes(isoMyUser.siteRes);
            }
            if (isoMyUser.categories) {
                setCategories(isoMyUser.categories);
            }
        }

        // Only block UI with loader if we actually need to apply a token
        if (token && hasSetToken(user)) {
            showLoader();
            (async () => {
                try {
                    await user.setToken(token);
                } catch {
                    // swallow setToken errors to avoid blocking first paint
                } finally {
                    hideLoader();
                    setReady(true);
                }
            })();
        } else {
            setReady(true);
        }
    }, [isoMyUser, token, user, setUser, setPerson, setUserInfo, setRoom, setSiteRes, setCategories, showLoader, hideLoader]);

    const value = useMemo<UserServiceContextType>(() => ({user}), [user]);

    return (
        <UserServiceContext.Provider value={value}>
            {ready ? children : null}
        </UserServiceContext.Provider>
    );
}

// Hook สำหรับใช้งานใน component อื่น ๆ
export function useUserService(): UserClient {
    const ctx = useContext(UserServiceContext);
    if (!ctx) {
        throw new Error("useUserService must be used within UserServiceProvider");
    }
    return ctx.user;
}