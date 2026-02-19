"use client";

import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  CircularProgress,
  Button,
  Alert,
  Typography,
  InputAdornment,
  useTheme,
  useMediaQuery,
  IconButton,
  Backdrop
} from "@mui/material";
import {
  DataGrid,
  GridRowModel,
  GridColDef,
  GridRenderCellParams,
  GridRenderEditCellParams
} from "@mui/x-data-grid";
import { Search, Save, Refresh, Print, CheckCircle } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { fecthCostosPreciosProds } from "@/services/costoPrecioServices";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from '@/utils/formatters';
import { PrintLabelsModal } from './components/PrintLabelsModal';

// Componente personalizado para editar precios
const PriceEditCell = (params: GridRenderEditCellParams) => {
  const { id, value, field } = params;

  const handleConfirm = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    params.api.stopCellEditMode({ id, field });
  };

  return (
    <TextField
      fullWidth
      autoFocus
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const newValue = parseFloat(e.target.value);
        params.api.setEditCellValue({ id, field, value: isNaN(newValue) ? 0 : newValue });
      }}
      onFocus={(e) => {
        e.target.select();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleConfirm(e);
        }
      }}
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                color="success"
                onClick={handleConfirm}
                sx={{ p: 0.5 }}
              >
                <CheckCircle fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
        htmlInput: {
          min: 0,
          step: 0.01,
          inputMode: 'decimal',
          style: { fontSize: '0.875rem' }
        }
      }}
      size="small"
      variant="standard"
      sx={{
        '& .MuiInput-root': {
          fontSize: '0.875rem'
        }
      }}
    />
  );
};

// Componente para mostrar precios formateados
const PriceDisplayCell = (params: GridRenderCellParams) => {
  const value = params.value || 0;
  return (
    <Typography variant="body2" fontWeight="medium">
      {formatCurrency(value)}
    </Typography>
  );
};

