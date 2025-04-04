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
    "/api/productos_tienda/:path*",
    "/api/tiendas/:path*",
    "/api/cierre/:path*",
    "/api/usuarios/:path*",
    "/api/venta/:path*",
    "/((?!api/init-superadmin).*)", // Excluye esta ruta del middleware
  ],
};
