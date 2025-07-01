# 🛠️ Cuadre de Caja - Documentación para Desarrolladores

## 📋 Descripción del Proyecto

**Cuadre de Caja** es un sistema integral de punto de venta (POS) desarrollado con **Next.js 15**, **TypeScript**, **Prisma ORM** y **PostgreSQL**. Está diseñado para gestionar múltiples tiendas, inventarios, ventas y usuarios bajo una arquitectura multi-tenant robusta y escalable.

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI/UX**: Material-UI (MUI) v6, Emotion, Responsive Design
- **Backend**: Next.js API Routes, RESTful APIs
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Autenticación**: NextAuth.js v4 con JWT
- **Estado Global**: Context API + useReducer
- **Validación**: Yup + React Hook Form
- **Fechas**: Day.js + date-fns
- **HTTP Client**: Axios con interceptores
- **Exportación**: docx, file-saver para reportes
- **Networking**: Detección de estado online/offline
- **PWA**: Service Workers para funcionamiento offline

### Estructura del Proyecto

```
src/
├── app/                    # App Router (Next.js 15)
│   ├── api/               # API Routes
│   │   ├── auth/          # Autenticación y autorización
│   │   ├── productos/     # CRUD de productos
│   │   ├── ventas/        # Gestión de ventas
│   │   ├── movimiento/    # Movimientos de stock
│   │   ├── cierre/        # Cierres de período
│   │   └── tiendas-disponibles/ # Gestión de tiendas
│   ├── pos/               # Punto de Venta
│   ├── inventario/        # Gestión de Inventario
│   ├── ventas/            # Historial de Ventas
│   ├── movimientos/       # Movimientos de Stock
│   ├── cierre/            # Cierres de Período
│   ├── resumen_cierre/    # Resumen de cierres
│   ├── costos_precios/    # Gestión de precios
│   ├── configuracion/     # Configuración del Sistema
│   │   ├── negocios/      # Gestión de negocios
│   │   ├── usuarios/      # Gestión de usuarios
│   │   ├── tiendas/       # Gestión de tiendas
│   │   ├── categorias/    # Gestión de categorías
│   │   └── productos/     # Gestión de productos
│   └── login/             # Autenticación
├── components/            # Componentes Reutilizables
│   ├── Layout.tsx         # Layout principal con navegación
│   ├── PageContainer.tsx  # Container de páginas
│   ├── ContentCard.tsx    # Cards de contenido
│   └── OfflineBanner.tsx  # Banner de estado offline
├── context/               # Context Providers
│   ├── AppContext.tsx     # Estado global de la aplicación
│   └── MessageContext.tsx # Sistema de mensajes/notificaciones
├── hooks/                 # Custom Hooks
│   └── useNetworkStatus.ts # Hook para estado de red
├── lib/                   # Utilidades y Configuraciones
│   ├── prisma.ts          # Cliente de Prisma
│   ├── auth.ts            # Configuración de NextAuth
│   └── movimiento/        # Lógica de movimientos
├── services/              # Servicios de API
│   ├── authService.ts     # Servicios de autenticación
│   ├── productServise.ts  # Servicios de productos
│   ├── ventaService.ts    # Servicios de ventas
│   └── movimientoService.ts # Servicios de movimientos
├── types/                 # Definiciones de TypeScript
│   ├── IUser.ts           # Tipos de usuario
│   ├── IProducto.ts       # Tipos de producto
│   ├── IVenta.ts          # Tipos de venta
│   ├── IMovimiento.ts     # Tipos de movimiento
│   └── INegocio.ts        # Tipos de negocio
├── utils/                 # Funciones Utilitarias
│   ├── wordExport.ts      # Exportación a Word
│   ├── tipoMovimiento.ts  # Utilidades de movimientos
│   └── planesNegocio.ts   # Configuración de planes
├── constants/             # Constantes del sistema
│   └── movimientos.ts     # Constantes de movimientos
└── middleware.ts          # Middleware de Autenticación
```

## 🗄️ Modelo de Datos

### Entidades Principales

#### **Negocio** (Multi-tenant)
```prisma
model Negocio {
  id           String    @id @default(cuid())
  nombre       String
  limitTime    DateTime
  locallimit   Int
  userlimit    Int
  productlimit Int
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  // Relaciones
  usuarios     Usuario[]
  tiendas      Tienda[]
  productos    Producto[]
  categorias   Categoria[]
}
```

#### **Usuario**
```prisma
model Usuario {
  id            String    @id @default(cuid())
  usuario       String    @unique
  nombre        String
  password      String
  rol           Rol       @default(vendedor)
  localActual  String?
  negocioId     String
  expiresAt     DateTime?
  
  // Relaciones
  negocio       Negocio   @relation(fields: [negocioId], references: [id])
  locales       UsuarioTienda[]
  ventas        Venta[]
  movimientos   MovimientoStock[]
}

enum Rol {
  vendedor
  administrador
  superadmin
}
```

