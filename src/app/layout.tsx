"use client"; // Esto hace que todo el layout sea un Client Component

import { ThemeProvider, CssBaseline } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "@/theme";
import Layout from "@/components/Layout";
import { AppProvider } from "@/context/AppContext";
import { SessionProvider } from "next-auth/react";
import { MessageProvider } from "@/context/MessageContext";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next"

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
        <Analytics />
        <AppRouterCacheProvider>
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
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

// Componente wrapper que decide qué layout usar
function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing, descarga, activación, cuentas (invitación / reset), promotores (público) y páginas de error: sin Layout principal
  const noLayoutPaths = [
    '/',
    '/descargar',
    '/activar',
    '/activar-usuario',
    '/activar-cambio-correo',
    '/restablecer-contrasena',
    '/olvide-contrasena',
    '/login',
    '/forbidden',
    '/activar-promotor',
    '/subscription-expired',
  ];
  const isPromotorPublicArea = pathname === '/promotor' || pathname.startsWith('/promotor/');
  if (noLayoutPaths.includes(pathname) || isPromotorPublicArea) {
    return <>{children}</>;
  }

  // Para todas las demás rutas, usar el Layout principal con autenticación
  return <Layout>{children}</Layout>;
}
