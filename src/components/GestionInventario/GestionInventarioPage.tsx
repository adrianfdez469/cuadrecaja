"use client";

import { Box, useMediaQuery, useTheme } from "@mui/material";
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
import { ProductMovementsModal } from "@/app/inventario/components/ProductMovementsModal";

export function GestionInventarioPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    categorias,
    loading,
    filteredProductos,
    productos,

    searchTerm, setSearchTerm,
    selectedCategorias, setSelectedCategorias,
    stockFilter, setStockFilter,
    expiryFilter, setExpiryFilter,

    editTarget, openEdit, closeEdit,
    changeQtyTarget, openChangeQty, closeChangeQty,
    movementsTarget, openMovements, closeMovements,
    createMovTarget, openCreateMov, closeCreateMov,
    createProductOpen, openCreateProduct, closeCreateProduct,

    handleEditSave,
    handleChangeQtySave,
    handleCreateProduct,
    handleDeleteProduct,
    handleMovimientoCreated,

    ConfirmDialogComponent,
    reload,
    tiendaId,
  } = useGestionInventario();

  return (
    <PageContainer title="Gestión de Unificada de Productos">
      {tiendaId && <GestionInventarioAlerts tiendaId={tiendaId} />}

      <InventarioStatsRow productos={productos} />

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
        onSave={(newQty, options) => handleChangeQtySave(changeQtyTarget!, newQty, options)}
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

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
