"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Box, Button, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useOnboardingStore } from "@/features/onboarding";
import MovimientosView from "./movimientos/MovimientosView";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useGestionInventario } from "./hooks/useGestionInventario";
import { InventarioStatsRow } from "./stats/InventarioStatsRow";
import { GestionInventarioAlerts } from "./alerts/GestionInventarioAlerts";
import { InventarioFiltersBar } from "./filters/InventarioFiltersBar";
import { InventarioTable } from "./table/InventarioTable";
import { InventarioMobileList } from "./table/InventarioMobileList";
import { InventarioTabs } from "./InventarioTabs";
import { EditProductDialog } from "./dialogs/EditProductDialog";
import { ChangeQtyDialog } from "./dialogs/ChangeQtyDialog";
import { CreateMovimientoDialog } from "./dialogs/CreateMovimientoDialog";
import { CreateProductDialog } from "./dialogs/CreateProductDialog";
import { DeleteProductDialog } from "./dialogs/DeleteProductDialog";
import { ProductMovementsModal } from "@/app/inventario/components/ProductMovementsModal";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import { usePendingReceptionStore } from "@/store/pendingReceptionStore";

// Cargados aparte del bundle de la pantalla. Entre los tres arrastran `xlsx`,
// `jspdf`, `bwip-js` y `qrcode` — cientos de kilobytes que solo hacen falta
// cuando alguien importa, exporta o imprime etiquetas, y que hasta ahora
// pagaba todo el que abría el inventario.
const PrintLabelsModal = dynamic(
  () => import("./dialogs/PrintLabelsModal").then((m) => m.PrintLabelsModal),
  { ssr: false },
);
const ImportarExcelDialog = dynamic(
  () => import("./movimientos/importExcelDialog"),
  { ssr: false },
);

