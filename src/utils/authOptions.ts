import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { JWT } from "next-auth/jwt";
import dayjs from 'dayjs';

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
            tiendas: {
              include: { tienda: true },
            },
            tiendaActual: true,
            negocio: {
              select: { id: true, nombre: true, userlimit: true, limitTime: true, locallimit: true }
            }
          },
        });

        if (!user) throw new Error("Usuario no encontrado");

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) throw new Error("Contraseña incorrecta");

        return {
          id: user.id,
          usuario: user.usuario,
          nombre: user.nombre,
          negocio: user.negocio,
          rol: user.rol,
          tiendas: user.tiendas.map((t) => ({
            id: t.tienda.id,
            nombre: t.tienda.nombre,
            negocioId: t.tienda.negocioId,
            tipo: t.tienda.tipo
          })),
          tiendaActual: user.tiendaActual

        };
      },
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
          token.tiendaActual = user.tiendaActual;
          token.tiendas = user.tiendas;
          
        } else {
          token.id = null;
            token.rol = null;
            token.usuario = null;
            token.nombre = null;
            token.negocio = null;
            token.tiendaActual = null;
            token.negocio = null;
            token.tiendas = null;
            return token;
        }
      }

      // Cuando se actualiza desde session.update()
      if (trigger === "update" && session?.tiendaActual) {
        token.tiendaActual = session.tiendaActual;
      }
      if (trigger === "update" && session?.negocio) {
        console.log('cambiando negocio');
        
        token.negocio = session.negocio;
        token.tiendaActual = null;
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
        session.user.tiendas = token.tiendas;
        session.user.negocio = token.negocio;
        session.user.tiendaActual = token.tiendaActual;
        session.user.expiresAt = token.expCustom; // puedes usar esto en el frontend
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};