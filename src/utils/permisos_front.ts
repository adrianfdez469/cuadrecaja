"use client";

import { useSession } from "next-auth/react";
import { tienePermiso as verificarPermiso, parsearPermisos } from "./getPermisosUsuario";

/**
 * Hook personalizado para manejar permisos del usuario
 */
export function usePermisos() {
  const { data: session } = useSession();
  
  const permisos = session?.user?.permisos || "";
  const userRol = session?.user?.rol || "";
  
  const handlerVerificarPermiso = (permiso: string) => {
    if(userRol === "SUPER_ADMIN") {
      return true;
    }
    return verificarPermiso(permisos, permiso);
  }

  const handlerTieneAlguno = (permisosRequeridos: string[]) => {
    if(userRol === "SUPER_ADMIN") {
      return true;
    }
    return permisosRequeridos.some(p => verificarPermiso(permisos, p));
  }

  const handlerTieneTodos = (permisosRequeridos: string[]) => {
    if(userRol === "SUPER_ADMIN") {
      return true;
    }
    return permisosRequeridos.every(p => verificarPermiso(permisos, p));
  }
  
  return {
    permisos,
    verificarPermiso: handlerVerificarPermiso,
    listaPermisos: parsearPermisos(permisos),
    tieneAlguno: handlerTieneAlguno,
    tieneTodos: handlerTieneTodos,
  };
}