export function GestionInventarioPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, monedaBase, tasasVigentes } = useAppContext();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();
  const searchParams = useSearchParams();
  const puedeVerInventario = verificarPermiso("operaciones.inventario.acceder");
  const puedeVerMovimientos = verificarPermiso(
    "operaciones.movimientos.acceder",
  );
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  // "Detalles" en la hoja "Más acciones" de mobile: apagado deja solo
  // nombre, categoría e insignias de excepción en cada tarjeta.
  const [showDetails, setShowDetails] = useState(true);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "movimientos" || !puedeVerInventario ? 1 : 0,
  );
  const pendingReceptionCount = usePendingReceptionStore((s) => s.items.length);
  const fetchPendingReception = usePendingReceptionStore((s) => s.fetch);

  const {
    categorias,
    loading,
    filteredProductos,
    productos,

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

    editTarget,
    openEdit,
    closeEdit,
    changeQtyTarget,
    openChangeQty,
    closeChangeQty,
    movementsTarget,
    openMovements,
    closeMovements,
    createMovTarget,
    openCreateMov,
    closeCreateMov,
    createProductOpen,
    openCreateProduct,
    closeCreateProduct,

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
  } = useGestionInventario();

  const handleExportExcel = async () => {
    const productosParaExportar = productos.filter((p) => p.precio > 0);
    if (productosParaExportar.length === 0) {
      showMessage("No hay productos con precio para exportar", "warning");
      return;
    }
    try {
      setExporting(true);
      // Importado aquí y no arriba: `xlsx` solo se necesita al exportar de
      // verdad, y estáticamente entraba en el bundle inicial de la pantalla.
      const { exportInventarioToExcel } = await import("@/utils/excelExport");
      await exportInventarioToExcel({
        productos: productosParaExportar,
        tiendaNombre: user.localActual.nombre,
        fecha: new Date(),
        monedaBase,
        tasasVigentes,
      });
      showMessage(
        `Inventario exportado (${productosParaExportar.length} productos)`,
        "success",
      );
    } catch {
      showMessage("Error al exportar el inventario", "error");
    } finally {
      setExporting(false);
    }
  };

  const signalEvent = useOnboardingStore((s) => s.signalEvent);

  useEffect(() => {
    if (!puedeVerMovimientos || !tiendaId) return;
    fetchPendingReception(tiendaId);
  }, [puedeVerMovimientos, tiendaId, fetchPendingReception]);

  useEffect(() => {
    if (!createProductOpen) return;
    const timer = window.setTimeout(() => {
      const store = useOnboardingStore.getState();
      store.signalEvent({ type: "dialog_create_opened" });
      store.bumpLayoutNonce();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [createProductOpen, signalEvent]);

  const mostrarTabs = puedeVerInventario && puedeVerMovimientos;

  // Compartidas: cada pestaña dibuja este mismo componente bajo su propio
  // título — ya no hay una barra de tabs separada por encima de la página.
  const tabsNode = mostrarTabs ? (
    <InventarioTabs
      value={activeTab}
      onChange={setActiveTab}
      pendingReceptionCount={pendingReceptionCount}
    />
  ) : undefined;

  if (activeTab === 1 && puedeVerMovimientos) {
    return <MovimientosView tabs={tabsNode} />;
  }

  return (
    <>
      <PageContainer
        title="Inventario"
        tabs={tabsNode}
        // En mobile, crear un producto sigue siendo el "+" junto al buscador
        // (ver InventarioFiltersBar) — un botón de texto acá no entra junto
        // al título a 390px.
        headerActions={
          !isMobile ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              data-tour="gi-create-btn"
              onClick={openCreateProduct}
            >
              Nuevo producto
            </Button>
          ) : undefined
        }
      >
        {tiendaId && (
          <GestionInventarioAlerts
            tiendaId={tiendaId}
            onVerVencidos={() => setExpiryFilter("vencidos")}
          />
        )}

        <InventarioStatsRow productos={productos} />

        <Box data-tour="gi-product-table">
          <ContentCard>
            <Box mb={2}>
              <InventarioFiltersBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categorias={categorias}
                selectedCategorias={selectedCategorias}
                onCategoriasChange={setSelectedCategorias}
                expiryFilter={expiryFilter}
                onExpiryChange={setExpiryFilter}
                stockFilter={stockFilter}
                onStockChange={setStockFilter}
                consignmentFilter={consignmentFilter}
                onConsignmentChange={setConsignmentFilter}
                proveedoresConsignacion={proveedoresConsignacion}
                onCreateProduct={openCreateProduct}
                onRefresh={reload}
                loading={loading}
                onExportExcel={handleExportExcel}
                onImportExcel={() => setImportOpen(true)}
                onPrintLabels={() => setPrintLabelsOpen(true)}
                exporting={exporting}
                onToggleDetails={() => setShowDetails((v) => !v)}
              />
            </Box>

            {isMobile ? (
              <InventarioMobileList
                productos={filteredProductos}
                loading={loading}
                onEdit={openEdit}
                onChangeQty={openChangeQty}
                onViewMovements={openMovements}
                onCreateMov={openCreateMov}
                onDelete={handleDeleteProduct}
                showDetails={showDetails}
              />
            ) : (
              <InventarioTable
                productos={filteredProductos}
                loading={loading}
                onEdit={openEdit}
                onChangeQty={openChangeQty}
                onViewMovements={openMovements}
                onCreateMov={openCreateMov}
                onDelete={handleDeleteProduct}
              />
            )}
          </ContentCard>
        </Box>

        <EditProductDialog
          open={Boolean(editTarget)}
          producto={editTarget}
          categorias={categorias}
          productosTienda={productos}
          onClose={closeEdit}
          onSave={handleEditSave}
        />

        <ChangeQtyDialog
          open={Boolean(changeQtyTarget)}
          producto={changeQtyTarget}
          onClose={closeChangeQty}
          onSave={(newQty, options) =>
            handleChangeQtySave(changeQtyTarget!, newQty, options)
          }
        />

        <ProductMovementsModal
          open={Boolean(movementsTarget)}
          onClose={closeMovements}
          producto={movementsTarget}
        />

        <CreateMovimientoDialog
          open={Boolean(createMovTarget)}
          producto={createMovTarget}
          productosTienda={productos}
          onClose={closeCreateMov}
          onCreated={handleMovimientoCreated}
        />

        <CreateProductDialog
          open={createProductOpen}
          categorias={categorias}
          productosTienda={productos}
          onClose={closeCreateProduct}
          onSave={handleCreateProduct}
        />

        <DeleteProductDialog
          open={Boolean(deleteTarget)}
          info={deleteInfo}
          loading={deleteInfoLoading}
          onClose={closeDeleteProduct}
          onConfirm={confirmDeleteProduct}
        />

        {/* Montado solo al abrirlo: arrastra `xlsx`, que pesa más que casi
            todo lo demás de esta pantalla y solo hace falta cuando alguien
            importa de verdad. */}
        {importOpen && (
          <ImportarExcelDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onSuccess={reload}
          />
        )}

        {printLabelsOpen && (
          <PrintLabelsModal
            open={printLabelsOpen}
            onClose={() => setPrintLabelsOpen(false)}
            tiendaId={tiendaId || ""}
          />
        )}
      </PageContainer>
    </>
  );
}
