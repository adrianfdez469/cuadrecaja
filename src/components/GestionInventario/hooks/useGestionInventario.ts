"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
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
  getProductDeleteInfo,
} from "@/services/productServise";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { IProductoDeleteInfo, IProductoTiendaV2 } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { normalizeSearch } from "@/utils/formatters";
import {
  SEARCH_RANK,
  SearchRank,
  rankBySearch,
  scoreMatch,
} from "@/utils/searchRanking";
import { roundQuantity } from "@/utils/quantityInput";
import { useOnboardingStore } from "@/features/onboarding";

export type StockFilter = "todo" | "en_stock" | "bajo_stock" | "sin_stock";
export type ExpiryFilter = "todos" | "proximos" | "vencidos";

// Prefix that turns the consignment filter into a per-supplier one, so a single
// control covers "any consignment" and "this supplier's consignment" without a
// second dropdown competing for room in the filter bar.
export const CONSIGNMENT_SUPPLIER_PREFIX = "proveedor:";

// Two chips fit under the search box on the narrowest phone without pushing
// the table below the fold; beyond that the shortcut stops being a shortcut.
const MAX_CATEGORY_SUGGESTIONS = 2;

// A single letter matches nearly every category name, so the shortcut would
// flicker into view on the first keystroke of any search.
const MIN_CATEGORY_SUGGESTION_LENGTH = 2;

/** A category offered as a shortcut into the dedicated category filter. */
export interface CategoriaSugerida {
  /** Normalized category name — unique per suggestion. */
  key: string;
  nombre: string;
  color: string;
  /** Every category id sharing this name, applied together. */
  ids: string[];
}

export type ConsignmentFilter =
  | "todos"
  | "propios"
  | "consignacion"
  | `${typeof CONSIGNMENT_SUPPLIER_PREFIX}${string}`;

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
  monedaPrecioCode: string | null;
  monedaCostoCode: string | null;
  fechaVencimiento: string | null;
  cantidadInicial: number;
  permiteDecimal: boolean;
  fraccionDeId?: string | null;
  unidadesPorFraccion?: number | null;
  codigosProducto: string[];
  // Si está presente, se vincula a este Producto existente (de otra tienda)
  // en vez de crear uno nuevo — solo se crea la fila ProductoTienda.
  productoExistenteId?: string | null;
}

export interface ChangeQtyOptions {
  costoUnitario?: number;
  monedaCompra?: string;
  motivo?: string;
}

const LOW_STOCK_THRESHOLD = 5;

function getDiasHastaVencimiento(fechaVencimiento: string): number {
  return Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
}

