"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import { GestionInventarioPage } from "@/components/GestionInventario";

export default function GestionInventarioRoute() {
  const { tieneAlguno } = usePermisos();
  const { loadingContext } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (
      !loadingContext &&
      !tieneAlguno([
        "operaciones.inventario.acceder",
        "operaciones.movimientos.acceder",
      ])
    ) {
      router.push("/forbidden");
    }
  }, [loadingContext]);

  return <GestionInventarioPage />;
}
