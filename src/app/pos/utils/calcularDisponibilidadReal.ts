import { IProductoTiendaV2 } from "@/schemas/producto";

/**
 * Cuántas unidades de un producto se pueden vender ahora mismo.
 *
 * Para un producto normal es su existencia. Para un producto fracción es su
 * existencia MÁS lo que hay dentro de los padres sin abrir: al vender, el POS
 * desagrega tantos padres como haga falta (ver `packsToOpen` en
 * `src/lib/fractionStock.ts`), así que esas unidades están realmente
 * disponibles aunque todavía estén dentro de una caja.
 *
 * Antes esto se limitaba además a `unidadesPorFraccion - 1` por venta —
 * vender una caja entera suelta debía hacerse desde el padre. Ese tope ya no
 * existe: el vendedor pone la cantidad que necesite y la desagregación se
 * ajusta sola.
 */
export function calcularDisponibilidadReal(
  producto: IProductoTiendaV2 | null | undefined,
  allProductos: IProductoTiendaV2[],
): { disponible: number; esFraccion: boolean } {
  if (!producto) {
    return { disponible: 0, esFraccion: false };
  }

  const existenciaProducto = Math.max(0, producto.existencia || 0);

  if (!producto.producto) {
    return { disponible: existenciaProducto, esFraccion: false };
  }

  const fraccionDeId = producto.producto.fraccionDeId;
  const unidadesPorFraccion = producto.producto.unidadesPorFraccion;

  if (!fraccionDeId || !unidadesPorFraccion || unidadesPorFraccion <= 0) {
    return { disponible: existenciaProducto, esFraccion: false };
  }

  // Sin la lista completa no hay forma de saber cuántos padres hay; queda lo
  // que esté suelto, que es lo único que se puede afirmar.
  if (!Array.isArray(allProductos) || allProductos.length === 0) {
    return { disponible: existenciaProducto, esFraccion: true };
  }

  const productoPadre = allProductos.find(
    (p) => p && p.productoId === fraccionDeId,
  );
  const existenciaPadre = productoPadre
    ? Math.max(0, productoPadre.existencia || 0)
    : 0;

  return {
    disponible: existenciaProducto + existenciaPadre * unidadesPorFraccion,
    esFraccion: true,
  };
}
