import { IUser } from "./IUser";
import { IRol } from "./IRol";

export enum TipoLocal {
  TIENDA = "TIENDA",
  ALMACEN = "ALMACEN"
}

export interface IUsuarioTienda {
  id: string;
  usuarioId: string;
  tiendaId: string;
  rolId?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  usuario: IUser;
  rol?: IRol;
}

export interface ILocal {
  id: string;
  nombre: string;
  negocioId: string;
  tipo: string;

  usuarios?: IUser[];
  usuariosTiendas?: IUsuarioTienda[];
}