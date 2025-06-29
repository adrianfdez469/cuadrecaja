"use client"; // Esto hace que todo el layout sea un Client Component

import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "@/theme";
import Layout from "@/components/Layout";
import { AppProvider } from "@/context/AppContext";
import { SessionProvider } from "next-auth/react";
import { MessageProvider } from "@/context/MessageContext";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* Meta tags básicos */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" />
        <meta name="description" content="Sistema de Punto de Venta con capacidad offline completa para gestión de inventario y ventas" />
        <meta name="keywords" content="POS, punto de venta, inventario, ventas, offline, PWA" />
        <meta name="author" content="Cuadre de Caja" />
        
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#1976d2" />
        <meta name="background-color" content="#ffffff" />
        <meta name="display" content="standalone" />
        <meta name="orientation" content="portrait-primary" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Cuadre Caja" />
        
        {/* Apple PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Cuadre Caja" />
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* Microsoft PWA Meta Tags */}
        <meta name="msapplication-TileColor" content="#1976d2" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-128x128.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/icon-128x128.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/icon-96x96.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/icon-72x72.png" />
        
        {/* Preload crítico */}
        <link rel="preload" href="/api/auth/session" as="fetch" crossOrigin="anonymous" />
        
        {/* Título */}
        <title>Cuadre de Caja - POS Offline</title>
      </head>
      <body>
        <SessionProvider>
          <AppProvider>
            <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <MessageProvider>
                  <CssBaseline />
                  <Layout>{children}</Layout>
                </MessageProvider>
              </LocalizationProvider>
            </ThemeProvider>
          </AppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
