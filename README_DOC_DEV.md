# 🛠️ Cuadre de Caja - Documentación para Desarrolladores

## 📋 Descripción del Proyecto

**Cuadre de Caja** es un sistema integral de punto de venta (POS) desarrollado con **Next.js 15**, **TypeScript**, **Prisma ORM** y **PostgreSQL**. Está diseñado para gestionar múltiples tiendas, inventarios, ventas y usuarios bajo una arquitectura multi-tenant.

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI/UX**: Material-UI (MUI) v6, Emotion
- **Backend**: Next.js API Routes
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Autenticación**: NextAuth.js v4
- **Estado Global**: Zustand
- **Validación**: Yup + React Hook Form
- **Fechas**: Day.js + date-fns
- **HTTP Client**: Axios
- **📄 Exportación**: docx, file-saver (nuevas dependencias para exportación a Word)

### Estructura del Proyecto

```
src/
├── app/                    # App Router (Next.js 13+)
│   ├── api/               # API Routes
│   ├── pos/               # Punto de Venta
│   ├── inventario/        # Gestión de Inventario
│   ├── ventas/            # Historial de Ventas
│   ├── movimientos/       # Movimientos de Stock
│   ├── cierre/            # Cierres de Período
│   ├── configuracion/     # Configuración del Sistema
│   └── login/             # Autenticación
├── components/            # Componentes Reutilizables
├── context/               # Context Providers
├── lib/                   # Utilidades y Configuraciones
├── services/              # Servicios de API
├── store/                 # Estado Global (Zustand)
├── types/                 # Definiciones de TypeScript
├── utils/                 # Funciones Utilitarias
│   └── wordExport.ts      # 📄 Nueva utilidad para exportación a Word
└── middleware.ts          # Middleware de Autenticación
```

## 🗄️ Modelo de Datos

### Entidades Principales

#### **Negocio** (Multi-tenant)
- Entidad raíz que agrupa tiendas, usuarios y productos
- Controla límites de tiempo, usuarios y locales
- **Restricciones de unicidad**: Los nombres de tiendas, productos y categorías son únicos por negocio

#### **Tienda/Local**
- Representa un punto de venta físico
- Tiene inventario independiente
- Asociada a usuarios específicos
- **Unicidad por negocio**: `@@unique([nombre, negocioId])`

#### **Usuario**
- Roles: `vendedor`, `administrador`, `superadmin`
- Puede estar asignado a múltiples tiendas
- Tiene una tienda actual activa

#### **Producto**
- Definición global del producto
- Soporte para fraccionamiento (ej: cigarro suelto → caja)
- **Unicidad por negocio**: `@@unique([nombre, negocioId])`

#### **Categoria**
- Agrupación de productos
- **Unicidad por negocio**: `@@unique([nombre, negocioId])`

#### **ProductoTienda**
- Instancia del producto en una tienda específica
- Maneja precio, costo y existencias por tienda

#### **Venta**
- Transacción de venta con múltiples productos
- Soporte para pagos mixtos (efectivo + transferencia)
- Asociada a un período de cierre

#### **MovimientoStock**
- Historial completo de movimientos de inventario
- Tipos: `COMPRA`, `VENTA`, `TRASPASO`, `AJUSTE`, `DESAGREGACION`

### Relaciones Clave

```sql
Negocio 1:N Tienda
Negocio 1:N Usuario
Negocio 1:N Producto
Negocio 1:N Categoria
Tienda N:M Usuario (UsuarioTienda)
Producto N:M Tienda (ProductoTienda)
Producto 1:N Producto (fraccionamiento)
```

### 🆕 Cambios en Schema de Base de Datos

#### Restricciones de Unicidad por Negocio
```prisma
model Tienda {
  // ... otros campos
  @@unique([nombre, negocioId])
}

model Producto {
  // ... otros campos
  @@unique([nombre, negocioId])
}

model Categoria {
  // ... otros campos
  @@unique([nombre, negocioId])
}
```

## 🚀 Configuración del Entorno

### Prerrequisitos

- Node.js 18+ (ver `.nvmrc`)
- PostgreSQL 12+
- npm/yarn/pnpm

### Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd cuadre-caja

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
```

### 🆕 Nuevas Dependencias

```json
{
  "dependencies": {
    "docx": "^8.x.x",
    "file-saver": "^2.x.x"
  },
  "devDependencies": {
    "@types/file-saver": "^2.x.x"
  }
}
```

### Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/cuadre_caja"
DIRECT_URL="postgresql://user:password@localhost:5432/cuadre_caja"

# Autenticación
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Inicialización
INIT_SECRET="your-init-secret"
```

### Configuración de Base de Datos

```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# (Opcional) Seed de datos
npx prisma db seed
```

### Inicialización del Sistema

1. **Crear Superadmin** (primera vez):
```bash
curl "http://localhost:3000/api/init-superadmin?secret=YOUR_INIT_SECRET"
```

2. **Ejecutar en desarrollo**:
```bash
npm run dev
```

## 🔧 Desarrollo

### Estructura de Componentes

#### **Componentes de Layout**
- `Layout.tsx`: Layout principal con navegación
- `middleware.ts`: Autenticación y headers de usuario

#### **Stores (Zustand)**
- `cartStore`: Estado del carrito de compras
- `salesStore`: Gestión de ventas offline/sync
- `appStore`: Estado global de la aplicación

#### **Servicios**
```typescript
// services/
├── authService.ts         # Autenticación
├── sellService.ts         # Gestión de ventas
├── productService.ts      # Productos y categorías
├── inventoryService.ts    # Movimientos de stock
└── cierrePeriodService.ts # Cierres de período
```

#### **🆕 Utilidades**
```typescript
// utils/wordExport.ts
export const exportInventoryToWord = async (
  productos: ProductoTiendaWithDetails[]
) => {
  // Genera documento Word con productos organizados por categoría
  // Incluye tabla con formato profesional
  // Descarga automática del archivo
}
```

### API Routes

#### Estructura de APIs
```
api/
├── auth/                  # NextAuth.js
├── categorias/           # CRUD Categorías
├── productos/            # CRUD Productos
├── productos_tienda/     # Productos por tienda
├── tiendas/              # CRUD Tiendas
├── usuarios/             # CRUD Usuarios
├── venta/                # Gestión de ventas
├── movimiento/           # Movimientos de stock
├── cierre/               # Cierres de período
└── init-superadmin/      # Inicialización
```

