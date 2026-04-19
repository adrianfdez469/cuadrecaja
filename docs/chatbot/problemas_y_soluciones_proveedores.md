# Proveedores — problemas y soluciones (usuario final)

En la aplicación hay **dos sitios distintos** con la palabra “proveedores”. No son dos listas diferentes: en la práctica el negocio tiene **una ficha de proveedores**; una pantalla sirve para **crear y editar datos** y la otra para **ver dinero y consignación** cuando aplica.

---

## No veo el menú “Proveedores consignación” (o “Proveedores” en resúmenes)

**Cómo identificarlo:** En el menú principal, dentro del bloque de resúmenes o recuperaciones, no aparece la opción.

**Qué suele pasar:** Tu usuario no tiene permiso para esa sección.

**Solución paso a paso:**

1. Confirma con tu administrador que tu trabajo deba incluir **seguimiento de proveedores en consignación**.
2. Pide que revisen tu **rol** y activen el permiso correspondiente a “recuperaciones / proveedores consignación” (el nombre exacto en pantalla de roles puede variar).
3. Cierra sesión y vuelve a entrar.

---

## No veo “Proveedores” dentro de Configuración

**Qué suele pasar:** Mismo caso: falta permiso de **configuración de proveedores**.

**Solución:** Un administrador debe darte acceso a **Configuración → Proveedores** desde los roles.

---

## En “Proveedores” (consignación) la lista sale vacía o todo en cero

**Cómo identificarlo:** Entras a la pantalla de gestión de consignación y no hay filas, o los totales son cero.

**Posibles causas:**

1. **Aún no se dieron de alta proveedores** en Configuración → Proveedores.
2. **No hay movimientos de consignación** registrados para esos proveedores (por ejemplo, sin cierres o sin productos ligados a consignación según cómo trabaje tu negocio).

**Solución:**

1. Primero revisa **Configuración → Proveedores** y crea al menos el proveedor con nombre y datos de contacto.
2. Si los proveedores ya existen pero la otra pantalla sigue vacía, el tema ya no es “el catálogo”, sino **que no haya operaciones de consignación** que alimenten los totales. Ahí debe intervenir quien lleva el **cierre de caja** o la operación diaria, según el procedimiento del negocio.

---

## No me deja guardar un proveedor nuevo

**Señales:** Mensaje de que falta el nombre, o que ya existe otro con el mismo nombre, o algo sobre el usuario elegido.

**Soluciones:**

- **Falta el nombre:** es obligatorio; escribe al menos el nombre comercial del proveedor.
- **“Ya existe con ese nombre”:** cambia el nombre o edita el proveedor que ya estaba creado.
- **Usuario no válido:** si elegiste una “persona de la empresa” vinculada al proveedor, debe ser alguien **del mismo negocio**. Si no estás seguro, deja ese campo vacío (es opcional).

---

## Veo liquidaciones “pendientes” pero no puedo pulsar “Liquidar” o no hace nada

**Qué suele pasar:** Tu rol **no incluye** la acción de registrar liquidaciones a proveedores. En la aplicación, ese permiso está ligado a la **configuración de proveedores (liquidar)**, aunque el botón esté en la pantalla de consignación.

**Solución:** Pide al administrador que añada a tu rol el permiso de **liquidar proveedores** (o que liquide él las pendientes).

**Nota:** Si ves el botón pero al usarlo falla, anota el mensaje exacto y la hora; puede ser fallo puntual o permiso que no se aplicó hasta cerrar sesión.

---

## Me dice “proveedor no encontrado” al abrir un detalle

**Qué suele pasar:** Enlace viejo, proveedor borrado, o estás en otro negocio/tienda de contexto.

**Solución:** Vuelve al listado general de proveedores en consignación y entra de nuevo desde la lista actual.
