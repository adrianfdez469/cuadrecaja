export interface ITransferDestination {
    id: string;
    nombre: string;
    descripcion: string | null;
    default: boolean;
    tiendaId: string;
}