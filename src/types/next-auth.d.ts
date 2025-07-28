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
      // tiendas: ILocal[];
      // tiendaActual?: ILocal | null;
      locales: ILocal[];
      localActual?: ILocal | null;
      negocio: INegocio;
      expiresAt: string;
      permisos?: string; // Nueva propiedad para permisos del sistema nuevo
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    // tiendas: ILocal[];
    // tiendaActual?: ILocal | null;
    locales: ILocal[];
    localActual?: ILocal | null;
    negocio: INegocio;
    permisos?: string; // Nueva propiedad para permisos del sistema nuevo
    // expiresAt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    // tiendas: ILocal[];
    // tiendaActual?: ILocal | null;
    locales: ILocal[];
    localActual?: ILocal | null;
    negocio: INegocio;
    expCustom: string;
    permisos?: string; // Nueva propiedad para permisos del sistema nuevo
  }
}
