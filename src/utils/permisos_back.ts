
import { tienePermiso as verificarPermiso } from "./getPermisosUsuario";


/**
 * Función para verificar permisos en componentes de servidor
 */
export function verificarPermisoUsuario(permisosUsuario: string, permisoRequerido: string, userRol: string): boolean {
  if(userRol === "SUPER_ADMIN") {
    return true;
  }
  return verificarPermiso(permisosUsuario, permisoRequerido);
}

/**
 * Función para verificar múltiples permisos en componentes de servidor
 */
export function verificarPermisosUsuario(
  permisosUsuario: string, 
  permisosRequeridos: string[], 
  userRol: string,
  requiereTodos: boolean = false
): boolean {
  if (userRol === "SUPER_ADMIN") {
    return true;
  }
  if (requiereTodos) {
    return permisosRequeridos.every(p => verificarPermiso(permisosUsuario, p));
  } else {
    return permisosRequeridos.some(p => verificarPermiso(permisosUsuario, p));
  }
} 