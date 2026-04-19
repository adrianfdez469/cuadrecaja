# Cierre de caja — guía paso a paso

## Antes de empezar

1. **Tienda actual** correcta.
2. **Ventas del POS** subidas al servidor (en **Ventas** deberían verse las ventas ya guardadas).
3. En el mismo equipo donde usaste el POS: si quedaron ventas **pendientes de sincronizar** en ese navegador, el **Cierre** puede bloquearte hasta que sincronicés en el **POS**.

---

## Entender la pantalla

- **Título / subtítulo:** indica el **período** (fecha de inicio) que estás viendo.
- **Tarjetas resumen:** tipos de productos vendidos, unidades, total bruto de ventas, descuentos del período (si hay), **ventas propias** vs **consignación**, y con permiso **ganancia total**.
- **Detalle de productos:** tabla con acordeones (propios / consignación), totales y, si aplica, **resumen por vendedor** y **transferencias por destino**.
- **Exportar:** menús para bajar **Excel** de productos (según opciones que muestre tu pantalla).
- **Lista de gastos del período:** visible si tenés permiso de **ver gastos**; el ícono de **ticket** abre **gasto puntual (ad-hoc)** solo si tenés **gestionar gastos**.
- **Refresco:** vuelve a pedir los datos al servidor.

---

## Cerrar el período (corte de caja)

1. Revisá números y exportaciones si las necesitás para contabilidad.
2. Pulsá **Cerrar caja**.
3. Si el sistema avisa de **ventas sin sincronizar en el POS**, andá al POS, sincronizá y volvé.
4. Se abre **“Revisión de gastos antes del cierre”**:
   - **Gastos recurrentes** que “aplican hoy”: podés **desmarcar** los que no quieras cargar en este cierre.
   - **Gastos ad-hoc** del período: suelen listarse para información; el total cuenta en el resumen.
   - Mirá **ganancia neta** estimada; si sale **negativa**, hay una **advertencia** (gastos mayores que ganancias del período).
5. Pulsá **Confirmar y cerrar** (o **Cancelar** para volver atrás sin cerrar).
6. **Qué debería pasar:** mensaje de **cierre realizado**; el sistema **cierra** el período, **aplica** la lógica de gastos elegida y **abre un período nuevo** para seguir vendiendo.

---

## Crear el primer período

1. Si ves el mensaje de negocio nuevo sin períodos, pulsá **Crear primer período**.
2. Esperá la confirmación y recargá datos si hace falta.

---

## Después del cierre

- Seguí vendiendo en el **POS** en el **nuevo período**.
- Para ver **cierres anteriores** en detalle o listados históricos, usá **Resumen de cierres** (cuando esté documentado en el chatbot, será el siguiente bloque del plan).

---

## Relación con otros módulos

| Necesidad | Módulo |
|-----------|--------|
| Cobrar | **POS** |
| Ver tickets por venta | **Ventas** |
| Cargar plantillas de gastos | **Gastos** (configuración de tienda) |
| Historial de cortes | **Resumen de cierres** |
