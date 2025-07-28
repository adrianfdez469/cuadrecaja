import { prisma } from "@/lib/prisma";

/**
 * Obtiene los permisos de un usuario para una tienda específica
 * @param usuarioId - ID del usuario
 * @param tiendaId - ID de la tienda actual
 * @returns String con permisos separados por "|" o cadena vacía si no hay permisos
 */
export async function getPermisosUsuario(usuarioId: string, tiendaId: string | null): Promise<string> {
  try {
    // Si no hay tienda actual, no hay permisos específicos
    if (!tiendaId) {
      return "";
    }

    // Buscar la relación usuario-tienda con el rol asignado
    const usuarioTienda = await prisma.usuarioTienda.findUnique({
      where: {
        usuarioId_tiendaId: {
          usuarioId,
          tiendaId
        }
      },
      include: {
        rol: {
          select: {
            permisos: true
          }
        }
      }
    });

    // Si no hay relación o no hay rol asignado, devolver cadena vacía
    if (!usuarioTienda || !usuarioTienda.rol) {
      return "";
    }

    // Devolver los permisos del rol
    return usuarioTienda.rol.permisos || "";
  } catch (error) {
    console.error("❌ [getPermisosUsuario] Error al obtener permisos:", error);
    return "";
  }
}

/**
 * Verifica si un usuario tiene un permiso específico
 * @param permisos - String con permisos separados por "|"
 * @param permisoRequerido - Permiso a verificar
 * @returns true si tiene el permiso, false en caso contrario
 */
export function tienePermiso(permisos: string, permisoRequerido: string): boolean {
  if (!permisos || !permisoRequerido) {
    return false;
  }

  const listaPermisos = permisos.split("|");
  return listaPermisos.includes(permisoRequerido);
}

/**
 * Convierte el string de permisos en un array
 * @param permisos - String con permisos separados por "|"
 * @returns Array de permisos
 */
export function parsearPermisos(permisos: string): string[] {
  if (!permisos) {
    return [];
  }
  return permisos.split("|").filter(p => p.trim() !== "");
} 