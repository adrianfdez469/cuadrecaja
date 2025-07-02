import { ILocal } from "@/types/ILocal";
import { INegocio } from "@/types/INegocio";

export default async function(req: Request): Promise<{
  id: string,
  rol: string,
  nombre: string,
  usuario: string,
  negocio: INegocio,
  tienda: ILocal,
  tiendas: ILocal[]
}> {
  try {
    const headers = new Headers(await req.headers);
    
    const userId = headers.get('x-user-id');
    const userRol = headers.get('x-user-rol');
    const nombre = headers.get('x-user-nombre');
    const usuario = headers.get('x-user-usuario');

    if (!userId) {
      throw new Error('No autorizado - Token de usuario no encontrado');
    }

    // Parsear negocio de forma segura
    let negocio: INegocio;
    try {
      const negocioHeader = headers.get('x-user-negocio');
      if (!negocioHeader) {
        throw new Error('Header x-user-negocio no encontrado');
      }
      negocio = JSON.parse(negocioHeader);
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear negocio:', error);
      throw new Error('Error al obtener información del negocio');
    }

    // Parsear tienda actual de forma segura
    let tienda: ILocal;
    try {
      const tiendaHeader = headers.get('x-user-localActual');
      if (!tiendaHeader) {
        throw new Error('Header x-user-localActual no encontrado');
      }
      tienda = JSON.parse(tiendaHeader);
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear tienda actual:', error);
      throw new Error('Error al obtener información de la tienda actual');
    }

    // Parsear tiendas de forma segura
    let tiendas: ILocal[];
    try {
      const tiendasHeader = headers.get('x-user-locales');
      if (!tiendasHeader) {
        throw new Error('Header x-user-locales no encontrado');
      }
      tiendas = JSON.parse(tiendasHeader);
    } catch (error) {
      console.error('❌ [getUserFromRequest] Error al parsear tiendas:', error);
      throw new Error('Error al obtener información de las tiendas');
    }

    return {
      id: userId,
      rol: userRol || '',
      nombre: nombre || '',
      usuario: usuario || '',
      negocio,
      tienda,
      tiendas
    };
    
  } catch (error) {
    console.error('❌ [getUserFromRequest] Error crítico:', error);
    throw error;
  }
} 