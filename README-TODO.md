
RECOMENDACIONES PRIORITARIAS:

2- Implementar paginación server-side
6- Unificar formato de fechas y monedas
7- Añadir confirmaciones para acciones destructivas

IDEAS FUTURAS


- Mostrar reportes por negocio, con filtros por tiendas. (Reportes de inventario, contables)
- Diferenciar tiendas de almacenes, y definir funcionalidades en cada una.
- Desarrollar el CPP (Costo promedio ponderado)
- Crear configurción por cada negocio para ver como se va a formar el costo de los productos:
  - CPP por tienda
  - CPP genérico para todos las tiendas/almacenes del negocio
  - Editable por tienda
  - Editable genérico para todos las tiendas/almacenes del negocio
- Crear traspaso entre entidades.

- Configurar máximos y minimos de stock en tiendas y locales.
- Pensar y definir como funcionarán los permisos
- Desarrollar una app para usuarios donde puedan buscar productos cercanos
- Pensar y desarrollar modulo de Recursos Humanos y pago a trabajadores
- Pensar y desarrollar modulo de Impuestos (ONAT)
- Pedir información de usuario que usan el aplicativo para poder enviarle mensajes de actualización y tener una via de cominicación
- Facilitar a vendedores opción de tienda online o pagina de la tienda con su catálogo, promociones y rebajas


PROBLEMAS ESPECÍFICOS POR ARCHIVO:

costos_precios/page.tsx:
Filtrado ineficiente con hidden property
Falta validación de números
Sin manejo de errores en la edición

tablaProductosCierre/intex.tsx:
Nombre de archivo incorrecto (intex → index)
Lógica de totales hardcodeada
Sin manejo de productos sin datos

inventario/page.tsx:
tableCellHeaderStyle repetido innecesariamente
Click handler sin feedback visual
Export solo a Word, sin otras opciones

ventas/page.tsx:
Estados de carga redundantes
Manejo de períodos complejo
Sin paginación para ventas grandes

movimientos/page.tsx:
Paginación manual básica
Sin filtros por tipo de movimiento
Formato de fecha inconsistente

configuracion/productos/page.tsx:
Loading mal posicionado
Edición sin validación
Color picker inline sin componente
configuracion/usuarios/page.tsx:

Validación de admin hardcodeada
Sin manejo de errores
Formulario sin validación client-side