#### **Tienda/Local**
```prisma
model Tienda {
  id        String   @id @default(cuid())
  nombre    String
  negocioId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relaciones
  negocio   Negocio  @relation(fields: [negocioId], references: [id])
  usuarios  UsuarioTienda[]
  productos ProductoTienda[]
  ventas    Venta[]
  movimientos MovimientoStock[]
  cierres   CierrePeriodo[]
  
  @@unique([nombre, negocioId])
}
```

#### **Producto**
```prisma
model Producto {
  id              String    @id @default(cuid())
  nombre          String
  descripcion     String?
  negocioId       String
  categoriaId     String
  fraccionDeId    String?
  unidadesPorFraccion Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relaciones
  negocio         Negocio   @relation(fields: [negocioId], references: [id])
  categoria       Categoria @relation(fields: [categoriaId], references: [id])
  fraccionDe      Producto? @relation("ProductoFraccion", fields: [fraccionDeId], references: [id])
  fracciones      Producto[] @relation("ProductoFraccion")
  tiendas         ProductoTienda[]
  
  @@unique([nombre, negocioId])
}
```

#### **MovimientoStock**
```prisma
model MovimientoStock {
  id                 String         @id @default(cuid())
  productoTiendaId   String
  tipo               MovimientoTipo
  cantidad           Int
  motivo             String?
  referenciaId       String?
  fecha              DateTime       @default(now())
  existenciaAnterior Int?
  usuarioId          String?
  tiendaId           String
  
  // Relaciones
  productoTienda     ProductoTienda @relation(fields: [productoTiendaId], references: [id])
  usuario            Usuario?       @relation(fields: [usuarioId], references: [id])
  tienda             Tienda         @relation(fields: [tiendaId], references: [id])
}

enum MovimientoTipo {
  COMPRA
  VENTA
  TRASPASO_ENTRADA
  TRASPASO_SALIDA
  AJUSTE_ENTRADA
  AJUSTE_SALIDA
  DESAGREGACION_BAJA
  DESAGREGACION_ALTA
}
```

### Relaciones Clave

```mermaid
erDiagram
    Negocio ||--o{ Tienda : "tiene"
    Negocio ||--o{ Usuario : "contiene"
    Negocio ||--o{ Producto : "gestiona"
    Negocio ||--o{ Categoria : "organiza"
    
    Usuario }o--o{ Tienda : "trabaja_en"
    Tienda ||--o{ ProductoTienda : "almacena"
    Producto ||--o{ ProductoTienda : "se_vende_en"
    
    Tienda ||--o{ Venta : "registra"
    Tienda ||--o{ MovimientoStock : "tiene_movimientos"
    
    Usuario ||--o{ Venta : "realiza"
    ProductoTienda ||--o{ MovimientoStock : "genera"
```

## 🚀 Configuración del Entorno

### Prerrequisitos

- **Node.js** 18+ (ver `.nvmrc`)
- **PostgreSQL** 14+
- **npm/yarn/pnpm**
- **Git**

### Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd cuadre-caja

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

### Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/cuadre_caja"
DIRECT_URL="postgresql://user:password@localhost:5432/cuadre_caja"

# Autenticación
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# Inicialización del sistema
INIT_SECRET="your-init-secret-for-superadmin"

# Opcional: Variables de desarrollo
NODE_ENV="development"
```

### Configuración de Base de Datos

```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Ver base de datos (opcional)
npx prisma studio
```

### Inicialización del Sistema

1. **Crear Superadmin** (solo primera vez):
```bash
curl "http://localhost:3000/api/init-superadmin?secret=YOUR_INIT_SECRET"
```

2. **Ejecutar en desarrollo**:
```bash
npm run dev
```

3. **Acceder al sistema**:
   - URL: `http://localhost:3000`
   - Usuario: `superadmin`
   - Contraseña: `123456` (cambiar inmediatamente)

## 🔧 Desarrollo

### Estructura de Componentes

#### **Componentes de Layout**
- `Layout.tsx`: Layout principal con navegación y autenticación
- `PageContainer.tsx`: Container estándar para páginas
- `ContentCard.tsx`: Cards reutilizables para contenido

#### **Componentes de Negocio**
- `AddMovimientoDialog.tsx`: Modal para crear movimientos
- `ProductMovementsModal.tsx`: Modal de historial de movimientos
- `OfflineBanner.tsx`: Banner de estado de conexión

### Patrones de Desarrollo

#### **API Routes**
```typescript
// Estructura estándar de API Route
export async function GET(req: Request) {
  try {
    // Validación de parámetros
    const { searchParams } = new URL(req.url);
    
    // Lógica de negocio
    const result = await prisma.model.findMany({
      // Query logic
    });
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error message" },
      { status: 500 }
    );
  }
}
```

