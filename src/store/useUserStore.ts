import { create } from "zustand";
import {LocalUser, MyUserInfo, Person} from "@108-plaza/jh-client";
import type { Claims } from "@/services/UserService";

type UserStore = {
  user: LocalUser | null;
  person: Person | null;
  userInfo: MyUserInfo | null;
  claims: Claims | null;
  online: boolean;
  setUser: (user: LocalUser | null) => void;
  setPerson: (person: Person | null) => void;
  setUserInfo: (userInfo: MyUserInfo | null) => void;
  setClaims: (claims: Claims | null) => void;
  updateUser: (updatedData: Partial<LocalUser>) => void;
  updatePerson: (updatedData: Partial<Person>) => void;
  updateUserInfo: (updatedData: Partial<MyUserInfo>) => void;
  clearUser: () => void;
  clearPerson: () => void;
  resetStore: () => void;
  setOnline: (status: boolean) => void;
  getOnline: () => boolean;
};

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  person: null,
  userInfo: null,
  claims: null,
  online: false,
  setUser: (user) => set({ user }),
  setPerson: (person) => set({ person }),
  setUserInfo: (userInfo) => set({ userInfo }),
  setClaims: (claims) => set({ claims }),
  updateUser: (updatedData) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updatedData } : null })),
  updatePerson: (updatedData) =>
    set((state) => ({ person: state.person ? { ...state.person, ...updatedData } : null })),
  updateUserInfo: (updatedData) =>
    set((state) => ({ userInfo: state.userInfo ? { ...state.userInfo, ...updatedData } : null })),
  clearUser: () => set({ user: null }),
  clearPerson: () => set({ person: null }),
  resetStore: () => set({ user: null, person: null, userInfo: null, claims: null, online: false }),
  setOnline: (status) => set({ online: status }),
  getOnline: () => get().online,
}));