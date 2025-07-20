# ProductSelectionModal

Un componente modal de pantalla completa para seleccionar productos con funcionalidades específicas para operaciones de ENTRADA y SALIDA de inventario.

## Características

- **Responsive Design**: Se adapta perfectamente a dispositivos móviles y desktop
- **Filtros Avanzados**: Búsqueda por nombre/proveedor y filtro por categoría
- **Paginación**: Manejo eficiente de grandes listas de productos
- **Validaciones Inteligentes**: Control de cantidades según el tipo de operación
- **Vista Previa**: Tab separado para ver productos seleccionados
- **Operaciones Específicas**: Comportamiento diferenciado para ENTRADA y SALIDA

## Props

```typescript
interface ProductSelectionModalProps {
  open: boolean;                                    // Controla si el modal está abierto
  onClose: () => void;                             // Función llamada al cerrar el modal
  productos: IProductoTiendaV2[];                  // Lista de productos disponibles
  operacion: 'ENTRADA' | 'SALIDA';                 // Tipo de operación
  onConfirm: (productosSeleccionados: ProductoSeleccionado[]) => void; // Callback de confirmación
  loading?: boolean;                               // Estado de carga (opcional)
}
```

## Tipos

```typescript
export type OperacionTipo = 'ENTRADA' | 'SALIDA';

export interface ProductoSeleccionado {
  productoTienda: IProductoTiendaV2;
  cantidad: number;
  costo: number;
  costoTotal: number;
}
```

## Uso Básico

```tsx
import { ProductSelectionModal } from '@/components/ProductSelectionModal';

function MiComponente() {
  const [modalOpen, setModalOpen] = useState(false);
  const [operacion, setOperacion] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');

  const handleConfirm = (productosSeleccionados) => {
    console.log('Productos seleccionados:', productosSeleccionados);
    // Procesar la selección
    setModalOpen(false);
  };

  return (
    <ProductSelectionModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      productos={productos}
      operacion={operacion}
      onConfirm={handleConfirm}
    />
  );
}
```

## Uso con Hook Personalizado

```tsx
import { useProductSelectionModal } from '@/hooks/useProductSelectionModal';

function MiComponente() {
  const {
    isOpen,
    operacion,
    openModal,
    closeModal,
    handleConfirm,
    setOnConfirm
  } = useProductSelectionModal();

  useEffect(() => {
    setOnConfirm(async (productosSeleccionados) => {
      // Lógica para procesar la selección
      await crearMovimiento(operacion, productosSeleccionados);
    });
  }, [operacion, setOnConfirm]);

  return (
    <>
      <Button onClick={() => openModal('ENTRADA')}>
        Crear Entrada
      </Button>
      
      <ProductSelectionModal
        open={isOpen}
        onClose={closeModal}
        productos={productos}
        operacion={operacion}
        onConfirm={handleConfirm}
      />
    </>
  );
}
```

## Comportamiento por Operación

### ENTRADA
- **Cantidad**: Se puede escribir libremente (valor inicial: 1)
- **Costo**: Se puede editar (valor inicial: costo del producto)
- **Validación**: Cantidad debe ser mayor a 0

### SALIDA
- **Cantidad**: Se puede editar pero no exceder la existencia (valor inicial: existencia actual)
- **Costo**: No se puede modificar (se mantiene el costo original)
- **Validación**: Cantidad no puede exceder la existencia disponible

## Funcionalidades

### Filtros
- **Búsqueda**: Por nombre de producto o proveedor
- **Categoría**: Filtro desplegable por categorías disponibles
- **Colapsable**: Los filtros se pueden ocultar/mostrar

### Paginación
- **Items por página**: 10 productos
- **Navegación**: Controles de paginación automáticos
- **Reset**: La página se reinicia al cambiar filtros

### Vista Previa
- **Tab separado**: "Productos Seleccionados"
- **Resumen**: Total de productos, cantidades y costos
- **Edición**: Cantidades y costos editables según la operación
- **Eliminación**: Botón para quitar productos de la selección

### Validaciones
- **Cantidades**: Control automático según tipo de operación
- **Errores visuales**: Indicadores de errores en campos inválidos
- **Botón deshabilitado**: No se puede confirmar con errores

## Integración en Movimientos

Para integrar en la página de movimientos existente:

```tsx
// En src/app/movimientos/page.tsx
import { ProductSelectionIntegration } from './components/ProductSelectionIntegration';

export default function MovimientosPage() {
  // ... código existente ...

  return (
    <PageContainer title="Movimientos de Stock">
      {/* Reemplazar el botón "Crear Movimiento" existente */}
      <ProductSelectionIntegration 
        productos={productos}
        onMovimientoCreado={fetchMovimientos}
      />
      
      {/* ... resto del código existente ... */}
    </PageContainer>
  );
}
```

## Estilos y Tema

El componente utiliza el sistema de diseño establecido en la aplicación:

- **Colores**: Paleta definida en `src/theme.tsx`
- **Tipografía**: Fuente Inter con variantes responsivas
- **Espaciado**: Sistema de espaciado de 8px
- **Bordes**: Border radius de 8px para cards y 12px para modales
- **Sombras**: Efectos sutiles con transiciones suaves

## Responsive Design

### Mobile (< 600px)
- Modal a pantalla completa
- Tabs de ancho completo
- Botones apilados verticalmente
- Tabla con scroll horizontal
- Filtros colapsados por defecto

### Tablet (600px - 960px)
- Modal con ancho máximo
- Tabs estándar
- Grid responsivo para filtros
- Tabla optimizada

### Desktop (> 960px)
- Modal con ancho completo
- Tabs estándar
- Filtros siempre visibles
- Tabla completa con todas las columnas

## Accesibilidad

- **Navegación por teclado**: Todos los elementos son navegables
- **ARIA labels**: Etiquetas apropiadas para lectores de pantalla
- **Contraste**: Cumple con estándares WCAG
- **Focus management**: Manejo correcto del foco en el modal

## Performance

- **Memoización**: Uso de `useMemo` para cálculos costosos
- **Lazy loading**: Componentes cargados bajo demanda
- **Paginación**: Solo renderiza productos visibles
- **Debounce**: Búsqueda optimizada

## Dependencias

- Material-UI v5
- React 18+
- TypeScript
- Iconos de Material-UI
- Utilidades de formateo de la aplicación

## Archivos Relacionados

- `src/components/ProductSelectionModal.tsx` - Componente principal
- `src/hooks/useProductSelectionModal.ts` - Hook personalizado
- `src/components/ProductSelectionModalExample.tsx` - Ejemplo de uso
- `src/app/movimientos/components/ProductSelectionIntegration.tsx` - Integración en movimientos 