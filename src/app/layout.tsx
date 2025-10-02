"use client"; // Esto hace que todo el layout sea un Client Component

import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "@/theme";
import Layout from "@/components/Layout";
import { AppProvider } from "@/context/AppContext";
import { SessionProvider } from "next-auth/react";
import { MessageProvider } from "@/context/MessageContext";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1976d2" />
        <meta name="description" content="Sistema de punto de venta y gestión de inventario" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <SessionProvider>
          <AppProvider>
            <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <MessageProvider>
                  <CssBaseline />
                  <LayoutWrapper>{children}</LayoutWrapper>
                </MessageProvider>
              </LocalizationProvider>
            </ThemeProvider>
          </AppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

// Componente wrapper que decide qué layout usar
function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Si estamos en la landing page, no usar el Layout principal
  if (pathname === '/landing') {
    return <>{children}</>;
  }
  
  // Para todas las demás rutas, usar el Layout principal con autenticación
  return <Layout>{children}</Layout>;
}
