import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const authOptions = {
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
          },
        });

        if (!user) throw new Error("Usuario no encontrado");

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) throw new Error("Contraseña incorrecta");

        return { 
          id: user.id, 
          usuario: user.usuario, 
          nombre: user.nombre, 
          rol: user.rol, 
          tiendas: user.tiendas.map((ut) => ({
            id: ut.tienda.id,
            nombre: ut.tienda.nombre,
          }))
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.usuario = user.usuario;
        token.nombre = user.nombre;
        token.tiendas = user.tiendas;
        token.tiendaActual = user.tiendas.length === 1 ? user.tiendas[0] : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.rol = token.rol;
        session.user.usuario = token.usuario;
        session.user.nombre = token.nombre;
        session.user.tiendas = token.tiendas;
        session.user.tiendaActual = token.tiendaActual;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
