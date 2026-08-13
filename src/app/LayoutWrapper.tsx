"use client";

import { usePathname } from "next/navigation";
import Layout from "@/components/Layout";

// Componente wrapper que decide qué layout usar
export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing, descarga, activación, cuentas (invitación / reset), promotores (público) y páginas de error: sin Layout principal
  const noLayoutPaths = [
    "/",
    "/descargar",
    "/activar",
    "/activar-usuario",
    "/activar-cambio-correo",
    "/restablecer-contrasena",
    "/olvide-contrasena",
    "/login",
    "/forbidden",
    "/activar-promotor",
    "/subscription-expired",
  ];
  const isPromotorPublicArea =
    pathname === "/promotor" || pathname.startsWith("/promotor/");
  if (noLayoutPaths.includes(pathname) || isPromotorPublicArea) {
    return <>{children}</>;
  }

  // Para todas las demás rutas, usar el Layout principal con autenticación
  return <Layout>{children}</Layout>;
}
