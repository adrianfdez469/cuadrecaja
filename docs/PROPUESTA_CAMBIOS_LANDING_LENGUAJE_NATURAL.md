# Propuesta de cambios – Landing en lenguaje natural

Objetivo: que un dueño de negocio pequeño (cafetería, mercado, tienda) sin conocimientos técnicos entienda para qué sirve Cuadre de Caja, qué problemas le resuelve y qué beneficios le aporta.

---

## 1. Hero (HeroSection.tsx)

### 1.1 Chip superior
- **Actual:** `Solución POS Completa`
- **Propuesta:** `Sistema de ventas e inventario para tu negocio`  
  *(Evita la sigla POS.)*

### 1.2 Subtítulo (frase principal debajo del título)
- **Actual:**  
  `Sistema integral de POS y gestión empresarial con arquitectura multi-tenant. Funcionamiento offline, roles granulares y análisis de rentabilidad avanzado.`
- **Propuesta:**  
  `Lleva las ventas, el inventario y el cierre de caja de tu negocio en un solo lugar. Funciona sin internet y te muestra al instante cuánto vendiste y cuánto ganaste.`

### 1.3 Chips (Multi-Tenant, PWA Offline, CPP Automático)
Sustituir por etiquetas en lenguaje natural:

| Actual        | Propuesta                                      |
|--------------|-------------------------------------------------|
| Multi-Tenant | Varios locales en un solo sistema     |
| PWA Offline  | Usa la app en el celular o tablet               |
| CPP Automático | Saber si ganas o pierdes con cada producto   |

*(En el código: actualizar los `label` de los tres `Chip` en el `Stack` del hero.)*

### 1.4 Botón “Descargar APK”
- **Actual:** `Descargar APK`
- **Propuesta:** `Descargar app para Android`  
  *(O: “Descargar app (Android)” si se quiere más corto.)*

---

## 2. Sección Funcionalidades (FeaturesSection.tsx)

Reescribir **título** y **descripción** de cada tarjeta en lenguaje de negocio. Los “details” pueden mantenerse si se suavizan.

| Card actual | Título propuesto | Descripción propuesta |
|-------------|------------------|------------------------|
| POS Offline-First | Vender sin depender del internet | Cobra aunque se caiga el internet. Las ventas se guardan solas y se actualizan cuando vuelva la conexión. Pantalla pensada para tocar y buscar productos rápido. Escanea productos y acelera tus ventas. |
| Arquitectura Multi-Tenant | Varios locales en uno | Si tienes más de un local, todo se lleva en un solo sistema. Cada local tiene su caja y su inventario; puedes pasar productos de un local a otro desde el sistema. |
| Cierre de Caja | Cierre de caja y resumen del día | Abre y cierra tu caja por día o por turno. Al cerrar ves cuánto vendiste, cuánto entró en efectivo, cuánto por transferencia y cuánto ganaste. |
| Inventario Avanzado | Control de inventario y costos | El sistema lleva solito el costo promedio de lo que vendes, así sabes si ganas o pierdes con cada producto. Incluye productos que se venden por unidad, por kilo o por porción, y manejo de productos en consignación. |
| Descuentos y Promociones | Descuentos y promociones | Aplica descuentos por porcentaje, monto fijo o código. Puedes poner mínimo de compra y fecha de vigencia; en la venta se ve el precio con descuento antes de cobrar. |
| Reportes y Exportación | Reportes y resúmenes | Ve ventas y ganancias en tiempo real. Saca reportes de inventario y cierres de caja en Word o Excel para llevarlos a tu contador o revisarlos cuando quieras. |
| Roles y Permisos | Quién puede hacer qué | Define qué puede hacer cada persona: vendedor, encargado de almacén o administrador. Puedes limitar por local y el sistema registra quién hizo cada operación. |
| PWA y App Móvil | App en el celular o tablet | Instala el sistema como app en tu celular o tablet. Cobra desde ahí con la misma lógica de cierre de caja y permisos; todo se sincroniza solo. |