#### **Servicios**
```typescript
// Patrón de servicio con manejo de errores
export const fetchData = async (params: Params) => {
  try {
    const response = await axios.get('/api/endpoint', { params });
    return response.data;
  } catch (error) {
    console.error('Service error:', error);
    throw error;
  }
};
```

#### **Context y Estado**
```typescript
// Uso del AppContext
const { user, isAuth, loadingContext } = useAppContext();

// Manejo de mensajes
const { showMessage } = useMessageContext();
showMessage("Operación exitosa", "success");
```

### Funcionalidades Clave

#### **Sistema de Autenticación**
- NextAuth.js con JWT
- Roles diferenciados (vendedor, administrador, superadmin)
- Middleware de protección de rutas
- Sesiones persistentes

#### **Gestión Multi-Tenant**
- Aislamiento por negocio
- Unicidad de nombres por negocio
- Control de límites por plan

#### **Sistema de Movimientos**
- Transacciones atómicas
- Historial completo de cambios
- Cálculo automático de existencias
- Soporte para diferentes tipos de movimiento

#### **Punto de Venta**
- Interfaz optimizada para touch
- Carrito de compras reactivo
- Múltiples métodos de pago
- Sincronización automática

## 🧪 Testing

### Estructura de Tests

```bash
# Ejecutar tests
npm run test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

### Tipos de Tests

- **Unit Tests**: Funciones utilitarias y servicios
- **Integration Tests**: API routes y base de datos
- **E2E Tests**: Flujos completos de usuario

## 📦 Deployment

### Build de Producción

```bash
# Build optimizado
npm run build

# Verificar build
npm run start
```

### Variables de Entorno - Producción

```env
# Producción
NODE_ENV="production"
NEXTAUTH_URL="https://your-domain.com"
DATABASE_URL="postgresql://user:pass@host:5432/prod_db"

# Configuraciones adicionales
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

### Consideraciones de Deployment

1. **Base de Datos**: Ejecutar migraciones en producción
2. **Secrets**: Usar variables de entorno seguras
3. **SSL**: Configurar HTTPS obligatorio
4. **Backup**: Estrategia de respaldo automático
5. **Monitoring**: Logs y métricas de rendimiento

## 🔒 Seguridad

### Medidas Implementadas

- **Autenticación JWT** con expiración
- **Middleware de autorización** por rutas
- **Validación de entrada** en APIs
- **Sanitización de datos** antes de DB
- **Rate limiting** en endpoints críticos
- **CORS** configurado apropiadamente

### Roles y Permisos

```typescript
// Matriz de permisos
const PERMISSIONS = {
  vendedor: ['pos', 'inventario:read'],
  administrador: ['pos', 'inventario:*', 'usuarios:*', 'reportes:*'],
  superadmin: ['*']
};
```

## 🚀 Funcionalidades Futuras

### Roadmap Técnico

#### **Fase 1: Optimización**
- [ ] Implementar React Query para cache
- [ ] Optimizar bundle size
- [ ] Mejorar performance de queries
- [ ] Implementar lazy loading

#### **Fase 2: Escalabilidad**
- [ ] Microservicios para módulos grandes
- [ ] Redis para cache distribuido
- [ ] Queue system para procesos pesados
- [ ] API GraphQL opcional

#### **Fase 3: Analytics**
- [ ] Dashboard de métricas en tiempo real
- [ ] Machine Learning para predicciones
- [ ] Integración con sistemas externos
- [ ] API pública documentada

### Mejoras de DX (Developer Experience)

- [ ] Storybook para componentes
- [ ] Documentación automática de APIs
- [ ] CI/CD pipeline completo
- [ ] Docker containers
- [ ] Kubernetes deployment

## 🐛 Debugging y Troubleshooting

### Logs Importantes

```bash
# Logs de desarrollo
npm run dev

# Logs de base de datos
npx prisma studio

# Logs de build
npm run build 2>&1 | tee build.log
```

### Problemas Comunes

#### **Error de Conexión a DB**
```bash
# Verificar conexión
npx prisma db pull

# Resetear DB (desarrollo)
npx prisma migrate reset
```

#### **Errores de Autenticación**
- Verificar `NEXTAUTH_SECRET`
- Revisar configuración de JWT
- Validar tokens en desarrollo

#### **Performance Issues**
- Usar React DevTools Profiler
- Analizar bundle con `npm run analyze`
- Optimizar queries de Prisma

## 📚 Recursos Adicionales

### Documentación Oficial

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Material-UI](https://mui.com/getting-started/)
- [NextAuth.js](https://next-auth.js.org/)

### Herramientas de Desarrollo

- **VSCode Extensions**: Prisma, TypeScript, ES7+ React
- **Browser DevTools**: React DevTools, Redux DevTools
- **Database Tools**: Prisma Studio, pgAdmin
- **API Testing**: Postman, Thunder Client

---

**Sistema Cuadre de Caja**  
*Versión: 1.0.0*  
*Última actualización: Enero 2025*  
*Desarrollado con ❤️ usando Next.js y TypeScript* 