import { ILocal } from "@/types/ILocal";
import { INegocio } from "@/types/INegocio";

export default async function(req: Request): Promise<{
  id: string,
  rol: string,
  nombre: string,
  usuario: string,
  negocio: INegocio,
  tienda: ILocal,
  tiendas: ILocal[],
  permisos?: string
}> {
  try {
    const headers = new Headers(await req.headers);
    
    // Función para decodificar valores Base64 de los headers
    const decodeFromHeader = (headerValue: string | null): string => {
      if (!headerValue) return '';
      try {
        return Buffer.from(headerValue, 'base64').toString('utf8');
      } catch (error) {
        console.error('❌ [getUserFromRequest] Error al decodificar header:', error);
        return '';
      }
    };
    
    const userId = decodeFromHeader(headers.get('x-user-id'));
    const userRol = decodeFromHeader(headers.get('x-user-rol'));
    const nombre = decodeFromHeader(headers.get('x-user-nombre'));
    const usuario = decodeFromHeader(headers.get('x-user-usuario'));
    const permisos = decodeFromHeader(headers.get('x-user-permisos')); // Nuevos permisos

    if (!userId) {
      throw new Error('No autorizado - Token de usuario no encontrado');
    }

    // Parsear objetos JSON decodificados
    let negocio: INegocio;
    let tienda: ILocal;
    let tiendas: ILocal[];

    try {
      const negocioDecoded = decodeFromHeader(headers.get('x-user-negocio'));
      negocio = negocioDecoded ? JSON.parse(negocioDecoded) : null;
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear negocio:', error);
      throw new Error('Error al obtener información del negocio');
    }

    try {
      const tiendaDecoded = decodeFromHeader(headers.get('x-user-localActual'));
      tienda = tiendaDecoded ? JSON.parse(tiendaDecoded) : null;
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear tienda actual:', error);
      throw new Error('Error al obtener información de la tienda actual');
    }

    try {
      const tiendasDecoded = decodeFromHeader(headers.get('x-user-locales'));
      tiendas = tiendasDecoded ? JSON.parse(tiendasDecoded) : [];
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear tiendas:', error);
      throw new Error('Error al obtener información de las tiendas');
    }

    return {
      id: userId,
      rol: userRol,
      nombre,
      usuario,
      negocio,
      tienda,
      tiendas,
      permisos: permisos || ""
    };
  } catch (error) {
    console.error('❌ [getUserFromRequest] Error general:', error);
    throw error;
  }
} 