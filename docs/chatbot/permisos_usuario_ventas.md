# Ventas — permisos (lenguaje sencillo)

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder a ventas** | Ver el menú **Ventas** y el listado del período cargado. |
| **Eliminar ventas** | Poder **borrar una venta completa** en el servidor (con las reglas de período abierto). |

## Permiso compartido con el POS

Para **eliminar venta completa** o **quitar productos de una venta**, el backend también acepta quien tenga **cancelar ventas del POS** (`operaciones.pos-venta.cancelarventa`). Es decir: **“eliminar ventas”** **o** **“cancelar ventas del POS”** — con que exista **uno** de los dos, suele alcanzar para esas acciones.

## Regla extra para quitar una línea (no toda la venta)

Aunque tengas uno de los permisos anteriores, para **borrar un producto suelto** dentro del detalle:

- Tenés que ser el **vendedor de esa venta**, **o**
- Ser **superadministrador**.

Y la venta debe tener **más de un producto** (no se puede vaciar por líneas).

## Superadministrador

Puede actuar sobre ventas de **otros usuarios** en el detalle (líneas), además de las reglas del servidor.

## Resumen para el bot

- “No veo Ventas” → **acceder a ventas**.  
- “No me deja borrar” → **eliminar ventas** o **cancelar ventas del POS** + **período abierto**.  
- “No puedo sacar un producto de la venta de Juan” → solo **dueño de la venta** o **superadmin** (y permiso de eliminar/cancelar).
