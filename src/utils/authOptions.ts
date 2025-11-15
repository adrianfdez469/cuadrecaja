import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { JWT } from "next-auth/jwt";
import dayjs from 'dayjs';
import { getPermisosUsuario } from "./getPermisosUsuario";
import { getRolUsuario } from "./getRolUsuario";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        usuario: { label: "Usuario", type: "text" },
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

        // ⚠️ VERIFICAR ESTADO DE SUSCRIPCIÓN - Bloquear login si está suspendido (excepto SUPER_ADMIN)
        if (user.rol !== "SUPER_ADMIN") {
          const now = new Date();
          const limitTime = new Date(user.negocio.limitTime);
          const diffTime = limitTime.getTime() - now.getTime();
          const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isExpired = daysRemaining <= 0;
          const gracePeriodDays = 7;
          const isInGracePeriod = daysRemaining > -gracePeriodDays;
          
          // Consultar si el negocio está marcado como suspendido manualmente
          const negocioCompleto = await prisma.negocio.findUnique({
            where: { id: user.negocio.id },
            select: { suspended: true }
          });
          
          const isSuspended = negocioCompleto?.suspended || (isExpired && !isInGracePeriod);
          
          if (isSuspended) {
            // Error específico para suscripción expirada (será detectado en el frontend)
            throw new Error("SUBSCRIPTION_EXPIRED");
          }
        }

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

        // ⚠️ VALIDACIÓN: Usuario debe tener locales asignados (excepto SUPER_ADMIN)
        if (user.rol !== "SUPER_ADMIN") {
          // Verificar si tiene locales asignados
          if (localesDisponibles.length === 0) {
            throw new Error("USUARIO_SIN_CONFIGURAR: No tienes locales (tiendas o almacenes) asignados. Contacta al administrador para completar tu configuración.");
          }

          // Verificar si tiene al menos un rol asignado en algún local
          const tieneRolAsignado = await prisma.usuarioTienda.findFirst({
            where: {
              usuarioId: user.id,
              rolId: { not: null } // Tiene un rol asignado
            },
            select: { id: true }
          });

          if (!tieneRolAsignado) {
            throw new Error("USUARIO_SIN_CONFIGURAR: No tienes un rol asignado en ningún local. Contacta al administrador para completar tu configuración.");
          }
        }

        // Obtener permisos basados en la tienda actual
        const permisos = await getPermisosUsuario(user.id, user.localActual?.id || null);

        let rol = "";

        if (user.rol === "SUPER_ADMIN") {
          rol = "SUPER_ADMIN";
        } else {
          rol = await getRolUsuario(user.id, user.localActual?.id || null)
        }

        return {
          id: user.id,
          usuario: user.usuario,
          nombre: user.nombre,
          negocio: user.negocio,
          rol: rol,
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
      if (user) {

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

          // ✅ PRESERVAR ROL SUPER_ADMIN - Solo actualizar rol si no es SUPER_ADMIN
          if (token.rol !== "SUPER_ADMIN") {
            const nuevoRol = await getRolUsuario(token.id as string, session.localActual.id);
            token.rol = nuevoRol;
          }
          // Si es SUPER_ADMIN, mantener el rol original sin cambios
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