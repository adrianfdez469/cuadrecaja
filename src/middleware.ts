import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" }, // Redirige al login si no está autenticado
  callbacks: {
    authorized: ({ token }) => !!token, // Solo permite acceso si el usuario está autenticado
  },
});

export const config = {
  matcher: [
    "/api/categorias/:path*",
    "/api/productos/:path*",
    "/api/tiendas/:path*",

    "/dashboard/:path*" // Solo protege rutas dentro de `/dashboard`
  ],
};
