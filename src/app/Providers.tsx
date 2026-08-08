"use client";

import { ThemeProvider, CssBaseline } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "@/theme";
import { AppProvider } from "@/context/AppContext";
import { SessionProvider } from "next-auth/react";
import { MessageProvider } from "@/context/MessageContext";
import { OnboardingProvider } from "@/features/onboarding";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LayoutWrapper } from "./LayoutWrapper";

// NextAuth v4's SessionProvider (and possibly other providers pulled in
// here) predates the App Router's "use client" convention and doesn't ship
// its own directive — it only worked before because the root layout that
// rendered it was itself "use client", pulling everything it imported into
// the client bundle transitively. Now that the root layout is a Server
// Component (needed for the `viewport` export), every client-only provider
// has to be bundled explicitly under one "use client" boundary, which is
// this file.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <SessionProvider refetchOnWindowFocus={false}>
        <AppProvider>
          <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <MessageProvider>
                <OnboardingProvider>
                  <CssBaseline />
                  <LayoutWrapper>{children}</LayoutWrapper>
                </OnboardingProvider>
              </MessageProvider>
            </LocalizationProvider>
          </ThemeProvider>
        </AppProvider>
      </SessionProvider>
    </AppRouterCacheProvider>
  );
}
