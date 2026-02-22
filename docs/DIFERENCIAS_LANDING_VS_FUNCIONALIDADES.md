# Diferencias: Landing Page vs Documento de Funcionalidades

Comparación entre lo que muestra la landing page (solo funcionalidades, sin precios ni stack técnico) y el documento **FUNCIONALIDADES_IMPLEMENTADAS.md**. Fuentes: `src/app/page.tsx`, `src/app/landing-components/FeaturesSection.tsx`, `src/app/landing-components/BenefitsSection.tsx`, `src/app/landing-components/HeroSection.tsx`.

---

## 1. En la landing pero NO en el documento (o con matiz)

| Qué dice la landing | Dónde aparece | Observación |
|---------------------|----------------|-------------|
| **Exportación a Word** | FeaturesSection – "Reportes Empresariales" → "Exportación a Word" | **Sí está implementado** en el código: inventario exporta a Word y Excel (`utils/wordExport.ts`, `inventario/page.tsx`), y resumen de cierre exporta a Excel (`tablaProductosCierre`). El documento de funcionalidades **no incluyó** estas exportaciones como funcionalidades listadas. |
| **Exportación a Excel** | Implícito en "Reportes" / contexto de reportes | Mismo caso: implementado (inventario y resumen cierre) pero **no aparece** en el documento de funcionalidades. |
| **Auditoría completa / Auditoría de cambios** | FeaturesSection – "Roles Granulares" → "Auditoría de cambios"; BenefitsSection – "Auditoría de operaciones", "Movimientos auditados" | El documento describe **permisos y comprobación de permisos**, pero no una funcionalidad dedicada de **auditoría** (log de quién cambió qué). En código no hay un módulo de "auditoría de cambios" ni un log de auditoría explícito; sí hay trazabilidad en movimientos/ventas. La landing **sobredeclara** si se entiende "auditoría" como módulo de consulta de cambios. |

---

## 2. En el documento pero NO en la landing

Funcionalidades implementadas y documentadas que **no se mencionan** en la landing (ni en Features, ni Benefits, ni footer).

| ID en documento | Nombre (documento) | Categoría |
|-----------------|-------------------|-----------|
| change-password | Cambio de contraseña | Autenticación |
| change-context-tienda-negocio | Cambio de tienda y negocio en sesión | Autenticación |
| init-superadmin | Inicialización del usuario superadministrador | Autenticación / Sistema |
| user-management | Gestión de usuarios | Configuración |
| role-management | Gestión de roles | Configuración |
| permission-templates | Plantillas de permisos | Configuración |
| permission-check | Comprobación de permisos en operaciones | Seguridad |
| business-management | Gestión de negocios | Configuración |
| locale-management | Gestión de locales (tiendas) | Configuración |
| product-catalog | Catálogo de productos | Configuración |
| product-codes | Códigos de producto | Configuración |
| product-per-store | Productos por tienda (precio, costo, existencia) | Operaciones |
| category-management | Gestión de categorías | Configuración |
| sales-list-detail | Listado y detalle de ventas | Operaciones |
| transfer-destinations | Destinos de transferencia | Configuración |
| discount-rules | Reglas de descuento | Configuración |
| discount-preview-and-apply | Vista previa y aplicación de descuentos en venta | Operaciones |
| period-open-close | Apertura y cierre de período de caja | Operaciones |
| period-summary | Resumen de cierre de caja | Operaciones |
| stock-movements | Movimientos de stock | Operaciones |
| movement-import | Importación de movimientos | Operaciones |
| inventory-view | Vista de inventario | Operaciones |
| conformar-precios | Conformar precios | Operaciones |
| cpp-analysis | Análisis de costo promedio ponderado | Recuperaciones |
| cpp-migrate | Migración de datos históricos CPP | Recuperaciones |
| supplier-management | Gestión de proveedores | Configuración |
| consignment-liquidation | Liquidación a proveedores (consignación) | Operaciones |
| dashboard-summary | Resumen del dashboard | Operaciones |
| dashboard-metrics | Métricas del dashboard | Operaciones |
| notifications-crud | Gestión de notificaciones | Configuración |
| notifications-auto-check | Comprobación automática de notificaciones | Operaciones |
| subscription-status | Estado de suscripción | Suscripción |
| subscription-admin | Administración de suscripciones (superadministrador) | Suscripción |
| subscription-plans-config | Configuración de planes de suscripción | Suscripción |
| suspension-management | Gestión de suspensiones | Configuración |
| backup-generate | Generación de backup | Sistema |
| contact-form | Formulario de contacto (landing) | Landing |
| chatbot | Chatbot de la landing | Landing |
| protected-routes | Protección de rutas por sesión y suscripción | Seguridad |

**Qué sí menciona la landing (alineado con documento):**  
POS/Offline, Multi-tenant, Roles granulares, CPP, PWA, Inventario (CPP, fraccionados, consignación), Reportes/Dashboard (métricas en tiempo real), Traspasos entre locales, Tiendas y almacenes. No se listan aquí porque hay correspondencia conceptual con el documento (aunque el documento desglosa en más IDs).

---

## 3. Tabla resumen conjunta

| Tipo de diferencia | Cantidad | Resumen |
|--------------------|----------|---------|
| **Solo en landing** (no en documento o matiz) | 3 ítems | Exportación a Word (y Excel) implementada pero no listada en documento; "Auditoría completa" anunciada pero sin módulo de auditoría dedicado en documento/código. |
| **Solo en documento** (no en landing) | 36 ítems | Todas las funcionalidades de la tabla de la sección 2: autenticación avanzada, configuración (usuarios, roles, locales, productos, categorías, descuentos, destinos transferencia, proveedores, notificaciones, suspensiones), operaciones (cierre, movimientos, inventario, conformar precios, ventas listado/detalle, liquidación consignación), dashboard, suscripción, backup, contacto/chatbot, seguridad. |

---

## 4. Recomendaciones breves

- **Documento:** Añadir como funcionalidades implementadas la **exportación a Word** (inventario) y la **exportación a Excel** (inventario y resumen de cierre).
- **Landing:** Si se mantiene "Auditoría de cambios / auditoría completa", aclarar que se refiere a permisos y trazabilidad en operaciones, o ajustar el texto para no prometer un módulo de auditoría que no existe.
- **Landing:** Opcional: incorporar en copy algunas de las funcionalidades del documento que hoy no se mencionan (por ejemplo: cierre de caja, descuentos, destinos de transferencia, notificaciones, gestión de proveedores y consignación) para alinear mejor con el producto real.
