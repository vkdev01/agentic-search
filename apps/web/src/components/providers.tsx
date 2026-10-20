"use client";

import { ThemeProvider } from "next-themes";

/** App-wide client providers. Light/dark mode follows the OS until the user picks one (stored by next-themes). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
