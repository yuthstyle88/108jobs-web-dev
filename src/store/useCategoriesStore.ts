import { create } from "zustand";
import type { ListCategoriesResponse } from "108heros-client";

export type CategoriesStore = {
  categories: ListCategoriesResponse | null;
  setCategories: (data: ListCategoriesResponse | null) => void;
  clear: () => void;
};

export const useCategoriesStore = create<CategoriesStore>((set) => ({
  categories: null,
  setCategories: (data) => set({ categories: data }),
  clear: () => set({ categories: null }),
}));