#### Middleware de Autenticación
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  
  if (token) {
    // Inyecta headers con info del usuario
    requestHeaders.set('x-user-id', token.id)
    requestHeaders.set('x-user-rol', token.rol)
    // ... más headers
  }
}
```

### Patrones de Desarrollo

#### **Gestión de Estado**
```typescript
// Zustand Store Example
interface CartStore {
  items: CartItem[]
  total: number
  addItem: (product: IProductoTienda, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}
```

#### **Servicios de API**
```typescript
// Patrón de servicio
export const createSell = async (sellData: CreateSellRequest) => {
  const response = await axios.post('/api/venta', sellData)
  return response.data
}
```

#### **Componentes de UI**
```typescript
// Componente con hooks personalizados
const POSInterface = () => {
  const { user, loadingContext } = useAppContext()
  const { showMessage } = useMessageContext()
  const { items, total, clearCart } = useCartStore()
  
  // ... lógica del componente
}
```

## 🔐 Autenticación y Autorización

### Roles de Usuario
- **superadmin**: Acceso completo al sistema
- **administrador**: Gestión de su negocio
- **vendedor**: Solo POS y consultas básicas

### Middleware de Seguridad
```typescript
// Validación de roles en API
const getUserFromHeaders = (req: NextRequest) => {
  return {
    id: req.headers.get('x-user-id'),
    rol: req.headers.get('x-user-rol'),
    negocio: JSON.parse(req.headers.get('x-user-negocio') || '{}'),
    tiendaActual: JSON.parse(req.headers.get('x-user-tiendaActual') || '{}')
  }
}
```

## 📊 Funcionalidades Clave

### **Sistema POS**
- Carrito de compras en tiempo real
- Búsqueda de productos inteligente
- Pagos mixtos (efectivo + transferencia)
- Sincronización offline

### **Gestión de Inventario**
- Movimientos automáticos por ventas
- Traspasos entre tiendas
- Fraccionamiento de productos
- Ajustes manuales con auditoría
- **🆕 Exportación a Word**: Reportes profesionales organizados por categoría

### **Cierres de Período**
- Períodos automáticos por tienda
- Cálculos de ganancias y costos
- Reportes financieros
- Bloqueo de modificaciones post-cierre

### **Multi-Tenant**
- Aislamiento por negocio
- Límites de usuarios y tiendas
- Gestión de tiempo de licencia
- **🆕 Restricciones de unicidad por negocio**: Mayor flexibilidad en nombres

## 🆕 Nuevas Funcionalidades

### 📄 Exportación a Word

#### Implementación
```typescript
// src/utils/wordExport.ts
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx'
import { saveAs } from 'file-saver'

export const exportInventoryToWord = async (productos: ProductoTiendaWithDetails[]) => {
  // Agrupa productos por categoría
  const productosPorCategoria = productos.reduce((acc, producto) => {
    const categoria = producto.producto.categoria?.nombre || 'Sin Categoría'
    if (!acc[categoria]) acc[categoria] = []
    acc[categoria].push(producto)
    return acc
  }, {} as Record<string, ProductoTiendaWithDetails[]>)

  // Crea documento con formato profesional
  const doc = new Document({
    sections: [{
      children: [
        // Título y fecha
        new Paragraph({
          text: `Reporte de Inventario - ${new Date().toLocaleDateString()}`,
          heading: HeadingLevel.TITLE
        }),
        
        // Tabla por categoría
        ...Object.entries(productosPorCategoria).map(([categoria, productos]) => [
          // Encabezado de categoría
          new Paragraph({
            text: categoria,
            style: 'categoryHeader'
          }),
          
          // Tabla de productos
          new Table({
            rows: [
              // Headers
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Producto')] }),
                  new TableCell({ children: [new Paragraph('Precio')] }),
                  new TableCell({ children: [new Paragraph('Cantidad Inicial')] }),
                  new TableCell({ children: [new Paragraph('Cantidad Vendida')] }),
                  new TableCell({ children: [new Paragraph('Cantidad Final')] })
                ]
              }),
              
              // Datos de productos
              ...productos.map(producto => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(producto.producto.nombre)] }),
                  new TableCell({ children: [new Paragraph(`$${producto.precio.toFixed(2)}`)] }),
                  new TableCell({ children: [new Paragraph(producto.cantidadInicial.toString())] }),
                  new TableCell({ children: [new Paragraph(producto.cantidadVendida.toString())] }),
                  new TableCell({ children: [new Paragraph(producto.existencia.toString())] })
                ]
              }))
            ]
          })
        ]).flat()
      ]
    }]
  })

  // Genera y descarga el archivo
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `inventario_${new Date().toISOString().split('T')[0]}.docx`)
}
```

#### Integración en Componente
```typescript
// src/app/inventario/page.tsx
const handleExportToWord = async () => {
  try {
    await exportInventoryToWord(productos)
    showMessage('Inventario exportado exitosamente', 'success')
  } catch (error) {
    showMessage('Error al exportar inventario', 'error')
  }
}

// Botón en la interfaz
<Button
  variant="contained"
  startIcon={<DescriptionIcon />}
  onClick={handleExportToWord}
  sx={{ mb: 2 }}
>
  Exportar a Word
</Button>
```

### 🏢 Restricciones de Unicidad por Negocio

#### Migración de Base de Datos
```sql
-- Remover índices globales únicos
DROP INDEX IF EXISTS "Tienda_nombre_key";
DROP INDEX IF EXISTS "Producto_nombre_key";
DROP INDEX IF EXISTS "Categoria_nombre_key";

-- Crear índices únicos por negocio
CREATE UNIQUE INDEX "Tienda_nombre_negocioId_key" ON "Tienda"("nombre", "negocioId");
CREATE UNIQUE INDEX "Producto_nombre_negocioId_key" ON "Producto"("nombre", "negocioId");
CREATE UNIQUE INDEX "Categoria_nombre_negocioId_key" ON "Categoria"("nombre", "negocioId");
```

#### Validación en APIs
```typescript
// Ejemplo en API de productos
const existingProduct = await prisma.producto.findFirst({
  where: {
    nombre: data.nombre,
    negocioId: user.negocio.id
  }
})

if (existingProduct) {
  return NextResponse.json(
    { error: 'Ya existe un producto con este nombre en tu negocio' },
    { status: 400 }
  )
}
```

## 🧪 Testing y Calidad

### Linting y Formateo
```bash
# ESLint
npm run lint

