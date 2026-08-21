import {
    ILiquidacionConsignacion,
    IProductoConsignacion,
    IProveedorConsignacion,
} from "@/schemas/proveedor";
import axiosClient from "@/lib/axiosClient";


const API_URL = "/api/proveedores-consignadores";

// Settlement row as returned by the API, one per (closing, product).
interface ILiquidacionApi {
    productoId: string;
    cierreId: string;
    createdAt: string;
    liquidatedAt: string | null;
    monto: number;
    vendidos: number;
    precio: number;
    producto: { nombre: string; deletedAt: string | null; categoria?: { nombre: string } | null };
    cierre: { fechaInicio: string; fechaFin: string };
}

// Current consignment stock, already aggregated per product and expressed in
// the business base currency by the API.
interface IStockConsignacionApi {
    productoId: string;
    nombre: string;
    categoria: string;
    existencia: number;
    precio: number;
    costo: number;
}

interface IProveedorDetalleApi {
    id: string;
    nombre: string;
    telefono: string;
    direccion: string;
    existenciaTotal?: number;
    stockConsignacion?: IStockConsignacionApi[];
    prodProveedorLiquidacion: ILiquidacionApi[];
}

export interface IProveedorDetalle {
    proveedor: IProveedorConsignacion;
    liquidaciones: ILiquidacionConsignacion[];
    productos: IProductoConsignacion[];
}

export const sumDineroLiquidado = (acc, item) => {
    if(item.liquidatedAt !== null) {
        acc += item.monto
    }
    return acc;
};

export const sumDineroPorLiquidar = (acc, item) => {
    if(item.liquidatedAt === null) {
        acc += item.monto
    }
    return acc;
};

export const findUltimaLiquidacion = (acc, item) => {
    if(item.liquidatedAt === null) {
        return acc;
    }
    if(acc === null) {
        return item.liquidatedAt;
    } 
    if(acc < item.liquidatedAt) {
        return item.liquidatedAt;
    } 
    return acc;
}

const mapProveedor = (data: IProveedorDetalleApi): IProveedorConsignacion => {
    const pclc = data.prodProveedorLiquidacion;
    return {
        nombre: data.nombre,
        telefono: data.telefono,
        direccion: data.direccion,
        id: data.id,
        estado: 'activo',
        dineroLiquidado: pclc.reduce(sumDineroLiquidado, 0),
        dineroPorLiquidar: pclc.reduce(sumDineroPorLiquidar, 0),
        // Units currently held, never the sum of the per-closing snapshots.
        // The list endpoint pre-aggregates it; the detail one ships the rows.
        totalProductosConsignacion:
            data.existenciaTotal ??
            (data.stockConsignacion ?? []).reduce((acc, stock) => acc + stock.existencia, 0),
        ultimaLiquidacion: pclc.reduce(findUltimaLiquidacion, null),
    };
};

/**
 * Groups settlement rows by closing period. Pending periods come first, oldest
 * to newest; settled ones follow, newest first.
 */
export const mapLiquidaciones = (pclc: ILiquidacionApi[]): ILiquidacionConsignacion[] => {
    const porCierre = new Map<string, ILiquidacionConsignacion>();

    for (const prodLiq of pclc) {
        const existente = porCierre.get(prodLiq.cierreId);

        if (!existente) {
            porCierre.set(prodLiq.cierreId, {
                id: prodLiq.cierreId,
                fecha: prodLiq.createdAt,
                monto: prodLiq.monto,
                productos: prodLiq.vendidos,
                observaciones: `Liquidación de cierre: ${new Date(prodLiq.cierre.fechaInicio).toLocaleDateString()} - ${new Date(prodLiq.cierre.fechaFin).toLocaleDateString()}`,
                estado: prodLiq.liquidatedAt !== null ? "completada" : "pendiente",
                fechaLiquidacion: prodLiq.liquidatedAt,
            });
            continue;
        }

        existente.monto += prodLiq.monto;
        existente.productos += prodLiq.vendidos;
        // Keep the most recent settlement date among the rows of the period.
        if (
            prodLiq.liquidatedAt &&
            (!existente.fechaLiquidacion ||
                new Date(prodLiq.liquidatedAt) > new Date(existente.fechaLiquidacion))
        ) {
            existente.fechaLiquidacion = prodLiq.liquidatedAt;
        }
    }

    return [...porCierre.values()].sort((a, b) => {
        if (a.estado !== b.estado) {
            return a.estado === 'pendiente' ? -1 : 1;
        }
        const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        // Pending: oldest first, they are the ones waiting to be paid.
        // Settled: most recent first, they are the ones worth reviewing.
        return a.estado === 'pendiente' ? diff : -diff;
    });
};

/**
 * Builds the supplier's product list from the stock it currently holds, joined
 * with what has already been sold for each product.
 *
 * Availability comes from ProductoTienda alone: a settlement row only exists
 * for a product sold inside a closed period, so consignment entries and bulk
 * imports would otherwise be invisible here — and its `existencia` is a
 * snapshot taken at closing time, so adding one per closing multiplied the
 * stock that was actually on the shelf.
 */
export const mapProductosConsignacion = (data: IProveedorDetalleApi): IProductoConsignacion[] => {
    const productos = new Map<string, IProductoConsignacion>();

    for (const stock of data.stockConsignacion ?? []) {
        productos.set(stock.productoId, {
            id: stock.productoId,
            nombre: stock.nombre,
            categoria: stock.categoria,
            precio: stock.precio,
            vendidos: 0,
            disponibles: stock.existencia,
            ganancias: 0,
        });
    }

    for (const prodLiq of data.prodProveedorLiquidacion) {
        // Sold price and cost are historical, taken from the closing itself.
        const ganancia = (prodLiq.vendidos * prodLiq.precio) - prodLiq.monto;
        const existente = productos.get(prodLiq.productoId);

        if (existente) {
            existente.vendidos += prodLiq.vendidos;
            existente.ganancias += ganancia;
            continue;
        }

        // A deleted product keeps its settlement rows — the money owed for it is
        // still real and still shows under Liquidaciones — but it is no longer
        // part of what the supplier has with us, so it does not belong in this
        // list. Its name is a `_ELIMINADO_<timestamp>` placeholder anyway.
        if (prodLiq.producto.deletedAt) {
            continue;
        }

        // Sold in the past but no longer stocked for this supplier: keep it
        // visible with zero availability instead of dropping its sales.
        productos.set(prodLiq.productoId, {
            id: prodLiq.productoId,
            nombre: prodLiq.producto.nombre,
            categoria: prodLiq.producto.categoria?.nombre ?? 'Sin categoría',
            precio: prodLiq.precio,
            vendidos: prodLiq.vendidos,
            disponibles: 0,
            ganancias: ganancia,
        });
    }

    return [...productos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
};

export const getProveedoresConsignacion = async (): Promise<IProveedorConsignacion[]> => {
    const response = await axiosClient.get(API_URL);
    return (response.data as IProveedorDetalleApi[]).map(mapProveedor);
}

export const getProveedoresConsignacionById = async (id: string): Promise<IProveedorDetalle> => {
    const response = await axiosClient.get(`${API_URL}/proveedor/${id}`);
    const data = response.data as IProveedorDetalleApi;

    return {
        proveedor: mapProveedor(data),
        liquidaciones: mapLiquidaciones(data.prodProveedorLiquidacion),
        productos: mapProductosConsignacion(data),
    };
}

export const liquidarProveedorConsignacion = async (cierreId: string, proveedorId: string) => {
    const response = await axiosClient.put(`${API_URL}/cierre/${cierreId}/${proveedorId}`);
    return response.data;
}
