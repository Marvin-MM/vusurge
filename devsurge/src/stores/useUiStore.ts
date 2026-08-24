import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WorkspaceType } from "@/types";

interface UiState {
  activeWorkspace: WorkspaceType;
  activeOrganizationId: string | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  themeMode: "light" | "dark" | "system";
  notificationDrawerOpen: boolean;

  setWorkspace: (workspace: WorkspaceType) => void;
  setActiveOrganizationId: (orgId: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  setNotificationDrawerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeWorkspace: "participant",
      activeOrganizationId: null,
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      themeMode: "light",
      notificationDrawerOpen: false,

      setWorkspace: (workspace) => set({ activeWorkspace: workspace }),
      setActiveOrganizationId: (orgId) => set({ activeOrganizationId: orgId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setThemeMode: (mode) => {
        set({ themeMode: mode });
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (mode === "dark") {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
        }
      },
      setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),
    }),
    {
      name: "vusurge-ui-preferences",
      partialize: (state) => ({
        activeWorkspace: state.activeWorkspace,
        activeOrganizationId: state.activeOrganizationId,
        sidebarCollapsed: state.sidebarCollapsed,
        themeMode: state.themeMode,
      }),
    }
  )
);
