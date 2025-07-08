export interface IProveedorConsignacion {
    id: string;
    nombre: string;
    telefono: string;
    direccion: string;
    dineroLiquidado: number;
    dineroPorLiquidar: number;
    totalProductosConsignacion: number;
    ultimaLiquidacion: string | null;
    estado: 'activo' | 'inactivo';
}