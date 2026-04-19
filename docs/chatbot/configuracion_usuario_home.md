# Inicio — qué debe estar preparado

| Requisito | Motivo |
|-----------|--------|
| **Usuario con sesión válida** | El panel solo tiene sentido tras el login. |
| **Al menos un local** asignado al usuario | Sin locales, el inicio muestra el flujo de bienvenida con enlace a configuración. |
| **Local actual seleccionado** | Sin eso, no se cargan widgets que dependen de la tienda (vencimientos, etc.). |
| **Permisos por módulo** | Define qué tarjetas de **acceso rápido** y qué ítems de **configuración** se muestran. |
| **Plan de suscripción activo o en gracia** | Si está vencido o suspendido, verás avisos y posibles limitaciones de uso (coherente con login y middleware). |

## Tipo de local

- En **almacén**, algunos accesos rápidos **no se listan** (POS, ventas, cierre, etc.) para alinear el uso del sistema con un depósito.
