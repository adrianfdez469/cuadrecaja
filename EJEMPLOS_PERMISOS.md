# Sistema de Permisos - Guía de Uso

## Descripción

El sistema de permisos complementa el sistema de autenticación actual con un sistema granular basado en strings. Los permisos se cargan automáticamente en la sesión del usuario basándose en el rol asignado en la tienda actual.

## Estructura

### Datos de Sesión Actualizados

La sesión del usuario ahora incluye:
```typescript
{
  id: string;
  usuario: string;
  nombre: string;
  rol: string; // Rol tradicional: SUPER_ADMIN, ADMIN, VENDEDOR
  locales: ILocal[];
  localActual?: ILocal | null;
  negocio: INegocio;
  permisos?: string; // NUEVO: Permisos separados por "|"
}
```

### Permisos Disponibles

Los permisos están definidos en `src/constants/permisos.json` con formato:
```
"operaciones.pos-venta.acceder|configuracion.usuarios.acceder|recuperaciones.inventario.acceder"
```

## Ejemplos de Uso

### 1. Hook para Componentes de Cliente

```typescript
import { usePermisos } from "@/utils/permisos";

function MiComponente() {
  const { verificarPermiso, permisos, listaPermisos } = usePermisos();

  // Verificar un permiso específico
  const puedeVender = verificarPermiso("operaciones.pos-venta.acceder");

  // Ver todos los permisos
  console.log("Permisos del usuario:", listaPermisos);

  return (
    <div>
      {puedeVender && <button>Realizar Venta</button>}
      {puedeConfigurar && <button>Configuración</button>}
    </div>
  );
}
```

### 2. Verificación en APIs (Servidor)

```typescript
import getUserFromRequest from "@/utils/getUserFromRequest";
import { verificarPermisoUsuario } from "@/utils/permisos";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  
  // Verificar permiso específico
  if (!verificarPermisoUsuario(user.permisos, "operaciones.pos-venta.acceder")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Tu lógica aquí...
}
```

### 3. Funciones Utilitarias

```typescript
import { getPermisosUsuario, tienePermiso } from "@/utils/getPermisosUsuario";

// Obtener permisos de un usuario para una tienda específica
const permisos = await getPermisosUsuario(usuarioId, tiendaId);

// Verificar si tiene un permiso específico
const puedeAcceder = tienePermiso(permisos, "configuracion.roles.acceder");

// Convertir string de permisos a array
const listaPermisos = parsearPermisos(permisos);
```

## Flujo de Funcionamiento

1. **Login**: Al autenticarse, se cargan los permisos basados en el rol del usuario en la tienda actual
2. **Cambio de Tienda**: Los permisos se actualizan automáticamente al cambiar de tienda
3. **APIs**: Los permisos están disponibles en todas las APIs a través de las cabeceras HTTP
4. **Frontend**: Los permisos están disponibles en la sesión para verificaciones en tiempo real

## Compatibilidad

- ✅ El sistema anterior sigue funcionando (roles SUPER_ADMIN, ADMIN, VENDEDOR)
- ✅ El nuevo sistema es complementario, no reemplaza el anterior
- ✅ Los permisos se cargan automáticamente sin necesidad de cambios en código existente
- ✅ Las verificaciones de permisos son opcionales - si no hay rol asignado, el string de permisos estará vacío

## Notas Importantes

- Si un usuario no tiene rol asignado en una tienda, `permisos` será una cadena vacía
- Los permisos se actualizan automáticamente al cambiar de tienda
- SUPER_ADMIN mantiene acceso completo independientemente de los permisos específicos
- El sistema funciona tanto en modo online como offline (datos en sesión) 