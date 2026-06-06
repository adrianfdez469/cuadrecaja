"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import {
  getProductosVenta,
  updateProductosTienda,
  createProductoTienda,
} from "@/services/costoPrecioServices";
import { fetchCategories, createCategory } from "@/services/categoryService";
import {
  createProduct,
  editProduct,
  deleteProduct,
} from "@/services/productServise";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { normalizeSearch } from "@/utils/formatters";

export type StockFilter = "todo" | "en_stock" | "bajo_stock" | "sin_stock";
export type ExpiryFilter = "todos" | "proximos" | "vencidos";

export interface EditProductData {
  nombre: string;
  descripcion: string;
  categoriaId: string;
  newCategoriaName?: string;
  newCategoriaColor?: string;
  precio: number;
  costo: number;
  monedaPrecioCode: string | null;
  monedaCostoCode: string | null;
  fechaVencimiento: string | null;
  permiteDecimal: boolean;
  fraccionDeId?: string | null;
  unidadesPorFraccion?: number | null;
  codigosProducto: string[];
}

export interface CreateProductData {
  nombre: string;
  descripcion: string;
  categoriaId: string;
  newCategoriaName?: string;
  newCategoriaColor?: string;
  precio: number;
  costo: number;
  cantidadInicial: number;
  permiteDecimal: boolean;
  fraccionDeId?: string | null;
  unidadesPorFraccion?: number | null;
}

export interface ChangeQtyOptions {
  costoUnitario?: number;
  motivo?: string;
}

const LOW_STOCK_THRESHOLD = 5;

function getDiasHastaVencimiento(fechaVencimiento: string): number {
  return Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
}