### Texto introductorio de la sección
- **Actual:**  
  `Sistema integral y escalable para tu empresa. Multi-tenant, múltiples locales y planes de suscripción adaptados a tu negocio.`
- **Propuesta:**  
  `Todo lo que necesitas para vender, controlar stock y saber cuánto ganas. Si tienes un solo local o varios, hay un plan para ti.`

### Bloque “Más valor para tu negocio”
- **Destinos de transferencia**  
  - **Actual:** `Configura bancos o cuentas por tienda para cobros por transferencia`  
  - **Propuesta:** `Configura la cuenta o banco donde quieres recibir transferencias por tienda, para que cada local cobre a su cuenta.`  
  *(Sigue claro pero más orientado a “para qué”.)*

---

### 2.1 Nuevas funcionalidades añadidas (implementadas)

**Productos en consignación:** Resumen detallado: llevar productos que te deja un proveedor para vender y pagarle después; registrar entradas y devoluciones por proveedor; al cerrar caja ver ventas y ganancia de consignación por separado; liquidar al proveedor por período. Incluir que se le puede crear una cuenta al proveedor para que revise en el negocio el inventario de sus productos específicos (solo ve sus productos).

**Análisis de variación de precios:** Análisis de cómo varían los precios de compra de los productos que compras; ver cómo se va comportando para saber si debes subir o bajar tus precios de venta y mantener el margen.

---

## 3. Sección Beneficios (BenefitsSection.tsx)

### 3.1 Títulos y descripciones de beneficios

| Actual | Propuesta (título / descripción) |
|--------|----------------------------------|
| **Control Total Multi-Tenant** / *Gestiona múltiples negocios con aislamiento completo y seguridad empresarial.* | **Varios negocios o locales en un solo sistema** / Lleva más de un local o negocio desde una sola cuenta. Los datos de cada uno están separados y seguros; tú eliges qué ver en cada momento. |
| **Funcionamiento Offline** / *Nunca pierdas una venta: el POS funciona sin conexión…* | **Funciona sin internet** / Si se cae el internet o no hay señal, igual puedes cobrar. Las ventas se guardan y cuando vuelva la conexión se actualizan solas. |
| **CPP Automático** / *Cálculo automático de Costo Promedio Ponderado…* | **Saber si ganas o pierdes** / El sistema calcula solito el costo promedio de lo que vendes. Así ves si cada producto te deja ganancia y puedes tomar mejores decisiones. |
| **Roles y Permisos** / *Permisos por funcionalidad y por tienda. Roles personalizables con trazabilidad…* | **Control de quién hace qué** / Asigna permisos por persona y por local (vendedor, almacén, administrador). El sistema registra quién hizo cada venta o movimiento, para tener orden y confianza. |

**Beneficio adicional (implementado):** En el beneficio de costos/rentabilidad, agregar que se venden productos desagregados (por unidad, kilo o porción) y el sistema se encarga de mover las cantidades automáticamente.

### 3.2 Listas de “features” dentro de cada beneficio

Sustituir jerga por lenguaje natural, por ejemplo:

- **Multi-tenant:**  
  - En lugar de “Arquitectura multi-tenant robusta” → “Varios negocios o locales en una sola cuenta”.  
  - “Límites por plan de suscripción” → “Cada plan incluye un número de locales y usuarios”.  
  - “Control de usuarios por negocio” → “Usuarios asignados a cada negocio o local”.  
  - “Datos completamente aislados” → “Los datos de un negocio no se mezclan con los de otro”.

- **Offline:**  
  - Mantener ideas como “sincronización al reconectar”, “ventas en cola”, “indicador de conexión” pero en frases:  
  - “Se actualiza solo al volver el internet”, “Las ventas hechas sin internet se envían después”, “Ves si estás conectado o no”.

