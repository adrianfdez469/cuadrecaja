import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ICierreData } from '@/types/ICierre';

interface ExportProductosVendidosOptions {
    cierreData: ICierreData;
    tiendaNombre: string;
    fechaInicio: Date;
    fechaFin?: Date;
}

export const exportProductosVendidosToExcel = async ({
    cierreData,
    tiendaNombre,
    fechaInicio,
    fechaFin
}: ExportProductosVendidosOptions) => {
    try {
        const workbook = XLSX.utils.book_new();

        // Preparar datos para todas las hojas
        const productosVendidos = cierreData.productosVendidos;

        // 1. Hoja con TODOS los productos vendidos
        const todosLosProductos = productosVendidos.map(producto => ({
            'Producto': producto.nombre,
            'Vendidos': producto.cantidad,
            'Costo': producto.costo,
            'Total': producto.cantidad * producto.costo,
            'Proveedor': producto.proveedor?.nombre || 'Propio'
        }));

        const productosTodosTotal = todosLosProductos.reduce((acc, producto) => acc + producto.Total, 0);
        const dataTodos = [
            ...todosLosProductos,
            {
                'Producto': 'TOTAL',
                'Vendidos': '',
                'Costo': '',
                'Total': productosTodosTotal,
                'Proveedor': ''
            }
        ];


        const worksheetTodos = XLSX.utils.json_to_sheet(dataTodos);
        XLSX.utils.book_append_sheet(workbook, worksheetTodos, 'Todos los Productos');

        // 2. Hoja con productos PROPIOS
        const productosPropios = productosVendidos
            .filter(producto => !producto.proveedor)
            .map(producto => ({
                'Producto': producto.nombre,
                'Vendidos': producto.cantidad,
                'Costo': producto.costo,
                'Total': producto.cantidad * producto.costo,
                'Proveedor': 'Propio'
            }));

        if (productosPropios.length > 0) {

            const productosPropiosTotal = productosPropios.reduce((acc, producto) => acc + producto.Total, 0);
            const dataPropios = [
                ...productosPropios,
                {
                    'Producto': 'TOTAL',
                    'Vendidos': '',
                    'Costo': '',
                    'Total': productosPropiosTotal,
                    'Proveedor': ''
                }
            ];
            const worksheetPropios = XLSX.utils.json_to_sheet(dataPropios);
            XLSX.utils.book_append_sheet(workbook, worksheetPropios, 'Productos Propios');
        }

        

        // 3. Hojas por cada proveedor
        const productosPorProveedor = productosVendidos
            .filter(producto => producto.proveedor)
            .reduce((acc, producto) => {
                const proveedorNombre = producto.proveedor!.nombre;
                if (!acc[proveedorNombre]) {
                    acc[proveedorNombre] = [];
                }
                acc[proveedorNombre].push({
                    'Producto': producto.nombre,
                    'Vendidos': producto.cantidad,
                    'Costo': producto.costo,
                    'Total': producto.cantidad * producto.costo,
                    'Proveedor': proveedorNombre
                });
                return acc;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }, {} as Record<string, any[]>);

        // Crear una hoja por cada proveedor
        Object.entries(productosPorProveedor).forEach(([proveedorNombre, productos]) => {
            
            const productosProveedorTotal = productos.reduce((acc, producto) => acc + producto.Total, 0);
            const dataProveedor = [
                ...productos,
                {
                    'Producto': 'TOTAL',
                    'Vendidos': '',
                    'Costo': '',
                    'Total': productosProveedorTotal,
                    'Proveedor': ''
                }
            ];
            const worksheetProveedor = XLSX.utils.json_to_sheet(dataProveedor);
            // Limitar el nombre de la hoja a 31 caracteres (límite de Excel)
            const nombreHoja = proveedorNombre.length > 31
                ? proveedorNombre.substring(0, 28) + '...'
                : proveedorNombre;
            XLSX.utils.book_append_sheet(workbook, worksheetProveedor, nombreHoja);
        });

        // Generar y descargar el archivo
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
        const fechaFinStr = fechaFin ? fechaFin.toISOString().split('T')[0] : fechaInicioStr;
        const fileName = `Productos_Vendidos_${tiendaNombre.replace(/\s+/g, '_')}_${fechaInicioStr}_${fechaFinStr}.xlsx`;

        saveAs(blob, fileName);

        return true;
    } catch (error) {
        console.error('Error al generar el archivo Excel:', error);
        throw new Error('Error al generar el archivo Excel');
    }
};

