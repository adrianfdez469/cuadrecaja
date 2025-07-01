import { IUser } from "./IUser";

export enum TipoLocal {
  TIENDA = "TIENDA",
  ALMACEN = "ALMACEN"
}

export interface ILocal {
  id: string;
  nombre: string;
  negocioId: string;
  tipo: string;

  usuarios?: IUser[];

}