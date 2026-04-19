# Proveedores — permisos (lenguaje sencillo)

## Tres ideas que debe conocer soporte

1. **Ver y editar la ficha de proveedores** (Configuración → Proveedores) requiere permiso de **configuración de proveedores**.
2. **Entrar a la pantalla de consignación** del menú principal requiere permiso de **recuperaciones / proveedores en consignación** (acceso amplio a esa sección según la descripción interna del producto).
3. **Pulsar el botón “Liquidar”** en una liquidación pendiente depende de un permiso adicional de **liquidar proveedores**, descrito en el producto como parte de la configuración de proveedores aunque el botón aparezca en la pantalla de consignación.

## Cómo se nota cada falta de permiso

| Situación | Lo que ve el usuario |
|-----------|----------------------|
| Sin acceso a configuración de proveedores | No aparece “Proveedores” en Configuración, o al guardar sale no autorizado. |
| Sin acceso a consignación | No aparece “Proveedores consignación” en el menú de resúmenes. |
| Sin permiso de liquidar | Puede que el botón “Liquidar” no esté disponible o que falle al usarlo (según dispositivo o vista). |

## Superadministrador

Quien administra toda la plataforma conserva acceso completo a todo; no aplica la restricción anterior.

## Qué pedir al administrador del negocio

- “Necesito **dar de alta proveedores**” → permiso de configuración de proveedores.  
- “Necesito **ver cuadros de consignación**” → permiso de proveedores en consignación en recuperaciones.  
- “Necesito **cerrar liquidaciones**” → permiso de liquidar proveedores.

Tras cualquier cambio de rol, **cerrar sesión y volver a entrar** antes de probar otra vez.
