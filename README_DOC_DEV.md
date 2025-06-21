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
└── middleware.ts          # Middleware de Autenticación
```

## 🗄️ Modelo de Datos

### Entidades Principales

#### **Negocio** (Multi-tenant)
- Entidad raíz que agrupa tiendas, usuarios y productos
- Controla límites de tiempo, usuarios y locales

#### **Tienda/Local**
- Representa un punto de venta físico
- Tiene inventario independiente
- Asociada a usuarios específicos

#### **Usuario**
- Roles: `vendedor`, `administrador`, `superadmin`
- Puede estar asignado a múltiples tiendas
- Tiene una tienda actual activa

#### **Producto**
- Definición global del producto
- Soporte para fraccionamiento (ej: cigarro suelto → caja)

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
Tienda N:M Usuario (UsuarioTienda)
Producto N:M Tienda (ProductoTienda)
Producto 1:N Producto (fraccionamiento)
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

### **Cierres de Período**
- Períodos automáticos por tienda
- Cálculos de ganancias y costos
- Reportes financieros
- Bloqueo de modificaciones post-cierre

### **Multi-Tenant**
- Aislamiento por negocio
- Límites de usuarios y tiendas
- Gestión de tiempo de licencia

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

---

*Sistema Cuadre de Caja - Versión 0.1.0*
*Documentación para Desarrolladores* 