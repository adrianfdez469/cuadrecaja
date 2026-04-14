import { IProductoTiendaV2 } from "@/schemas/producto";

/**
 * Calcula la disponibilidad real de un producto, considerando desagregación para productos fracción.
 * @param producto - El producto para calcular disponibilidad
 * @param allProductos - Lista completa de productos para buscar el padre (si es fracción)
 * @returns Objeto con disponibilidadReal, maxPorTransaccion y esFraccion
 */
export function calcularDisponibilidadReal(
  producto: IProductoTiendaV2 | null | undefined,
  allProductos: IProductoTiendaV2[]
): { disponibilidadReal: number; maxPorTransaccion: number; esFraccion: boolean } {
  if (!producto) {
    return { disponibilidadReal: 0, maxPorTransaccion: 0, esFraccion: false };
  }

  if (!producto.producto) {
    return {
      disponibilidadReal: Math.max(0, producto.existencia || 0),
      maxPorTransaccion: Math.max(0, producto.existencia || 0),
      esFraccion: false,
    };
  }

  const existenciaProducto = Math.max(0, producto.existencia || 0);
  const fraccionDeId = producto.producto.fraccionDeId;
  const unidadesPorFraccion = producto.producto.unidadesPorFraccion;

  if (!fraccionDeId || !unidadesPorFraccion || unidadesPorFraccion <= 0) {
    return {
      disponibilidadReal: existenciaProducto,
      maxPorTransaccion: existenciaProducto,
      esFraccion: false,
    };
  }

  if (!Array.isArray(allProductos) || allProductos.length === 0) {
    const maxFraccion = Math.max(0, unidadesPorFraccion - 1);
    return {
      disponibilidadReal: Math.min(existenciaProducto, maxFraccion),
      maxPorTransaccion: Math.min(existenciaProducto, maxFraccion),
      esFraccion: true,
    };
  }

  const productoPadre = allProductos.find((p) => p && p.productoId === fraccionDeId);
  const existenciaPadre = productoPadre ? Math.max(0, productoPadre.existencia || 0) : 0;
  const disponibilidadTotal = existenciaProducto + existenciaPadre * unidadesPorFraccion;
  const maxFraccion = Math.max(0, unidadesPorFraccion - 1);
  const maxPorTransaccion = Math.min(disponibilidadTotal, maxFraccion);

  return {
    disponibilidadReal: disponibilidadTotal,
    maxPorTransaccion: Math.max(0, maxPorTransaccion),
    esFraccion: true,
  };
}
