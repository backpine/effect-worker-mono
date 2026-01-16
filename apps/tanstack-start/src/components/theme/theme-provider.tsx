import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme?: "light" | "dark";
  systemTheme?: "light" | "dark";
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: undefined,
  systemTheme: undefined,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    // During SSR, always return the default theme to avoid hydration mismatch
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    // Client-side: try to get theme from localStorage
    try {
      const stored = localStorage.getItem(storageKey) as Theme;
      return stored || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark" | undefined>(() => {
    // During SSR, return undefined
    if (typeof window === "undefined") {
      return undefined;
    }

    // Client-side: detect system theme
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [isMounted, setIsMounted] = React.useState(false);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // Ignore localStorage errors
      }
      setThemeState(newTheme);
    },
    [storageKey]
  );

  const applyTheme = React.useCallback(
    (targetTheme: "light" | "dark" | undefined) => {
      if (!targetTheme || typeof document === "undefined") return;

      const root = document.documentElement;

      if (disableTransitionOnChange) {
        const css = document.createElement("style");
        css.appendChild(
          document.createTextNode(
            `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
          )
        );
        document.head.appendChild(css);

        // Force reflow
        (() => window.getComputedStyle(document.body))();

        setTimeout(() => {
          document.head.removeChild(css);
        }, 1);
      }

      if (attribute === "class") {
        root.classList.remove("light", "dark");
        root.classList.add(targetTheme);
      } else {
        root.setAttribute(attribute, targetTheme);
      }
    },
    [attribute, disableTransitionOnChange]
  );

  // Apply theme on mount and when resolvedTheme changes
  React.useEffect(() => {
    if (isMounted) {
      applyTheme(resolvedTheme);
    }
  }, [resolvedTheme, applyTheme, isMounted]);

  // Handle system theme changes
  React.useEffect(() => {
    if (!enableSystem || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [enableSystem]);

  // Hydration effect - apply theme immediately on client
  React.useEffect(() => {
    setIsMounted(true);
    
    // Immediately apply the correct theme on hydration
    const currentTheme = theme === "system" ? systemTheme : theme;
    applyTheme(currentTheme);
  }, [theme, systemTheme, applyTheme]);

  // Prevent flash during SSR by applying theme via script
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    // Create a script that runs before React hydration to prevent FOIT
    const script = document.createElement("script");
    script.innerHTML = `
      try {
        var theme = localStorage.getItem('${storageKey}') || '${defaultTheme}';
        var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        var resolvedTheme = theme === 'system' ? systemTheme : theme;
        
        if (resolvedTheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    `;

    // Only add if not already present
    if (!document.querySelector(`script[data-theme-script]`)) {
      script.setAttribute('data-theme-script', 'true');
      document.head.appendChild(script);
    }
  }, [storageKey, defaultTheme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme: isMounted ? resolvedTheme : undefined,
      systemTheme: isMounted ? systemTheme : undefined,
    }),
    [theme, setTheme, resolvedTheme, systemTheme, isMounted]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};