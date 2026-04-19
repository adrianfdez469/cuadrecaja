# Análisis CPP — permisos (lenguaje sencillo)

## Ver la pantalla

- Permiso de **recuperaciones de análisis CPP** (descripción interna: acceder a análisis de costo y costo promedio ponderado de los productos).

Sin ese permiso, **no aparece** “Análisis de CPP” en el menú de resúmenes.

---

## Botón “Migrar datos”

- En el código revisado, el botón se muestra a quien ya puede ver la pantalla y cumple la condición de aviso; **no** vimos un permiso aparte solo para migración.

**Recomendación para el negocio:** tratar la migración como acción de **administrador o soporte**, aunque el botón sea visible, para evitar cambios masivos sin control.

---

## Superadministrador

Tiene acceso completo como en el resto del sistema.

---

## Resumen para el bot

- “No veo CPP” → permiso **recuperaciones análisis CPP**.  
- “Veo CPP pero no debería poder migrar” → norma interna del negocio; el producto puede mostrar el botón sin un segundo candado específico en la interfaz analizada.
