import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface UiState {
  /** Desktop sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Mobile sidebar drawer open state */
  mobileSidebarOpen: boolean;
  /** Current theme preference */
  theme: Theme;
  /** Resolved theme ("system" → actual OS preference) */
  resolvedTheme: "light" | "dark";
  /** Toggle desktop sidebar */
  toggleSidebar: () => void;
  /** Open/close mobile sidebar */
  setMobileSidebarOpen: (open: boolean) => void;
  /** Close mobile sidebar (convenience) */
  closeMobileSidebar: () => void;
  /** Cycle theme: light → dark → system → light */
  toggleTheme: () => void;
  /** Set a specific theme */
  setTheme: (theme: Theme) => void;
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("kb-theme");
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("kb-theme", theme);
}

/** Listen for OS color scheme changes when in system mode */
let systemThemeListener: (() => void) | null = null;

function listenForSystemChanges(dispatch: (theme: "light" | "dark") => void) {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    const resolved = e.matches ? "dark" : "light";
    applyTheme("system");
    dispatch(resolved);
  };
  mq.addEventListener("change", handler);
  systemThemeListener = () => mq.removeEventListener("change", handler);
}

export const useUiStore = create<UiState>()((set) => {
  const initial = getStoredTheme();
  const resolved = resolveTheme(initial);

  // Set up system theme listener
  if (initial === "system") {
    listenForSystemChanges((resolvedTheme) => {
      set({ resolvedTheme });
    });
  }

  applyTheme(initial);

  return {
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
    theme: initial,
    resolvedTheme: resolved,

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

    closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

    toggleTheme: () =>
      set((state) => {
        const order: Theme[] = ["light", "dark", "system"];
        const idx = order.indexOf(state.theme);
        const next = order[(idx + 1) % order.length];
        applyTheme(next);

        // Set up system listener if switching to system
        if (next === "system") {
          listenForSystemChanges((resolvedTheme) => {
            set({ resolvedTheme });
          });
        } else if (systemThemeListener) {
          systemThemeListener();
          systemThemeListener = null;
        }

        return { theme: next, resolvedTheme: resolveTheme(next) };
      }),

    setTheme: (theme: Theme) => {
      applyTheme(theme);

      // Set up or tear down system listener
      if (theme === "system") {
        listenForSystemChanges((resolvedTheme) => {
          set({ resolvedTheme });
        });
      } else if (systemThemeListener) {
        systemThemeListener();
        systemThemeListener = null;
      }

      set({ theme, resolvedTheme: resolveTheme(theme) });
    },
  };
});

// Apply stored theme on module load (redundant with store creation, but ensures consistency)
applyTheme(getStoredTheme());