- **CPP:**  
  - “Costo promedio ponderado” → “Costo promedio de lo que vendes (calculado automático)”.  
  - “Actualización en tiempo real” → “Se actualiza al instante”.  
  - “Análisis de rentabilidad” → “Saber si ganas o pierdes con cada producto”.  
  - “Trazabilidad de movimientos” → “Historial de entradas y salidas de producto”.

- **Roles:**  
  - “Permisos por módulo” → “Permisos por función (ventas, inventario, reportes, etc.)”.  
  - “Roles por tienda (vendedor, almacenero, admin)” → “Vendedor, encargado de almacén o administrador por tienda”.  
  - “Trazabilidad de operaciones” → “Registro de quién hizo cada operación”.  
  - “Control de acceso por local” → “Cada usuario puede tener acceso solo a los locales que tú elijas”.

### 3.3 Lista “Problemas que resolvemos”

- **Actual (resumido):**  
  Pérdida de ventas por falta de conexión, Cálculo manual de costos promedio, Falta de control multi-tenant, Reportes sin exportación profesional, Gestión compleja de productos fraccionados, Ausencia de roles granulares, Traspasos manuales entre locales, Sincronización deficiente de datos.

- **Propuesta (mismo orden de ideas, en lenguaje de dueño de negocio):**
  1. Se cae el internet y no puedes cobrar.
  2. Tienes que calcular a mano si estás ganando o perdiendo con cada producto.
  3. Tienes varios locales o negocios y no los llevas ordenados en un solo sistema.
  4. No puedes sacar reportes claros para tu contador o para revisar.
  5. Vendes por unidad, por kilo o por porción y se complica llevar el control.
  6. No puedes limitar qué hace cada empleado en el sistema.
  7. Pasas productos de un local a otro anotando en papel o en otra planilla.
  8. Los datos de un local y otro no se actualizan bien entre sí.
  9. Problemas básicos de tener un sistema en la nube: no depender de anotar las ventas en papel.
  10. Conteos manuales con papel.
  11. Revisiones o registros en Excel.
  12. Acceder a la información desde la comodidad de tu casa para revisarla cuando quieras usando solo tu teléfono.
  13. Quieres ver cómo van las ventas del día si estás de vacaciones con tu familia.

### 3.4 Texto introductorio “¿Te identificas con estos problemas?”
- **Actual:**  
  `Conocemos los desafíos técnicos y operativos de los sistemas POS tradicionales. Cuadre de Caja resuelve estos problemas con tecnología moderna.`
- **Propuesta:**  
  `Sabemos lo que duele en el día a día: internet que falla, no saber si ganas o pierdes, inventario desordenado. Cuadre de Caja te ayuda a tener todo bajo control, sin necesidad de ser experto en sistemas.`

### 3.5 Tipos de negocio (“Perfecto para tu tipo de negocio”)

- Incluir de forma explícita **Cafetería** y **Mercado** (o “Negocio de comida / abarrotes”) además de Tiendas de barrio, Supermercados y Cadenas.
- Propuesta de textos:
  - **Tiendas de barrio:** “Controla las ventas del día, el inventario y atiende mejor a tus clientes.”
  - **Cafetería / Negocio de comida:** “Lleva ventas, productos por unidad o por porción y cierre de caja sin complicarte.”
  - **Supermercados:** “Varias categorías, varios proveedores y control de stock al instante.”
  - **Cadenas de tiendas:** “Varios locales en un solo sistema; cada uno con su caja e inventario.”

*(Si no quieres alargar la grilla, se puede sustituir “Cadenas de Tiendas” por “Cafeterías y mercados” en una de las tarjetas, o añadir una cuarta tarjeta.)*

---

## 4. Precios (PricingSection.tsx)

El contenido ya es comprensible. Cambios opcionales:

- **Texto intro:**  
  - **Actual:** `Planes flexibles con límites claros por suscripción. Comienza gratis por 7 días y escala según tu crecimiento.`  
  - **Propuesta (opcional):** `Elige el plan que se ajuste a tu negocio: por número de locales, usuarios y productos. Prueba gratis 7 días y luego el plan que prefieras.`

- En listas de planes, si aparece “Funcionalidades básicas” o “Acceso completo a funcionalidades”, se puede sustituir por: “Todo lo necesario para vender, inventario y cierre de caja” / “Todas las funciones del sistema”, para evitar la palabra “funcionalidades” si se quiere aún más simple.

---

## 5. Contacto (ContactSection.tsx)

- El formulario y los tipos de negocio ya están bien.
- En “¿Qué incluye tu demo?” se puede cambiar “Análisis de tus necesidades específicas” por “Revisar qué necesitas para tu negocio” si se quiere más cercano.

---

## 6. Footer (page.tsx)

### 6.1 Descripción de “Cuadre de Caja”
- **Actual:**  
  `Sistema integral de punto de venta y gestión empresarial con arquitectura multi-tenant. Diseñado para pequeñas y medianas empresas que buscan control total y crecimiento sostenible.`
- **Propuesta:**  
  `Cuadre de Caja es un sistema para llevar las ventas, el inventario y el cierre de caja de tu negocio. Sirve para un solo local o para varios; funciona sin internet y te ayuda a saber cuánto vendes y cuánto ganas. Pensado para pequeños y medianos negocios.`

### 6.2 Lista “Funcionalidades” en el footer

Sustituir por versión en lenguaje natural (misma información, sin siglas ni jerga):

| Actual | Propuesta |
|--------|-----------|
| POS con funcionamiento offline | Cobrar y registrar ventas sin internet |
| Gestión multi-tenant y múltiples locales | Varios locales o negocios en un solo sistema |
| Cierre de caja y resumen por período | Cierre de caja y resumen por día o período |
| Descuentos y promociones configurables | Descuentos y promociones que tú configuras |
| Costo promedio ponderado (CPP) | Cálculo automático de si ganas o pierdes por producto |
| Reportes a Word y Excel | Reportes que puedes sacar en Word o Excel |
| Roles y permisos por tienda | Control de qué hace cada usuario por tienda |
| PWA y app móvil | App para usar en celular o tablet |
| Descargar App Android (APK) | Descargar app para Android |

---

## 7. Resumen de archivos a tocar

| Archivo | Cambios |
|---------|--------|
| `HeroSection.tsx` | Chip, subtítulo, 3 chips (labels), texto botón APK |
| `FeaturesSection.tsx` | Títulos y descripciones de las 8 features, texto intro, “Más valor” (destinos de transferencia) |
| `BenefitsSection.tsx` | 4 beneficios (título, descripción, listas), lista “Problemas que resolvemos”, texto intro, tipos de negocio (+ Cafetería/Mercado) |
| `PricingSection.tsx` | Texto intro opcional, redacción de ítems de planes (opcional) |
| `ContactSection.tsx` | Texto “necesidades específicas” (opcional) |
| `page.tsx` | Footer: descripción de Cuadre de Caja y lista de funcionalidades |

---

## 8. Orden sugerido de implementación

1. **Hero:** chip, subtítulo y chips (impacto alto, poco código).
2. **Footer:** descripción y lista (rápido y coherente con el resto).
3. **Problemas que resolvemos** en BenefitsSection (lista de 8 ítems).
4. **Beneficios:** títulos, descripciones y listas internas.
5. **Funcionalidades:** títulos y descripciones de las 8 tarjetas + texto intro y “Más valor”.
6. **Tipos de negocio:** añadir Cafetería/Mercado y ajustar textos.
7. **Pricing y Contacto:** cambios opcionales.

Si quieres, el siguiente paso puede ser aplicar estos cambios en el código archivo por archivo.
