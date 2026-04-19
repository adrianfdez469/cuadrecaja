# Gastos — guía paso a paso

## Parte A: Gastos de la tienda (`/gastos`)

### Qué es

- Título: **Gastos**.
- Bloque principal: **Gastos de la tienda**, con texto de ayuda sobre gastos **recurrentes** y su relación con los **cierres de período**.

### Antes de empezar

1. Elegí la **tienda** correcta (barra superior).
2. Con permiso de **solo ver**, podés leer la lista. Con permiso de **gestionar**, ves botones **Asignar plantilla** y **Nuevo gasto**.

### Crear un gasto recurrente

1. Pulsá **Nuevo gasto**.
2. Completá **nombre** y **categoría** (podés elegir sugerencias o escribir una nueva).
3. Elegí **tipo de cálculo**:
   - **Monto fijo:** se descuenta un importe fijo cada vez que aplica.
   - **% sobre ventas:** un porcentaje del total de ventas del período.
   - **% sobre ganancias:** un porcentaje de las ganancias brutas del período.
4. Elegí **recurrencia** (según la pantalla: único, diario, mensual, anual; cada opción trae texto de ayuda):
   - **Único:** una sola vez (no se repite sola).
   - **Diario:** en cada cierre de período.
   - **Mensual / anual:** cuando el cierre cae en el día o fecha configurados.
5. Rellená montos o porcentajes y, si aplica, día del mes / mes / día del año que pide el formulario.
6. Activá o desactivá el interruptor **activo** si existe.
7. **Guardar**.

**Qué debería pasar:** Mensaje de **Gasto creado** y la fila nueva en la lista.

### Asignar una plantilla del negocio

1. Pulsá **Asignar plantilla**.
2. Elegí la plantilla en el paso 1.
3. En el paso 2, ajustá valores o fechas si la pantalla lo pide y confirmá.

**Qué debería pasar:** Mensaje **Plantilla asignada** y nuevas filas o gastos según la plantilla.

### Editar, activar/desactivar o eliminar

- **Editar:** abre el mismo formulario con datos cargados; al guardar: **Gasto actualizado**.
- **Activar/desactivar:** cambia si el gasto sigue vigente para futuros cierres.
- **Eliminar:** pide confirmación; si hay historial en cierres, el aviso indica que puede **desactivarse** en lugar de borrarse.

---

## Parte B: Plantillas de gastos (`/gastos/plantillas`)

- Menú **Configuración → Plantillas de Gastos** (misma ruta que `/gastos/plantillas` según el diseño del menú).
- Sirve para definir **modelos** reutilizables del negocio.
- Botón **Nueva plantilla**, tabla con plantillas existentes, editar y eliminar con confirmación.

**Permiso:** gestionar plantillas a nivel negocio (no es el mismo que “ver gastos” de una tienda).

---

## Parte C: Gastos en el cierre de caja

1. Si podés **ver gastos**, en la pantalla de **Cierre** puede mostrarse el bloque **Gastos del período** con el detalle y totales (incluye **ad-hoc** si los hubo).
2. Si podés **gestionar gastos**, podés abrir el registro de **gasto ad-hoc** (gasto puntual del período) desde el flujo que muestre tu versión del cierre.
3. Al **cerrar** la caja, el sistema puede abrir **Revisión de gastos antes del cierre**: lista de **recurrentes que aplican hoy** (podés desmarcar los que no correspondan), más **ad-hoc** ya cargados, y una **ganancia estimada** después de gastos. Confirmá cuando esté todo revisado.

**Relación:** los recurrentes respetan la **recurrencia** (por ejemplo mensual solo el día configurado). El texto de ayuda en pantalla lo explica brevemente.