export function useGestionInventario() {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  const [productos, setProductos] = useState<IProductoTiendaV2[]>([]);
  const [categorias, setCategorias] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<StockFilter>("todo");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("todos");

  // Dialog targets
  const [editTarget, setEditTarget] = useState<IProductoTiendaV2 | null>(null);
  const [changeQtyTarget, setChangeQtyTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [movementsTarget, setMovementsTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [createMovTarget, setCreateMovTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const tiendaId = user?.localActual?.id;

  const reload = useCallback(async () => {
    if (!tiendaId) return;
    try {
      setLoading(true);
      const [data, cats] = await Promise.all([
        getProductosVenta(tiendaId),
        fetchCategories(),
      ]);
      setProductos(data);
      setCategorias(cats);
    } catch {
      showMessage("Error al cargar el inventario", "error");
    } finally {
      setLoading(false);
      setCreateMovTarget(null);
    }
  }, [tiendaId]);

  useEffect(() => {
    if (!loadingContext) reload();
  }, [loadingContext, reload]);

  const filteredProductos = useMemo(() => {
    let result = productos;

    if (searchTerm.trim()) {
      const q = normalizeSearch(searchTerm);
      result = result.filter(
        (p) =>
          normalizeSearch(p.producto.nombre).includes(q) ||
          normalizeSearch(p.producto.categoria?.nombre ?? "").includes(q),
      );
    }

    if (selectedCategorias.length > 0) {
      result = result.filter((p) =>
        selectedCategorias.includes(p.producto.categoriaId),
      );
    }

    if (stockFilter === "en_stock")
      result = result.filter((p) => p.existencia > LOW_STOCK_THRESHOLD);
    else if (stockFilter === "bajo_stock")
      result = result.filter(
        (p) => p.existencia > 0 && p.existencia <= LOW_STOCK_THRESHOLD,
      );
    else if (stockFilter === "sin_stock")
      result = result.filter((p) => p.existencia <= 0);

    if (expiryFilter === "proximos") {
      result = result.filter((p) => {
        if (!p.fechaVencimiento) return false;
        const dias = getDiasHastaVencimiento(p.fechaVencimiento);
        return dias > 0 && dias <= 30;
      });
    } else if (expiryFilter === "vencidos") {
      result = result.filter((p) => {
        if (!p.fechaVencimiento) return false;
        return getDiasHastaVencimiento(p.fechaVencimiento) <= 0;
      });
    }

    return result;
  }, [productos, searchTerm, selectedCategorias, stockFilter, expiryFilter]);

  const resolveCategoria = async (data: {
    categoriaId: string;
    newCategoriaName?: string;
    newCategoriaColor?: string;
  }): Promise<string> => {
    if (data.newCategoriaName) {
      const cat = await createCategory(
        data.newCategoriaName,
        data.newCategoriaColor ?? "#9e9e9e",
      );
      return cat.id;
    }
    return data.categoriaId;
  };

  const handleEditSave = async (
    producto: IProductoTiendaV2,
    data: EditProductData,
  ) => {
    try {
      const categoriaId = await resolveCategoria(data);
      await editProduct(
        producto.productoId,
        data.nombre,
        data.descripcion,
        categoriaId,
        data.fraccionDeId
          ? {
              fraccionDeId: data.fraccionDeId,
              unidadesPorFraccion: data.unidadesPorFraccion ?? undefined,
            }
          : undefined,
        data.codigosProducto,
        data.permiteDecimal,
      );
      await updateProductosTienda(tiendaId, [
        {
          id: producto.id,
          precio: data.precio,
          costo: data.costo,
          monedaPrecioCode: data.monedaPrecioCode,
          monedaCostoCode: data.monedaCostoCode,
          fechaVencimiento: data.fechaVencimiento,
        },
      ]);
      showMessage("Producto actualizado", "success");
      setEditTarget(null);
      await reload();
    } catch {
      showMessage("Error al actualizar el producto", "error");
    }
  };

  const handleChangeQtySave = async (
    producto: IProductoTiendaV2,
    newQty: number,
    options: ChangeQtyOptions,
  ) => {
    const delta = newQty - producto.existencia;
    if (delta === 0) return;
    const esConsignacion = !!producto.proveedorId;
    const tipo =
      delta > 0
        ? esConsignacion
          ? "CONSIGNACION_ENTRADA"
          : "COMPRA"
        : esConsignacion
          ? "CONSIGNACION_DEVOLUCION"
          : "AJUSTE_SALIDA";
    const esEntrada = delta > 0;
    try {
      await cretateBatchMovimientos(
        {
          tipo,
          tiendaId,
          usuarioId: user.id,
          motivo: options?.motivo,
          ...(esConsignacion && { proveedorId: producto.proveedorId }),
        },
        [
          {
            productoId: producto.productoId,
            cantidad: Math.abs(delta),
            ...(esEntrada && {
              costoUnitario: options.costoUnitario ?? producto.costo,
              costoTotal:
                (options.costoUnitario ?? producto.costo) * Math.abs(delta),
            }),
          },
        ],
      );
      showMessage("Movimiento registrado", "success");
      setChangeQtyTarget(null);
      await reload();
    } catch (e) {
      console.error(e);
      showMessage("Error al registrar el movimiento", "error");
    }
  };

  const handleCreateProduct = async (data: CreateProductData) => {
    try {
      const categoriaId = await resolveCategoria(data);
      const nuevoProducto = await createProduct(
        data.nombre,
        data.descripcion,
        categoriaId,
        data.fraccionDeId
          ? {
              fraccionDeId: data.fraccionDeId,
              unidadesPorFraccion: data.unidadesPorFraccion ?? undefined,
            }
          : undefined,
        [],
        data.permiteDecimal,
      );

      if (data.cantidadInicial > 0) {
        // COMPRA movement creates ProductoTienda and sets costo via CPP
        await cretateBatchMovimientos(
          { tipo: "COMPRA", tiendaId, usuarioId: user.id },
          [
            {
              productoId: nuevoProducto.id,
              cantidad: data.cantidadInicial,
              costoUnitario: data.costo,
              costoTotal: data.costo * data.cantidadInicial,
            },
          ],
        );
        // Now find the newly created ProductoTienda to set precio
        const updated = await getProductosVenta(tiendaId);
        const nuevoPT = updated.find(
          (p: IProductoTiendaV2) => p.productoId === nuevoProducto.id,
        );
        if (nuevoPT && data.precio) {
          await updateProductosTienda(tiendaId, [
            { id: nuevoPT.id, precio: data.precio },
          ]);
        }
      } else {
        await createProductoTienda(
          tiendaId,
          nuevoProducto.id,
          data.precio,
          data.costo,
        );
      }

      showMessage("Producto creado", "success");
      setCreateProductOpen(false);
      await reload();
    } catch {
      showMessage("Error al crear el producto", "error");
    }
  };

  const handleDeleteProduct = (producto: IProductoTiendaV2) => {
    confirmDialog(
      `¿Eliminar "${producto.producto.nombre}"? Esta acción no se puede deshacer. El producto debe tener existencia 0.`,
      async () => {
        try {
          await deleteProduct(producto.productoId);
          showMessage("Producto eliminado", "success");
          await reload();
        } catch {
          showMessage(
            "El producto no pudo ser eliminado. Verifique que tenga existencia 0.",
            "error",
          );
        }
      },
    );
  };

  return {
    productos,
    categorias,
    loading,
    filteredProductos,

    searchTerm,
    setSearchTerm,
    selectedCategorias,
    setSelectedCategorias,
    stockFilter,
    setStockFilter,
    expiryFilter,
    setExpiryFilter,

    editTarget,
    openEdit: setEditTarget,
    closeEdit: () => setEditTarget(null),

    changeQtyTarget,
    openChangeQty: setChangeQtyTarget,
    closeChangeQty: () => setChangeQtyTarget(null),

    movementsTarget,
    openMovements: setMovementsTarget,
    closeMovements: () => setMovementsTarget(null),

    createMovTarget,
    openCreateMov: setCreateMovTarget,
    closeCreateMov: () => setCreateMovTarget(null),

    createProductOpen,
    openCreateProduct: () => setCreateProductOpen(true),
    closeCreateProduct: () => setCreateProductOpen(false),

    handleEditSave,
    handleChangeQtySave,
    handleCreateProduct,
    handleDeleteProduct,
    handleMovimientoCreated: reload,

    ConfirmDialogComponent,
    reload,
    tiendaId,
  };
}
