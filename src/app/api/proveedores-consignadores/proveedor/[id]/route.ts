import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';
import { buildTasaSnapshot, convertToBase } from '@/lib/currency';

// Aggregated consignment stock a supplier currently has across the business
// stores. Amounts are expressed in the business base currency, the same unit
// the liquidation rows already carry.
type ConsignmentStockRow = {
    productoId: string;
    nombre: string;
    categoria: string;
    existencia: number;
    precio: number;
    costo: number;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        const user = session?.user;
        const { id } = await params;

        if (!user) {
            return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Debe pasar el id del proveedor' }, { status: 404 })
        }

        const negocioId = user.negocio.id;
        const monedaBase = user.negocio.monedaBase ?? 'CUP';

        const proveedor = await prisma.proveedor.findFirst({
            where: {
                id,
                negocioId,
            },
            include: {
                prodProveedorLiquidacion: {
                    include: {
                        cierre: true,
                        producto: {
                            include: {
                                categoria: true
                            }
                        },
                    }
                },
                // Current stock. A liquidation row only exists for a product
                // sold inside an already closed period, so it cannot answer
                // "what does this supplier have in our stores right now" —
                // consignment entries and bulk imports never produce one.
                productosConsignacion: {
                    where: {
                        deletedAt: null,
                        tienda: { negocioId },
                        // A deleted product renames itself to `<nombre>_ELIMINADO_<ts>`
                        // and only then flags its ProductoTienda rows, so a row left
                        // active while its master is gone must not be listed either.
                        producto: { deletedAt: null },
                    },
                    include: {
                        producto: {
                            include: {
                                categoria: true
                            }
                        },
                    }
                },
            }
        });

        if (!proveedor) {
            return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
        }

        const tasasCambio = await prisma.tasaCambio.findMany({
            where: { negocioId },
            orderBy: { createdAt: 'desc' },
            distinct: ['monedaCode'],
        });
        const tasasActuales = buildTasaSnapshot(tasasCambio);

        // One row per product: the same product can be consigned to several
        // stores, so existencia adds up and prices are weighted by the stock
        // standing behind each of them.
        const stockPorProducto = new Map<string, ConsignmentStockRow & {
            precioPonderado: number;
            costoPonderado: number;
            precioSuma: number;
            costoSuma: number;
            filas: number;
        }>();

        for (const productoTienda of proveedor.productosConsignacion) {
            const precioBase = convertToBase(
                productoTienda.precio,
                productoTienda.monedaPrecioCode ?? monedaBase,
                tasasActuales,
                monedaBase,
            );
            const costoBase = convertToBase(
                productoTienda.costo,
                productoTienda.monedaCostoCode ?? monedaBase,
                tasasActuales,
                monedaBase,
            );
            const existente = stockPorProducto.get(productoTienda.productoId);

            if (existente) {
                existente.existencia += productoTienda.existencia;
                existente.precioPonderado += precioBase * productoTienda.existencia;
                existente.costoPonderado += costoBase * productoTienda.existencia;
                existente.precioSuma += precioBase;
                existente.costoSuma += costoBase;
                existente.filas += 1;
            } else {
                stockPorProducto.set(productoTienda.productoId, {
                    productoId: productoTienda.productoId,
                    nombre: productoTienda.producto.nombre,
                    categoria: productoTienda.producto.categoria?.nombre ?? 'Sin categoría',
                    existencia: productoTienda.existencia,
                    precio: 0,
                    costo: 0,
                    precioPonderado: precioBase * productoTienda.existencia,
                    costoPonderado: costoBase * productoTienda.existencia,
                    precioSuma: precioBase,
                    costoSuma: costoBase,
                    filas: 1,
                });
            }
        }

        const stockConsignacion: ConsignmentStockRow[] = [...stockPorProducto.values()].map((row) => ({
            productoId: row.productoId,
            nombre: row.nombre,
            categoria: row.categoria,
            existencia: row.existencia,
            // Weighted by stock when there is any; a plain average keeps the
            // price readable for a product that is momentarily sold out.
            precio: row.existencia > 0 ? row.precioPonderado / row.existencia : row.precioSuma / row.filas,
            costo: row.existencia > 0 ? row.costoPonderado / row.existencia : row.costoSuma / row.filas,
        }));

        // The raw per-store rows are dropped: the client only consumes the
        // aggregate, and shipping them would leak store-level data it never uses.
        const { productosConsignacion: _productosConsignacion, ...proveedorData } = proveedor;

        return NextResponse.json({ ...proveedorData, stockConsignacion });
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
