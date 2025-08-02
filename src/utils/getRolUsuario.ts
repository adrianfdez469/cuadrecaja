import { prisma } from "@/lib/prisma";

/**
 * Obtiene el rol de un usuario para una tienda específica
 * @param usuarioId - ID del usuario
 * @param tiendaId - ID de la tienda actual
 * @returns Nombre del Rol o cadena vacía si no existe
 */
export async function getRolUsuario(usuarioId: string, tiendaId: string | null): Promise<string> {
  try {

    console.log('getRolUsuario');
    

    // Si no hay tienda actual, no hay permisos específicos
    if (!tiendaId) {
      console.log('No hay tiendaId');
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
        rol: true,
        usuario: true
      }
    });

    // Si no hay relación o no hay rol asignado, devolver cadena vacía
    if (!usuarioTienda || !usuarioTienda.rol) {
      return "";
    }

    // Devolver los permisos del rol
    return usuarioTienda.rol.nombre || '';
  } catch (error) {
    console.error("❌ [getRolUsuario] Error al obtener el rol:", error);
    return "";
  }
}