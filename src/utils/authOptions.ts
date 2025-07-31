import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { JWT } from "next-auth/jwt";
import dayjs from 'dayjs';
import { getPermisosUsuario } from "./getPermisosUsuario";

export const authOptions:NextAuthOptions  = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        usuario: {label: "Usuario", type: "text"}, 
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.usuario || !credentials?.password) {
          throw new Error("Debe ingresar usuario y contraseña");
        }

        const user = await prisma.usuario.findUnique({
          where: { usuario: credentials.usuario },
          include: {
            locales: {
              include: { tienda: true },
            },
            // tiendaActual: true,
            localActual: true,
            negocio: {
              select: { id: true, nombre: true, userlimit: true, limitTime: true, locallimit: true, productlimit: true }
            }
          },
        });

        if (!user) throw new Error("Usuario no encontrado");

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) throw new Error("Contraseña incorrecta");

        // Para usuarios SUPER_ADMIN, obtener todas las tiendas del negocio
        // Para otros usuarios, solo las tiendas asociadas
        let localesDisponibles;
        if (user.rol === "SUPER_ADMIN") {
          const todasLasTiendas = await prisma.tienda.findMany({
            where: { negocioId: user.negocio.id },
            select: {
              id: true,
              nombre: true,
              negocioId: true,
              tipo: true
            }
          });
          localesDisponibles = todasLasTiendas;
        } else {
          localesDisponibles = user.locales.map((t) => ({
            id: t.tienda.id,
            nombre: t.tienda.nombre,
            negocioId: t.tienda.negocioId,
            tipo: t.tienda.tipo
          }));
        }

        // Obtener permisos basados en la tienda actual
        const permisos = await getPermisosUsuario(user.id, user.localActual?.id || null);

        return {
          id: user.id,
          usuario: user.usuario,
          nombre: user.nombre,
          negocio: user.negocio,
          rol: user.rol,
          // tiendas: tiendasDisponibles,
          locales: localesDisponibles,
          // tiendaActual: user.tiendaActual
          localActual: user.localActual,
          permisos: permisos
        };
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // válido
      if(user) {

        if (!token.expCustom) {
          const tomorrowAt6AM = dayjs().add(1, 'day').set('hour', 6).set('minute', 0).set('second', 0);
          token.expCustom = tomorrowAt6AM.toISOString(); // timestamp en milisegundos
        }

        if (token.expCustom && dayjs().isBefore(new Date(token.expCustom))) {
          token.id = user.id;
          token.rol = user.rol;
          token.usuario = user.usuario;
          token.nombre = user.nombre;
          token.negocio = user.negocio;
          // token.tiendaActual = user.tiendaActual;
          // token.tiendas = user.tiendas;
          token.localActual = user.localActual;
          token.locales = user.locales;
          token.permisos = user.permisos;
          
        } else {
          token.id = null;
            token.rol = null;
            token.usuario = null;
            token.nombre = null;
            token.negocio = null;
            token.negocio = null;
            // token.tiendaActual = null;
            // token.tiendas = null;
            token.localActual = null;
            token.locales = null;
            token.permisos = null;
            return token;
        }
      }

      // Cuando se actualiza desde session.update()
      // if (trigger === "update" && session?.tiendaActual) {
      //   token.tiendaActual = session.tiendaActual;
      // }
      if (trigger === "update" && session?.localActual) {
        token.localActual = session.localActual;
        
        // Actualizar permisos cuando cambia la tienda actual
        if (token.id && session.localActual?.id) {
          const nuevosPermisos = await getPermisosUsuario(token.id as string, session.localActual.id);
          token.permisos = nuevosPermisos;
        }
      }
      if (trigger === "update" && session?.negocio) {
        console.log('cambiando negocio');
        
        token.negocio = session.negocio;
        // token.tiendaActual = null;
        token.localActual = null;
        token.permisos = ""; // Limpiar permisos al cambiar de negocio

      }

      return token;

    },
    async session({ session, token }) {
      const userToken = token as JWT; // ✅ Forzamos el tipo JWT
      if (session.user) {
        session.user.id = userToken.id;
        session.user.rol = token.rol;
        session.user.usuario = token.usuario;
        session.user.nombre = token.nombre;
        session.user.negocio = token.negocio;
        // session.user.tiendas = token.tiendas;
        // session.user.tiendaActual = token.tiendaActual;
        session.user.locales = token.locales;
        session.user.localActual = token.localActual;
        session.user.expiresAt = token.expCustom; // puedes usar esto en el frontend
        session.user.permisos = token.permisos; // Agregar permisos a la sesión
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};