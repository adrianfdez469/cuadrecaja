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
  const headers = new Headers(await req.headers);
  console.log(headers);
  
  const userId = headers.get('x-user-id');
  const userRol = headers.get('x-user-rol');
  const nombre = headers.get('x-user-nombre');
  const usuario = headers.get('x-user-usuario')

  const negocio = JSON.parse(headers.get('x-user-negocio'));
  // const tienda = JSON.parse(headers.get('x-user-tiendaActual'));
  const tienda = JSON.parse(headers.get('x-user-localActual'));
  // const tiendas = JSON.parse(headers.get('x-user-tiendas'));
  const tiendas = JSON.parse(headers.get('x-user-locales'));

  if (!userId) {
    throw new Error('No autorizado');
  }

  return {
    id: userId,
    rol: userRol,
    nombre,
    usuario,
    negocio,
    tienda,
    tiendas
  };
} 