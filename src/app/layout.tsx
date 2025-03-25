"use client"; // Esto hace que todo el layout sea un Client Component

import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "@/theme";
import Layout from "@/components/Layout";
import { AppProvider } from "@/context/AppContext";
import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          <AppProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <Layout>{children}</Layout>
            </ThemeProvider>
          </AppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
