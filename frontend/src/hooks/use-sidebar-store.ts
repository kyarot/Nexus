import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hoveredIcon: string | null;
  setHoveredIcon: (id: string | null) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  hoveredIcon: null,
  setHoveredIcon: (id: string | null) => set({ hoveredIcon: id }),
}));
