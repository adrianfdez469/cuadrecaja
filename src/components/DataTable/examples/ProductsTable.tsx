import React, { useState, useMemo } from 'react';
import { Box, IconButton } from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Visibility as ViewIcon,
  Add as AddIcon
} from '@mui/icons-material';

import { DataTable, DataTableColumn, DataTableAction } from '../DataTable';
import { 
  formatCurrency, 
  formatStock, 
  formatCategory, 
  formatBoolean,
  STATUS_CONFIGS,
  formatStatus
} from '../utils/formatters';

// Tipo de datos para productos
interface Product {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: {
    nombre: string;
    color: string;
  };
  precio: number;
  costo: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  fechaCreacion: Date;
  proveedor: string;
}

// Datos de ejemplo
const sampleProducts: Product[] = [
  {
    id: 1,
    codigo: 'P001',
    nombre: 'Coca Cola 350ml',
    descripcion: 'Bebida gaseosa sabor cola en lata de 350ml',
    categoria: { nombre: 'Bebidas', color: '#2196F3' },
    precio: 3500,
    costo: 2500,
    stock: 150,
    stockMinimo: 20,
    activo: true,
    fechaCreacion: new Date('2024-01-15'),
    proveedor: 'Coca Cola Company'
  },
  {
    id: 2,
    codigo: 'P002',
    nombre: 'Pan Integral',
    descripcion: 'Pan integral artesanal de 500g',
    categoria: { nombre: 'Panadería', color: '#FF9800' },
    precio: 4500,
    costo: 3000,
    stock: 5,
    stockMinimo: 10,
    activo: true,
    fechaCreacion: new Date('2024-01-20'),
    proveedor: 'Panadería La Espiga'
  },
  {
    id: 3,
    codigo: 'P003',
    nombre: 'Leche Entera 1L',
    descripcion: 'Leche entera pasteurizada en cartón de 1 litro',
    categoria: { nombre: 'Lácteos', color: '#4CAF50' },
    precio: 4200,
    costo: 3200,
    stock: 0,
    stockMinimo: 15,
    activo: false,
    fechaCreacion: new Date('2024-02-01'),
    proveedor: 'Lácteos del Valle'
  }
];

interface ProductsTableProps {
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onView?: (product: Product) => void;
  onAdd?: () => void;
}

export const ProductsTable: React.FC<ProductsTableProps> = ({
  onEdit,
  onDelete,
  onView,
  onAdd
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuración de columnas
  const columns: DataTableColumn<Product>[] = useMemo(() => [
    {
      id: 'codigo',
      label: 'Código',
      minWidth: 100,
      sticky: true,
      responsive: 'always',
      sortable: true
    },
    {
      id: 'nombre',
      label: 'Nombre',
      minWidth: 200,
      responsive: 'always',
      sortable: true,
      format: (value, row) => (
        <Box>
          <Box fontWeight="medium">{value}</Box>
          <Box 
            component="span" 
            fontSize="0.75rem" 
            color="text.secondary"
            sx={{ display: { xs: 'block', md: 'none' } }}
          >
            {row.codigo}
          </Box>
        </Box>
      )
    },
    {
      id: 'descripcion',
      label: 'Descripción',
      minWidth: 250,
      responsive: 'desktop',
      sortable: false,
      format: (value) => value?.length > 50 
        ? `${value.substring(0, 50)}...` 
        : value
    },
    {
      id: 'categoria',
      label: 'Categoría',
      minWidth: 150,
      responsive: 'always',
      sortable: true,
      format: (value) => formatCategory(value)
    },
    {
      id: 'precio',
      label: 'Precio',
      minWidth: 120,
      align: 'right',
      responsive: 'always',
      sortable: true,
      format: (value) => formatCurrency(value)
    },
    {
      id: 'costo',
      label: 'Costo',
      minWidth: 120,
      align: 'right',
      responsive: 'desktop',
      sortable: true,
      format: (value) => formatCurrency(value)
    },
    {
      id: 'stock',
      label: 'Stock',
      minWidth: 100,
      align: 'center',
      responsive: 'always',
      sortable: true,
      format: (value, row) => formatStock(value, row.stockMinimo)
    },
    {
      id: 'proveedor',
      label: 'Proveedor',
      minWidth: 180,
      responsive: 'desktop',
      sortable: true
    },
    {
      id: 'activo',
      label: 'Estado',
      minWidth: 100,
      align: 'center',
      responsive: 'always',
      sortable: true,
      format: (value) => formatBoolean(value, 'Activo', 'Inactivo')
    }
  ], []);

  // Configuración de acciones
  const actions: DataTableAction<Product>[] = useMemo(() => [
    {
      icon: <ViewIcon />,
      label: 'Ver detalles',
      onClick: (product) => onView?.(product),
      color: 'info'
    },
    {
      icon: <EditIcon />,
      label: 'Editar producto',
      onClick: (product) => onEdit?.(product),
      color: 'primary'
    },
    {
      icon: <DeleteIcon />,
      label: 'Eliminar producto',
      onClick: (product) => onDelete?.(product),
      color: 'error',
      disabled: (product) => product.stock > 0 // No permitir eliminar si hay stock
    }
  ], [onView, onEdit, onDelete]);

  // Simulación de carga de datos
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simular llamada a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Aquí iría la lógica real de carga de datos
    } catch (err) {
      setError('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  // Simulación de exportación
  const handleExport = () => {
    // Aquí iría la lógica de exportación
    console.log('Exportando productos...');
  };

  // Toolbar personalizado
  const customToolbar = (
    <Box display="flex" justifyContent="flex-end" mb={2}>
      <IconButton 
        color="primary" 
        onClick={onAdd}
        sx={{ 
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': { bgcolor: 'primary.dark' }
        }}
      >
        <AddIcon />
      </IconButton>
    </Box>
  );

  return (
    <DataTable<Product>
      data={sampleProducts}
      columns={columns}
      actions={actions}
      loading={loading}
      error={error}
      title="Gestión de Productos"
      searchable={true}
      sortable={true}
      pagination={true}
      pageSize={10}
      pageSizeOptions={[5, 10, 25, 50]}
      onRefresh={handleRefresh}
      onExport={handleExport}
      emptyMessage="No hay productos registrados"
      customToolbar={customToolbar}
      rowKey="id"
      onRowClick={(product) => onView?.(product)}
      dense={false}
      stickyHeader={true}
      maxHeight={600}
    />
  );
};

// Ejemplo de uso del componente
export const ProductsTableExample: React.FC = () => {
  const handleEdit = (product: Product) => {
    console.log('Editando producto:', product);
  };

  const handleDelete = (product: Product) => {
    console.log('Eliminando producto:', product);
  };

  const handleView = (product: Product) => {
    console.log('Viendo producto:', product);
  };

  const handleAdd = () => {
    console.log('Agregando nuevo producto');
  };

  return (
    <Box p={3}>
      <ProductsTable
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onAdd={handleAdd}
      />
    </Box>
  );
}; 