# Inventario — permisos (lenguaje sencillo)

## Entrar a la pantalla

- Menú **Inventario** visible → permiso de **recuperaciones del inventario** (“acceder a la interfaz de recuperaciones del inventario actual de los productos” en la descripción interna).

Sin ese permiso, no verás la opción en el menú de resúmenes.

---

## Ver lista y exportar

- Con solo el permiso de inventario sueles poder **ver**, **buscar**, **filtrar vencimientos**, **abrir historial** y **exportar** (si hay precios válidos).

---

## Editar fecha de vencimiento desde Inventario

- El guardado pasa por una regla del sistema que exige permiso de **Conformar precios** (menú de operaciones con ese nombre), **aunque solo cambies la fecha**.

Si puedes ver inventario pero **no** guardar fechas, pide ese permiso adicional o que alguien con ambos permisos haga el cambio.

---

## Usuario “ligado” a un proveedor

- Si en la ficha del proveedor (Configuración → Proveedores) pusieron tu usuario como **contacto asociado**, tu lista de inventario puede mostrar **solo** productos de ese proveedor y con reglas distintas de visualización respecto a otros empleados.

No es un fallo de permiso de inventario en sí; es **filtro por rol comercial** del negocio.

---

## Superadministrador

Acceso completo sin restricciones habituales.

---

## Resumen para el bot

- “No veo Inventario” → permiso **recuperaciones inventario**.  
- “Veo todo pero no guarda la fecha” → permiso **Conformar precios**.  
- “Veo pocos productos” → revisar **filtro de vencimiento**, **tienda** y **vinculación a proveedor**.