const PreciosCantidades = () => {
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [idDirtyProds, setIdDirtyProds] = useState([]);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchProductos = async () => {
    try {
      setLoading(true);
      if (user?.localActual?.id) {
        const data = await fecthCostosPreciosProds(user?.localActual?.id);
        setProductos(data || []);
        setFilteredProductos(data || []);
        setIdDirtyProds([]);
      }
    } catch (error) {
      console.error("Error al obtener productos", error);
      showMessage("Error al cargar los productos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      fetchProductos();
    }
  }, [loadingContext]);

  useEffect(() => {
    console.log(productos);

    const mapProductos = productos.map(p => {
      return {
        ...p,
        nombre: p.proveedor && p.proveedor.nombre ? `${p.producto.nombre} - ${p.proveedor.nombre}` : p.producto.nombre,
        costo: p.costo || 0,
        precio: p.precio || 0
      }
    })
    if (!searchTerm.trim()) {
      setFilteredProductos(mapProductos);
    } else {
      const filtered = mapProductos.filter(producto =>
        producto.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProductos(filtered);
    }
  }, [searchTerm, productos]);

  const handleProcessRowUpdate = (newRow: GridRowModel) => {
    // Validar que los valores sean positivos
    if (newRow.costo < 0 || newRow.precio < 0) {
      showMessage("Los valores de precio deben ser positivos", "warning");
      return productos.find(p => p.id === newRow.id) || newRow;
    }

    // Marcar como modificado
    if (!idDirtyProds.includes(newRow.id)) {
      setIdDirtyProds(prev => [...prev, newRow.id]);
    }

    // Actualizar el producto en el estado
    setProductos(prev => prev.map(p => p.id === newRow.id ? newRow : p));

    // Si es móvil y hubo cambios reales, auto-salvar
    if (isMobile) {
      const oldRow = productos.find(p => p.id === newRow.id);
      if (oldRow && (oldRow.precio !== newRow.precio || oldRow.costo !== newRow.costo)) {
        autoSaveRow(newRow);
      }
    }

    return newRow;
  };

  const handleProcessRowUpdateError = (error: Error) => {
    console.error("Error al actualizar fila:", error);
    showMessage("Error al actualizar el producto", "error");
  };

  const autoSaveRow = async (row: GridRowModel) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/productos_tienda/${user.localActual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productos: [{
            id: row.id,
            costo: Number(row.costo) || 0,
            precio: Number(row.precio) || 0
          }]
        })
      });

      if (!response.ok) {
        throw new Error("Error al actualizar producto");
      }

      // Quitar de dirty si se guardó correctamente
      setIdDirtyProds(prev => prev.filter(id => id !== row.id));
      showMessage("Cambio guardado automáticamente", "success");
    } catch (error) {
      console.error("Error en auto-save:", error);
      showMessage("Error al guardar automáticamente", "error");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const productsToSave = productos.filter(prod =>
      idDirtyProds.includes(prod.id)
    ).map(prod => ({
      id: prod.id,
      costo: Number(prod.costo) || 0,
      precio: Number(prod.precio) || 0
    }));

    if (productsToSave.length === 0) {
      showMessage("No hay cambios para guardar", "info");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/productos_tienda/${user.localActual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productsToSave })
      });

      if (!response.ok) {
        throw new Error("Error al actualizar productos");
      }

      showMessage(`${productsToSave.length} producto(s) actualizado(s) correctamente`, "success");
      await fetchProductos();
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error al guardar los cambios", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "nombre",
      headerName: "Producto",
      flex: isMobile ? 1 : 2,
      minWidth: 200,
      renderCell: (params) => (

        <Box sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: "precio",
      headerName: "Precio",
      flex: 1,
      minWidth: 120,
      editable: true,
      type: "number",
      renderCell: (params) => (
        <Box
          onClick={(e) => {
            if (isMobile && params.api?.startCellEditMode) {
              e.stopPropagation();
              params.api.startCellEditMode({ id: params.id, field: params.field });
            }
          }}
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isMobile ? 'pointer' : 'inherit'
          }}
        >
          <PriceDisplayCell {...params} />
        </Box>
      ),
      renderEditCell: PriceEditCell,
      headerAlign: 'center',
      align: 'center'
    },
    {
      field: "costo",
      headerName: "Costo",
      flex: 1,
      minWidth: 120,
      renderCell: PriceDisplayCell,
      headerAlign: 'center',
      align: 'center'
    },
    {
      field: "porciento",
      headerName: "Rentabilidad",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => {
        const { row } = params;
        if (row.costo === 0) return '0%';
        if (row.precio === 0) return '0%';

        const porciento = (((row.precio - row.costo) / row.costo) * 100).toFixed(2);
        return (
          <Typography variant="body2" fontWeight="medium">
            {porciento}%
          </Typography>

        );
      }
    }
  ];

  if (loading || loadingContext) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando productos...
        </Typography>
      </Box>
    );
  }

  if (!user?.localActual?.id) {
    return (
      <PageContainer
        title="Costos y Precios"
        breadcrumbs={[
          { label: 'Inicio', href: '/home' },
          { label: 'Costos y Precios' }
        ]}
      >
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1">
            Para gestionar los precios, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
    { label: 'Conformar Precios' }
  ];

  const headerActions = (
    <Box display="flex" gap={1} alignItems="center">

      {isMobile ?
        <IconButton
          size="small"
          onClick={fetchProductos}
          disabled={loading}
        >
          <Refresh />
        </IconButton>
        :
        <Button
          variant="outlined"
          size="small"
          startIcon={<Refresh />}
          onClick={fetchProductos}
          disabled={loading}
        >
          Actualizar
        </Button>
      }

      {isMobile ?
        <IconButton
          size="small"
          onClick={() => setPrintLabelsOpen(true)}
          disabled={loading || !user?.localActual?.id}
        >
          <Print />
        </IconButton>
        :
        <Button
          variant="outlined"
          size="small"
          startIcon={<Print />}
          onClick={() => setPrintLabelsOpen(true)}
          disabled={loading || !user?.localActual?.id}
          color="secondary"
        >
          Etiquetas
        </Button>
      }

      <Button
        variant="contained"
        size="small"
        startIcon={<Save />}
        onClick={save}
        disabled={idDirtyProds.length === 0 || saving}
        color={idDirtyProds.length > 0 ? "primary" : "inherit"}
      >
        {saving ? "Guardando..." : isMobile ? "Guardar" : `Guardar${idDirtyProds.length > 0 ? ` (${idDirtyProds.length})` : ""}`}
      </Button>
    </Box >
  );

  return (
    <PageContainer
      title="Conformar Precios"
      subtitle="Gestiona los precios de venta de tus productos"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      <ContentCard
        title="Productos"
        subtitle={`${filteredProductos.length} producto${filteredProductos.length !== 1 ? 's' : ''} encontrado${filteredProductos.length !== 1 ? 's' : ''}`}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar producto..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: isMobile ? 160 : 250,
              maxWidth: isMobile ? 200 : 'none'
            }}
          />
        }
        noPadding
        fullHeight
      >
        {filteredProductos.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">
              <Typography variant="h6" gutterBottom>
                {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
              </Typography>
              <Typography variant="body1">
                {searchTerm ?
                  'Intenta con otros términos de búsqueda.' :
                  'Primero debes realizar operaiones de entrada de productos desde los movimientos productos.'
                }
              </Typography>
            </Alert>
          </Box>
        ) : (
          <>
            {idDirtyProds.length > 0 && (
              <Box sx={{ p: 2, bgcolor: 'warning.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  <Typography variant="body2">
                    Tienes {idDirtyProds.length} producto{idDirtyProds.length !== 1 ? 's' : ''} con cambios sin guardar.
                    {`Haz clic en \"Guardar\" para aplicar los cambios.`}
                  </Typography>
                </Alert>
              </Box>
            )}

            <Box sx={{ height: 'calc(100vh - 300px)', minHeight: 400, width: '100%', position: 'relative' }}>
              <DataGrid
                rows={filteredProductos}
                columns={columns}
                disableRowSelectionOnClick
                processRowUpdate={handleProcessRowUpdate}
                onProcessRowUpdateError={handleProcessRowUpdateError}
                loading={loading}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 25 }
                  }
                }}
                getRowClassName={(params) =>
                  idDirtyProds.includes(params.id) ? 'row-modified' : ''
                }
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell:focus': {
                    outline: 'none',
                  },
                  '& .MuiDataGrid-cell:focus-within': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '-2px',
                  },
                  '& .MuiDataGrid-editInputCell': {
                    fontSize: '0.875rem',
                  },
                  '& .row-modified': {
                    backgroundColor: '#ffebee', // Rojo clarito
                    '&:hover': {
                      backgroundColor: '#ffcdd2', // Rojo un poco más oscuro en hover
                    },
                  }
                }}
                localeText={{
                  noRowsLabel: 'No hay productos',
                  noResultsOverlayLabel: 'No se encontraron resultados',
                  toolbarDensity: 'Densidad',
                  toolbarDensityLabel: 'Densidad',
                  toolbarDensityCompact: 'Compacta',
                  toolbarDensityStandard: 'Estándar',
                  toolbarDensityComfortable: 'Cómoda',
                  toolbarColumns: 'Columnas',
                  toolbarColumnsLabel: 'Seleccionar columnas',
                  toolbarFilters: 'Filtros',
                  toolbarFiltersLabel: 'Mostrar filtros',
                  toolbarFiltersTooltipHide: 'Ocultar filtros',
                  toolbarFiltersTooltipShow: 'Mostrar filtros',
                  toolbarExport: 'Exportar',
                  toolbarExportLabel: 'Exportar',
                  toolbarExportCSV: 'Descargar como CSV',
                  toolbarExportPrint: 'Imprimir',
                }}
              />
              <Backdrop
                sx={{
                  color: '#fff',
                  zIndex: (theme) => theme.zIndex.modal + 1,
                  position: 'absolute',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  borderRadius: 2
                }}
                open={saving}
              >
                <CircularProgress color="inherit" />
                <Typography variant="h6" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  Guardando cambios...
                </Typography>
              </Backdrop>
            </Box>
          </>
        )}
      </ContentCard>

      {/* Modal para imprimir etiquetas */}
      {printLabelsOpen && (
        <PrintLabelsModal
          open={printLabelsOpen}
          onClose={() => setPrintLabelsOpen(false)}
          tiendaId={user?.localActual?.id || ''}
        />
      )}
    </PageContainer>
  );
};

export default PreciosCantidades;
