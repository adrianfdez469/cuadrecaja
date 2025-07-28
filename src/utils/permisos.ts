"use client";

import { useSession } from "next-auth/react";
import { tienePermiso as verificarPermiso, parsearPermisos } from "./getPermisosUsuario";

/**
 * Hook personalizado para manejar permisos del usuario
 */
export function usePermisos() {
  const { data: session } = useSession();
  
  const permisos = session?.user?.permisos || "";
  
  return {
    permisos,
    verificarPermiso: (permiso: string) => verificarPermiso(permisos, permiso),
    listaPermisos: parsearPermisos(permisos),
    puedeAcceder: (permisosRequeridos: string[]) => {
      return permisosRequeridos.some(p => verificarPermiso(permisos, p));
    },
    tieneAlguno: (permisosRequeridos: string[]) => {
      return permisosRequeridos.some(p => verificarPermiso(permisos, p));
    },
    tieneTodos: (permisosRequeridos: string[]) => {
      return permisosRequeridos.every(p => verificarPermiso(permisos, p));
    }
  };
}

/**
 * Función para verificar permisos en componentes de servidor
 */
export function verificarPermisoUsuario(permisosUsuario: string, permisoRequerido: string): boolean {
  return verificarPermiso(permisosUsuario, permisoRequerido);
}

/**
 * Función para verificar múltiples permisos en componentes de servidor
 */
export function verificarPermisosUsuario(
  permisosUsuario: string, 
  permisosRequeridos: string[], 
  requiereTodos: boolean = false
): boolean {
  if (requiereTodos) {
    return permisosRequeridos.every(p => verificarPermiso(permisosUsuario, p));
  } else {
    return permisosRequeridos.some(p => verificarPermiso(permisosUsuario, p));
  }
} 