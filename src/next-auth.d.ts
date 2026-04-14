import { DefaultSession } from "next-auth";
import type { INegocio } from "@/schemas/negocio";
import type { ILocal } from "@/schemas/tienda";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      nombre: string;
      rol: string;
      locales: ILocal[];
      localActual?: ILocal | null;
      negocio: INegocio;
      expiresAt: string;
      permisos?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    locales: ILocal[];
    localActual?: ILocal | null;
    negocio: INegocio;
    permisos?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    locales: ILocal[];
    localActual?: ILocal | null;
    negocio: INegocio;
    expCustom: string;
    permisos?: string;
  }
}