export function useGestionInventario() {
  const { user, loadingContext, monedaBase, tasasVigentes } = useAppContext();
  const { showMessage } = useMessageContext();

  const [productos, setProductos] = useState<IProductoTiendaV2[]>([]);
  const [categorias, setCategorias] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<StockFilter>("todo");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("todos");
  const [consignmentFilter, setConsignmentFilter] =
    useState<ConsignmentFilter>("todos");

  // Dialog targets
  const [editTarget, setEditTarget] = useState<IProductoTiendaV2 | null>(null);
  const [changeQtyTarget, setChangeQtyTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [movementsTarget, setMovementsTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [createMovTarget, setCreateMovTarget] =
    useState<IProductoTiendaV2 | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IProductoTiendaV2 | null>(
    null,
  );
  const [deleteInfo, setDeleteInfo] = useState<IProductoDeleteInfo | null>(
    null,
  );
  const [deleteInfoLoading, setDeleteInfoLoading] = useState(false);

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
    }
  }, [tiendaId]);

  // El diálogo se cierra en cuanto responde el POST del movimiento — nunca
  // esperando el refetch del inventario. Si se espera, el formulario sigue
  // vivo con el botón habilitado y en redes lentas admite un segundo submit
  // que duplica el movimiento.
  const handleMovimientoCreated = useCallback(() => {
    setCreateMovTarget(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!loadingContext) reload();
  }, [loadingContext, reload]);

  const normalizedSearch = useMemo(
    () => normalizeSearch(searchTerm),
    [searchTerm],
  );

  const filteredProductos = useMemo(() => {
    let result = productos;

    // The search box looks up products only — name and barcode. Matching the
    // category name here too used to mix rows the user could not tell apart
    // ("cola" returned "Coca Cola" next to every soft drink) and could not
    // undo separately, while the category filter below already does that job
    // explicitly. Categories are surfaced instead as a suggestion chip that
    // applies that filter — see `categoriasSugeridas`.
    if (normalizedSearch) {
      result = rankBySearch(result, normalizedSearch, (p) => [
        normalizeSearch(p.producto.nombre),
        ...(p.producto.codigosProducto ?? []).map((c) =>
          normalizeSearch(c.codigo),
        ),
      ]);
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

    if (consignmentFilter === "propios") {
      result = result.filter((p) => !p.proveedorId);
    } else if (consignmentFilter === "consignacion") {
      result = result.filter((p) => !!p.proveedorId);
    } else if (consignmentFilter.startsWith(CONSIGNMENT_SUPPLIER_PREFIX)) {
      const proveedorId = consignmentFilter.slice(
        CONSIGNMENT_SUPPLIER_PREFIX.length,
      );
      result = result.filter((p) => p.proveedorId === proveedorId);
    }

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
  }, [
    productos,
    normalizedSearch,
    selectedCategorias,
    stockFilter,
    expiryFilter,
    consignmentFilter,
  ]);

  // Suppliers actually present in this store's inventory. Derived from the
  // loaded products instead of fetched: the payload already carries the
  // supplier, and listing suppliers with nothing on the shelf would only offer
  // filters that return an empty table.
  const proveedoresConsignacion = useMemo(() => {
    const porId = new Map<string, { id: string; nombre: string }>();

    for (const producto of productos) {
      if (producto.proveedor) {
        porId.set(producto.proveedor.id, {
          id: producto.proveedor.id,
          nombre: producto.proveedor.nombre,
        });
      }
    }

    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos]);

  /**
   * Categories whose name matches what is typed in the search box, offered as
   * a shortcut into the dedicated category filter.
   *
   * Built from the loaded products rather than from `categorias` for two
   * reasons: suggesting a category with nothing on this store's shelf would
   * only lead to an empty table, and a name can exist twice (a global category
   * and the shop's own), in which case both ids must be applied together or
   * half the rows would drop out.
   */
  const categoriasSugeridas = useMemo(() => {
    if (normalizedSearch.length < MIN_CATEGORY_SUGGESTION_LENGTH) return [];

    const porNombre = new Map<string, CategoriaSugerida>();

    for (const { producto } of productos) {
      const categoria = producto.categoria;
      if (!categoria) continue;

      const key = normalizeSearch(categoria.nombre);
      const entry = porNombre.get(key);

      if (entry) {
        if (!entry.ids.includes(categoria.id)) entry.ids.push(categoria.id);
      } else {
        porNombre.set(key, {
          key,
          nombre: categoria.nombre,
          color: categoria.color,
          ids: [categoria.id],
        });
      }
    }

    // Only an anchored match is offered: "ola" hitting the middle of
    // "Chocolates" is a coincidence, not an intent worth acting on.
    const candidatos: { categoria: CategoriaSugerida; rank: SearchRank }[] = [];

    for (const categoria of porNombre.values()) {
      const rank = scoreMatch(categoria.key, normalizedSearch);
      if (rank === null || rank > SEARCH_RANK.WORD_PREFIX) continue;
      if (categoria.ids.every((id) => selectedCategorias.includes(id))) continue;
      candidatos.push({ categoria, rank });
    }

    return candidatos
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_CATEGORY_SUGGESTIONS)
      .map((c) => c.categoria);
  }, [productos, normalizedSearch, selectedCategorias]);

  /**
   * Moves the intent from the search box into the category filter: the term is
   * cleared so the results have a single, visible reason for being there.
   */
  const aplicarCategoriaSugerida = useCallback((ids: string[]) => {
    setSelectedCategorias((prev) => [
      ...prev,
      ...ids.filter((id) => !prev.includes(id)),
    ]);
    setSearchTerm("");
  }, []);

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
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response
        ?.data?.error;
      showMessage(msg ?? "Error al actualizar el producto", "error");
    }
  };

  const handleChangeQtySave = async (
    producto: IProductoTiendaV2,
    newQty: number,
    options: ChangeQtyOptions,
  ) => {
    const delta = roundQuantity(newQty - producto.existencia);
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
              monedaCompra: options.monedaCompra ?? monedaBase,
              monedaOriginal: options.monedaCompra ?? monedaBase,
              montoOriginal:
                (options.costoUnitario ?? producto.costo) * Math.abs(delta),
              tasaUsada: tasasVigentes[options.monedaCompra ?? monedaBase] ?? 1,
            }),
          },
        ],
      );
      showMessage("Movimiento registrado", "success");
      setChangeQtyTarget(null);
      await reload();
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as { response?: { data?: { error?: string } } })?.response
        ?.data?.error;
      showMessage(msg ?? "Error al registrar el movimiento", "error");
    }
  };

  const attachProductoToTienda = async (
    productoId: string,
    data: Pick<
      CreateProductData,
      | "costo"
      | "precio"
      | "cantidadInicial"
      | "monedaPrecioCode"
      | "monedaCostoCode"
      | "fechaVencimiento"
    >,
  ) => {
    const extraFields = {
      monedaPrecioCode: data.monedaPrecioCode,
      monedaCostoCode: data.monedaCostoCode,
      fechaVencimiento: data.fechaVencimiento,
    };

    if (data.cantidadInicial > 0) {
      await cretateBatchMovimientos(
        { tipo: "COMPRA", tiendaId, usuarioId: user.id },
        [
          {
            productoId,
            cantidad: data.cantidadInicial,
            costoUnitario: data.costo,
            costoTotal: data.costo * data.cantidadInicial,
          },
        ],
      );
      const updated = await getProductosVenta(tiendaId);
      const nuevoPT = updated.find(
        (p: IProductoTiendaV2) => p.productoId === productoId,
      );
      if (nuevoPT) {
        await updateProductosTienda(tiendaId, [
          { id: nuevoPT.id, precio: data.precio, ...extraFields },
        ]);
      }
    } else {
      const nuevoPT = await createProductoTienda(
        tiendaId,
        productoId,
        data.precio,
        data.costo,
      );
      if (nuevoPT?.id) {
        await updateProductosTienda(tiendaId, [
          { id: nuevoPT.id, ...extraFields },
        ]);
      }
    }
  };

  const handleCreateProduct = async (data: CreateProductData) => {
    try {
      let productoId = data.productoExistenteId;

      if (!productoId) {
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
          data.codigosProducto.filter(Boolean),
          data.permiteDecimal,
        );
        productoId = nuevoProducto.id;
      }

      await attachProductoToTienda(productoId, data);

      showMessage(
        data.productoExistenteId
          ? "Producto agregado a esta tienda"
          : "Producto creado",
        "success",
      );
      useOnboardingStore.getState().signalEvent({
        type: "product_created",
        productName: data.nombre,
      });
      setCreateProductOpen(false);
      await reload();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response
        ?.data?.error;
      showMessage(msg ?? "Error al crear el producto", "error");
    }
  };

  const handleDeleteProduct = async (producto: IProductoTiendaV2) => {
    setDeleteTarget(producto);
    setDeleteInfo(null);
    setDeleteInfoLoading(true);
    try {
      const info = await getProductDeleteInfo(
        producto.productoId,
        tiendaId,
        producto.id,
      );
      setDeleteInfo(info);
    } catch {
      showMessage("Error al cargar la información del producto", "error");
      setDeleteTarget(null);
    } finally {
      setDeleteInfoLoading(false);
    }
  };

  const closeDeleteProduct = () => {
    setDeleteTarget(null);
    setDeleteInfo(null);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.productoId, tiendaId, deleteTarget.id);
      showMessage("Producto eliminado", "success");
      closeDeleteProduct();
      await reload();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response
        ?.data?.error;
      showMessage(msg ?? "El producto no pudo ser eliminado.", "error");
    }
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
    consignmentFilter,
    setConsignmentFilter,
    proveedoresConsignacion,
    categoriasSugeridas,
    aplicarCategoriaSugerida,

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

    deleteTarget,
    deleteInfo,
    deleteInfoLoading,
    closeDeleteProduct,
    confirmDeleteProduct,

    handleEditSave,
    handleChangeQtySave,
    handleCreateProduct,
    handleDeleteProduct,
    handleMovimientoCreated,

    reload,
    tiendaId,
  };
}
