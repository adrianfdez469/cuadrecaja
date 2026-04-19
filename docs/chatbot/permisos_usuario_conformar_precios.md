# Conformar precios — permisos (lenguaje sencillo)

## Entrar al menú

- Permiso **operaciones.conformar precios** (“Permite conformar precios de productos” en la descripción interna).

Sin él, no verás **Conformar precios** en operaciones.

---

## Guardar precios y otros datos de producto en tienda

- El **guardado** desde esta pantalla usa la misma regla del servidor: hace falta **conformar precios**.

Por eso, si alguien puede ver **Inventario** pero **no** puede guardar **fecha de vencimiento**, casi siempre le falta este permiso (ver guía de Inventario).

---

## Generar códigos de barra desde etiquetas

- La acción llama a servicios de producto; en muchos negocios también se exige el permiso de **generar código** en configuración de productos. **No está garantizado** solo con conformar precios: si falla, revisar rol con el administrador.

---

## Superadministrador

Acceso completo.

---

## Resumen para el bot

- “No veo conformar precios” → permiso **conformar precios**.  
- “No guarda vencimiento en inventario” → mismo permiso, explicarlo con calma.  
- “No genera códigos” → revisar permiso de **códigos de producto** además del acceso a etiquetas.
