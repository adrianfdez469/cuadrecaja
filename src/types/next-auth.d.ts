import { DefaultSession } from "next-auth";
import { INegocio } from "./INegocio";
import { ILocal } from "./ILocal";


declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      nombre: string;
      rol: string;
      tiendas: ILocal[];
      tiendaActual?: ILocal | null;
      negocio: INegocio;
      expiresAt: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    tiendas: ILocal[];
    tiendaActual?: ILocal | null;
    negocio: INegocio;
    // expiresAt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    tiendas: ILocal[];
    tiendaActual?: ILocal | null;
    negocio: INegocio;
    expCustom: string;
  }
}