# Corrección automática
npm run lint -- --fix
```

### Estructura de Testing
```bash
# Ejecutar tests (cuando se implementen)
npm test

# Coverage
npm run test:coverage
```

## 🚀 Despliegue

### Build de Producción
```bash
# Construir aplicación
npm run build

# Iniciar en producción
npm start
```

### Variables de Producción
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://your-domain.com"
INIT_SECRET="production-secret"
```

### Migraciones en Producción
```bash
# Solo aplicar migraciones (no generar)
npx prisma migrate deploy
```

## 🔄 Flujos de Trabajo

### **Flujo de Venta**
1. Usuario abre período de ventas
2. Selecciona productos → carrito
3. Procesa pago (efectivo/transferencia)
4. Sistema actualiza inventario automáticamente
5. Genera movimientos de stock

### **Flujo de Inventario**
1. Recepción de mercancía → Movimiento COMPRA
2. Venta → Movimiento VENTA (automático)
3. Traspaso entre tiendas → TRASPASO_ENTRADA/SALIDA
4. Ajustes → AJUSTE_ENTRADA/SALIDA
5. **🆕 Exportación** → Genera reporte Word organizado por categoría

### **Flujo de Cierre**
1. Fin del día/período → Cierre manual
2. Sistema calcula totales y ganancias
3. Bloquea modificaciones del período
4. Genera reporte financiero

## 🐛 Debug y Troubleshooting

### Logs Importantes
```typescript
// Habilitar logs de Prisma
DEBUG="prisma:query" npm run dev

// Logs de NextAuth
NEXTAUTH_DEBUG=1 npm run dev
```

### Problemas Comunes

**❌ Error de migración de Prisma**
```bash
npx prisma migrate reset
npx prisma migrate dev
```

**❌ Error de autenticación**
- Verificar `NEXTAUTH_SECRET`
- Revisar configuración de base de datos
- Validar headers en middleware

**❌ Problemas de sincronización**
- Revisar store de Zustand
- Validar conexión a APIs
- Verificar estado offline

**🆕 ❌ Errores en negocios nuevos**
- Las páginas de cierre, ventas e historial pueden fallar sin datos
- Implementar validaciones de datos vacíos
- Mostrar mensajes informativos para usuarios nuevos

**🆕 ❌ Conflictos de unicidad**
- Verificar que las restricciones sean por `negocioId`
- Revisar migraciones de índices únicos
- Validar en frontend antes de enviar al backend

**🆕 ❌ Problemas de exportación a Word**
- Verificar que las dependencias `docx` y `file-saver` estén instaladas
- Comprobar permisos de descarga en el navegador
- Validar que existan productos para exportar

## 📝 Contribución

### Convenciones de Código
- **TypeScript estricto**: Todos los archivos deben tener tipos
- **Componentes funcionales**: Usar hooks en lugar de clases
- **Naming**: PascalCase para componentes, camelCase para funciones
- **Imports**: Usar paths absolutos con `@/`

### Estructura de Commits
```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formateo de código
refactor: refactorización
test: pruebas
chore: tareas de mantenimiento
```

### Pull Requests
1. Fork del repositorio
2. Crear branch feature/fix
3. Implementar cambios con tests
4. Actualizar documentación
5. Crear PR con descripción detallada

## 📚 Recursos Adicionales

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Material-UI Documentation](https://mui.com/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [docx Library Documentation](https://docx.js.org/)
- [file-saver Documentation](https://github.com/eligrey/FileSaver.js/)

## 🎯 Roadmap y Mejoras Futuras

### 🔮 Próximas Funcionalidades
- Exportación a Excel y PDF
- Reportes avanzados con gráficos
- Notificaciones push para stock bajo
- Integración con sistemas de facturación
- App móvil nativa
- Backup automático de datos

### 🛠️ Mejoras Técnicas Pendientes
- Implementación de tests unitarios e integración
- Optimización de queries de base de datos
- Cache con Redis para mejor rendimiento
- Monitoreo y logging avanzado
- CI/CD pipeline completo

---

*Sistema Cuadre de Caja - Versión 0.2.0*
*Documentación para Desarrolladores*
*Última actualización: Enero 2025* 