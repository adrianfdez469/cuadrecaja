"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import { GestionInventarioPage } from "@/components/GestionInventario";

export default function GestionInventarioRoute() {
  const { verificarPermiso } = usePermisos();
  const { loadingContext } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (!loadingContext && !verificarPermiso("operaciones.gestion-inventario.acceder")) {
      router.push("/forbidden");
    }
  }, [loadingContext]);

  return <GestionInventarioPage />;
}
