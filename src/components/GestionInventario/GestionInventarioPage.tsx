"use client";

import { useEffect, useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { useOnboardingStore } from "@/features/onboarding";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useGestionInventario } from "./hooks/useGestionInventario";
import { InventarioStatsRow } from "./stats/InventarioStatsRow";
import { GestionInventarioAlerts } from "./alerts/GestionInventarioAlerts";
import { InventarioFiltersBar } from "./filters/InventarioFiltersBar";
import { InventarioTable } from "./table/InventarioTable";
import { InventarioMobileList } from "./table/InventarioMobileList";
import { EditProductDialog } from "./dialogs/EditProductDialog";
import { ChangeQtyDialog } from "./dialogs/ChangeQtyDialog";
import { CreateMovimientoDialog } from "./dialogs/CreateMovimientoDialog";
import { CreateProductDialog } from "./dialogs/CreateProductDialog";
import { DeleteProductDialog } from "./dialogs/DeleteProductDialog";
import { ProductMovementsModal } from "@/app/inventario/components/ProductMovementsModal";
import ImportarExcelDialog from "@/app/movimientos/components/importExcelDialog";
import { exportInventarioToExcel } from "@/utils/excelExport";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

export function GestionInventarioPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, monedaBase, tasasVigentes } = useAppContext();
  const { showMessage } = useMessageContext();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    if (!createProductOpen) return;
    const timer = window.setTimeout(() => {
      const store = useOnboardingStore.getState();
      store.signalEvent({ type: "dialog_create_opened" });
      store.bumpLayoutNonce();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [createProductOpen, signalEvent]);

  return (
    <PageContainer title="Gestión de Unificada de Productos">
      {tiendaId && <GestionInventarioAlerts tiendaId={tiendaId} />}

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
              onCreateProduct={openCreateProduct}
              onRefresh={reload}
              loading={loading}
              onExportExcel={handleExportExcel}
              onImportExcel={() => setImportOpen(true)}
              exporting={exporting}
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
        onClose={closeCreateMov}
        onCreated={handleMovimientoCreated}
      />

      <CreateProductDialog
        open={createProductOpen}
        categorias={categorias}
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

      <ImportarExcelDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={reload}
      />
    </PageContainer>
  );
}
