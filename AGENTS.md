# Project Overview
**Cuadre de caja** es una aplicación web diseñada para llevar el control de negocios, especialmente aquellos que cuentan con puntos de venta (POS). 
- **Especialización:** Se enfoca en productos listos para la venta (no productos que requieren elaboración previa).
- **Inventario:** Mantenimiento de un inventario que se actualiza constantemente de forma automática conforme se realizan las ventas en el POS.
- **Multitienda:** Soporte para múltiples tiendas con capacidad de realizar movimientos de productos entre ellas.
- **Movimientos:** Soporte para operaciones de compra, ajuste de entrada y ajuste de salida.
- **Estadísticas:** Incluye un módulo de recuperaciones que proporciona estadísticas precisas de ventas para ayudar en la toma de decisiones del negocio.
- **Stack Tecnológico:** 
    - Framework: **Next.js** (React)
    - ORM: **Prisma**
    - Base de Datos: **PostgreSQL**
    - Despliegue: **Vercel**

# Build and Test Commands
Los scripts principales de la aplicación se encuentran definidos en el `package.json`:

- `npm run dev`: Inicia el servidor de desarrollo con Turbopack (`next dev --turbopack`).
- `npm run dev:https`: Inicia el servidor utilizando una configuración personalizada (`node server.mjs`).
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia la aplicación compilada en modo producción.
- `npm run lint`: Ejecuta el linter para verificar el estilo de código.
- `postinstall`: Ejecuta la generación del cliente de Prisma y aplica las migraciones pendientes (`prisma generate && prisma migrate deploy`).

# Code Style Guidelines
Se deben seguir técnicas de **Código Limpio (Clean Code)** de manera rigurosa:

- **Componentización:** En el apartado de React, priorizar la creación de componentes pequeños, reutilizables y con una única responsabilidad.
- **Estructura:** Evitar el uso de un solo fichero para contener toda la lógica. Se debe fragmentar el código de forma lógica.
- **Estado:** Se utiliza **Zustand** para la gestión del estado global.
- **Separación de Responsabilidades:** Mantener una clara división por capas.
- **Interfaces Únicas:** Utilizar interfaces que se compartan a lo largo de toda la aplicación. Evitar duplicar interfaces de datos entre la vista y la capa de servicio; deben ser consistentes en todo el flujo de datos.

# Code Conventions
- **Nomenclatura:**
    - **Componentes:** PascalCase (ej. `ProductCard.tsx`).
    - **Funciones y variables:** camelCase (ej. `getProductos()`).
    - **Interfaces y Tipos:** PascalCase con prefijo "I" para interfaces (ej. `IProducto`).
    - **Archivos de Estilos/Otros:** camelCase o kebab-case según el contexto.
- **Tipado:** Uso obligatorio de TypeScript. Evitar el uso de `any` a menos que sea estrictamente necesario (debe justificarse con un comentario).
- **Imports:** Utilizar alias `@/` para rutas absolutas desde la carpeta `src`.

# Patterns
- **Layered Architecture (Capas):**
    - **Vistas (App Router):** Carpetas en `src/app` que definen las rutas y la estructura de la página.
    - **Componentes:** Lógica de UI reutilizable en `src/components`.
    - **Servicios:** Comunicación con la API en `src/services` utilizando Axios.
    - **Lógica de Servidor:** Funciones auxiliares y lógica de negocio pesada en `src/lib`.
    - **Estado Global:** Gestión de estado con Zustand en `src/store`.
- **API Routes:** Implementación de endpoints en `src/app/api` siguiendo las convenciones de Next.js (GET, POST, etc.).
- **Client/Server Components:** Diferenciación clara usando la directiva `"use client"` cuando se requiera interactividad o hooks de React.

# Prohibitions
- **Prop Drilling:** No pasar props a través de múltiples niveles; usar Zustand para estado compartido.
- **Lógica pesada en Componentes:** No incluir llamadas directas a Prisma o lógica de negocio compleja dentro de componentes de React.
- **Hardcoding:** No usar strings o números "mágicos"; utilizar constantes o archivos de configuración.
- **Duplicidad de Código:** Si una lógica se repite en dos o más lugares, debe extraerse a un hook o servicio.
- **Directivas innecesarias:** No usar `"use client"` en archivos que no requieren interactividad.

# Project Structure
- `prisma/`: Esquema de la base de datos y migraciones.
- `public/`: Archivos estáticos.
- `src/`: Código fuente principal.
    - `app/`: Rutas, páginas y API endpoints (Next.js App Router).
    - `components/`: Componentes de React organizados por funcionalidad.
    - `hooks/`: Hooks personalizados de React.
    - `lib/`: Utilidades, configuración de Prisma y lógica de servidor.
    - `services/`: Funciones para llamadas a la API (Axios).
    - `store/`: Tiendas de estado global (Zustand).
    - `types/`: Definiciones de interfaces y tipos TypeScript.

# Workflow
- **Desarrollo Local:** Trabajar siempre en ramas descriptivas (ej. `feature/nueva-funcionalidad` o `fix/error-inventario`).
- **Sincronización:** Ejecutar `npm run lint` antes de realizar un commit para asegurar la calidad del código.
- **Database:** Después de cambios en el esquema, ejecutar `npx prisma generate` y coordinar migraciones.

# Commit Styles
Se recomienda seguir la convención de **Conventional Commits**:
- `feat:` para nuevas funcionalidades.
- `fix:` para corrección de errores.
- `refactor:` para cambios en el código que no añaden funcionalidad ni corrigen errores.
- `docs:` para cambios en documentación.
- `style:` para cambios de formato (espacios, puntos y coma, etc.).
- `chore:` para tareas de mantenimiento o actualización de dependencias.

# Pull Requests (PRs)
- **Descripción:** Cada PR debe incluir una descripción clara de los cambios y el problema que resuelve.
- **Revisión:** El código debe ser revisado para asegurar que cumple con las "Code Style Guidelines" y "Code Conventions".
- **Atomicidad:** Un PR debe enfocarse en una sola funcionalidad o corrección para facilitar la revisión.

# Testing Instructions
Por el momento, no existen pruebas automatizadas implementadas en el proyecto.

# Security Considerations
La aplicación debe mantenerse segura en todo momento:
- **Autenticación:** Sistema robusto para verificar la identidad de los usuarios.
- **Compartimentación:** Uso de un módulo complejo de **roles y permisos** para asegurar que cada usuario acceda únicamente a la información que le corresponde.
