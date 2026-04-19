# Dashboard — permisos (lenguaje sencillo)

## Resumen del negocio (menú “Dashboard” en Recuperaciones)

| Permiso | Efecto |
|---------|--------|
| **`recuperaciones.dashboard.acceder`** | Ver el ítem **Dashboard** en **Recuperaciones** y que la página **Resumen del Negocio** cargue datos desde el servidor. |

Sin este permiso: el menú no aparece (según configuración del rol) o la API responde **no autorizado**.

## Dashboard ejecutivo (`/dashboard`)

- En el código actual de la API de métricas **no** se comprueba explícitamente `recuperaciones.dashboard.acceder`; basta con estar **logueado** y tener **acceso a la tienda** pedida.
- **Recomendación para el administrador:** dar el ejecutivo solo a quienes deban ver **métricas agregadas** de varias sucursales o del período (encargados, dueños), aunque técnicamente la ruta pueda ser más permisiva.

## Superadministrador

Puede consultar cualquier tienda del negocio donde aplique la lógica del servidor.

## Resumen para el bot

- “No tengo el Dashboard de recuperaciones” → **`recuperaciones.dashboard.acceder`**.  
- “Tengo el menú pero no carga” → tienda, **Aplicar** en filtros, red, sesión.  
- “Quiero el otro dashboard” → aclarar si es **ejecutivo** (período + inventario) o **resumen del negocio** (rankings por tiempo).
