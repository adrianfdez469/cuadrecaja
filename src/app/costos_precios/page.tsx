"use client";

import { useState, useEffect } from "react";
import { 
  Box, 
  TextField, 
  CircularProgress, 
  Button, 
  Alert,
  Typography,
  Chip,
  InputAdornment,
  useTheme,
  useMediaQuery
} from "@mui/material";
import { 
  DataGrid, 
  GridRowModel, 
  GridColDef,
  GridRenderCellParams,
  GridRenderEditCellParams
} from "@mui/x-data-grid";
import { Search, Save, Refresh } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { fecthCostosPreciosProds } from "@/services/costoPrecioServices";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from '@/utils/formatters';

// Componente personalizado para editar precios
const PriceEditCell = (params: GridRenderEditCellParams) => {
  const { id, value, field } = params;
  
  return (
    <TextField
      fullWidth
      type="number"
      value={value || ''}
      onChange={(e) => {
        const newValue = parseFloat(e.target.value) || 0;
        params.api.setEditCellValue({ id, field, value: newValue });
      }}
      InputProps={{
        startAdornment: <InputAdornment position="start">$</InputAdornment>,
      }}
      inputProps={{ 
        min: 0, 
        step: 0.01,
        style: { fontSize: '0.875rem' }
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
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchProductos = async () => {
    try {
      setLoading(true);
      if(user?.localActual?.id){
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
    if(!loadingContext) {
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
      showMessage("Los valores de costo y precio deben ser positivos", "warning");
      return productos.find(p => p.id === newRow.id) || newRow;
    }

    // Marcar como modificado
    if (!idDirtyProds.includes(newRow.id)) {
      setIdDirtyProds(prev => [...prev, newRow.id]);
    }

    // Actualizar el producto en el estado
    setProductos(prev => prev.map(p => p.id === newRow.id ? newRow : p));
    
    return newRow;
  };

  const handleProcessRowUpdateError = (error: Error) => {
    console.error("Error al actualizar fila:", error);
    showMessage("Error al actualizar el producto", "error");
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
      field: "costo",
      headerName: "Costo",
      flex: 1,
      minWidth: 120,
      editable: true,
      type: "number",
      renderCell: PriceDisplayCell,
      renderEditCell: PriceEditCell,
      headerAlign: 'center',
      align: 'center'
    },
    {
      field: "precio",
      headerName: "Precio",
      flex: 1,
      minWidth: 120,
      editable: true,
      type: "number",
      renderCell: PriceDisplayCell,
      renderEditCell: PriceEditCell,
      headerAlign: 'center',
      align: 'center'
    },
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
          { label: 'Inicio', href: '/' },
          { label: 'Costos y Precios' }
        ]}
      >
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1">
            Para gestionar costos y precios, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Costos y Precios' }
  ];

  const headerActions = (
    <Box display="flex" gap={1} alignItems="center">
      <Button
        variant="outlined"
        size="small"
        startIcon={<Refresh />}
        onClick={fetchProductos}
        disabled={loading}
      >
        {isMobile ? "" : "Actualizar"}
      </Button>
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
    </Box>
  );

  return (
    <PageContainer
      title="Costos y Precios"
      subtitle="Gestiona los costos y precios de venta de tus productos"
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
                  'Primero debes agregar productos desde la configuración de productos.'
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
            
            <Box sx={{ height: 'calc(100vh - 300px)', minHeight: 400, width: '100%' }}>
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
            </Box>
          </>
        )}
      </ContentCard>
    </PageContainer>
  );
};

export default PreciosCantidades;