// Función para exportar solo productos propios
export const exportProductosPropiosToExcel = async ({
    cierreData,
    tiendaNombre,
    fechaInicio,
    fechaFin
}: ExportProductosVendidosOptions) => {
    try {
        const workbook = XLSX.utils.book_new();

        const productosPropios = cierreData.productosVendidos
            .filter(producto => !producto.proveedor)
            .map(producto => ({
                'Producto': producto.nombre,
                'Vendidos': producto.cantidad,
                'Costo': producto.costo,
                'Total': producto.cantidad * producto.costo,
                'Proveedor': 'Propio'
            }));

        if (productosPropios.length === 0) {
            throw new Error('No hay productos propios para exportar');
        }

        const productosPropiosTotal = productosPropios.reduce((acc, producto) => acc + producto.Total, 0);
        const data = [
            ...productosPropios,
            {
                'Producto': 'TOTAL',
                'Vendidos': '',
                'Costo': '',
                'Total': productosPropiosTotal,
                'Proveedor': ''
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos Propios');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
        const fechaFinStr = fechaFin ? fechaFin.toISOString().split('T')[0] : fechaInicioStr;
        const fileName = `Productos_Propios_${tiendaNombre.replace(/\s+/g, '_')}_${fechaInicioStr}_${fechaFinStr}.xlsx`;

        saveAs(blob, fileName);

        return true;
    } catch (error) {
        console.error('Error al generar el archivo Excel de productos propios:', error);
        throw new Error('Error al generar el archivo Excel de productos propios');
    }
};

// Función para exportar productos de un proveedor específico
export const exportProductosProveedorToExcel = async ({
    cierreData,
    tiendaNombre,
    fechaInicio,
    fechaFin,
    proveedorId
}: ExportProductosVendidosOptions & { proveedorId: string }) => {
    try {
        const workbook = XLSX.utils.book_new();

        const productosProveedor = cierreData.productosVendidos
            .filter(producto => producto.proveedor?.id === proveedorId)
            .map(producto => ({
                'Producto': producto.nombre,
                'Vendidos': producto.cantidad,
                'Costo': producto.costo,
                'Total': producto.cantidad * producto.costo,
                'Proveedor': producto.proveedor!.nombre
            }));

        if (productosProveedor.length === 0) {
            throw new Error('No hay productos de este proveedor para exportar');
        }

        const productosProveedorTotal = productosProveedor.reduce((acc, producto) => acc + producto.Total, 0);
        const data = [
            ...productosProveedor,
            {
                'Producto': 'TOTAL',
                'Vendidos': '',
                'Costo': '',
                'Total': productosProveedorTotal,
                'Proveedor': ''
            }
        ];

        const proveedorNombre = productosProveedor[0].Proveedor;
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, proveedorNombre);

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
        const fechaFinStr = fechaFin ? fechaFin.toISOString().split('T')[0] : fechaInicioStr;
        const fileName = `Productos_${proveedorNombre.replace(/\s+/g, '_')}_${tiendaNombre.replace(/\s+/g, '_')}_${fechaInicioStr}_${fechaFinStr}.xlsx`;

        saveAs(blob, fileName);

        return true;
    } catch (error) {
        console.error('Error al generar el archivo Excel del proveedor:', error);
        throw new Error('Error al generar el archivo Excel del proveedor');
    }
}; 