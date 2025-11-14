# Limpiar datos de un Negocio

Este utilitario elimina TODOS los datos asociados a un Negocio específico (tenant) en la base de datos, siguiendo el orden correcto de dependencias para evitar errores por llaves foráneas.

Advertencia: Esta acción es DESTRUCTIVA e IRREVERSIBLE. Úsala con extremo cuidado y preferentemente en ambientes de desarrollo/pruebas.

## Requisitos
- Configurar las variables de entorno en el `.env` del proyecto raíz (DATABASE_URL/DIRECT_URL).
- Tener instaladas las dependencias del proyecto raíz (incluye `@prisma/client`).

## Instalación
```
cd tools/limpiar-negocio
npm install
```

## Uso
Compilar y ejecutar en modo simulación (dry-run por defecto):
```
npm run build
node dist/limpiarNegocio.js --nombre "Mi Negocio" --dry-run
```

Para ejecutar realmente los borrados (requiere confirmación):
```
node dist/limpiarNegocio.js --nombre "Mi Negocio" --execute --yes
```

También puedes usar el id del negocio:
```
node dist/limpiarNegocio.js --negocioId 00000000-0000-0000-0000-000000000000 --execute --yes
```

Parámetros:
- --nombre: nombre único del negocio.
- --negocioId: id del negocio.
- --dry-run: no borra, solo muestra conteos (por defecto).
- --execute: ejecuta el borrado.
- --yes: omite confirmación interactiva.
- --help: muestra ayuda.

## Qué elimina
- Ventas y sus productos (Venta, VentaProducto)
- Cierres de período y liquidaciones (CierrePeriodo, ProductoProveedorLiquidacion)
- Movimientos de stock (MovimientoStock)
- Productos en tiendas y transfer destinations (ProductoTienda, TransferDestinations)
- Código de productos (CodigoProducto)
- Relaciones usuario-tienda (UsuarioTienda)
- Catálogo (Producto, Categoria, Proveedor, Rol)
- Usuarios, Tiendas
- Por último el registro de Negocio

El borrado se realiza en el orden correcto para respetar dependencias.
