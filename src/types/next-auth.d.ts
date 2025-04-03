import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      nombre: string;
      rol: string;
      tiendas: { id: string; nombre: string }[];
      tiendaActual?: { id: string; nombre: string } | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    tiendas: { id: string; nombre: string }[];
    tiendaActual?: { id: string; nombre: string } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    nombre: string;
    rol: string;
    tiendas: { id: string; nombre: string }[];
    tiendaActual?: { id: string; nombre: string } | null;
  }
}
