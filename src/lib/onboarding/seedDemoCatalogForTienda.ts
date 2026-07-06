import type { Prisma, PrismaClient } from "@prisma/client";
import { DEMO_CATEGORIAS, DEMO_PRODUCTOS } from "@/constants/demoCatalog";

type DemoCatalogClient = PrismaClient | Prisma.TransactionClient;

export async function seedDemoCatalogForTienda(
  client: DemoCatalogClient,
  negocioId: string,
  tiendaId: string,
): Promise<void> {
  const categoriasMap: Record<string, string> = {};

  for (const cat of DEMO_CATEGORIAS) {
    let categoria = await client.categoria.findFirst({
      where: { nombre: cat.nombre, negocioId },
    });
    if (!categoria) {
      categoria = await client.categoria.create({
        data: { ...cat, negocioId },
      });
    }
    categoriasMap[cat.nombre] = categoria.id;
  }

  for (const p of DEMO_PRODUCTOS) {
    let producto = await client.producto.findFirst({
      where: { nombre: p.nombre, negocioId },
    });
    if (!producto) {
      producto = await client.producto.create({
        data: {
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoriaId: categoriasMap[p.categoria],
          negocioId,
        },
      });
    }

    const existeEnTienda = await client.productoTienda.findFirst({
      where: { productoId: producto.id, tiendaId, deletedAt: null },
    });
    if (!existeEnTienda) {
      await client.productoTienda.create({
        data: {
          productoId: producto.id,
          tiendaId,
          costo: p.costo,
          precio: p.precio,
          existencia: p.existencia,
        },
      });
    }
  }
}
