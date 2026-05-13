import { create } from 'zustand';

export const useCommandStore = create((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}));
