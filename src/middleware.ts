// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { subscriptionMiddleware } from './middleware/subscriptionCheck'

export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;
    
    // Primero verificar autenticación y agregar headers de usuario
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (token) {
      // Almacena la info del usuario en headers para que los endpoints la lean
      const requestHeaders = new Headers(req.headers)
      
      // Codificar valores en Base64 para evitar problemas con caracteres no-ASCII
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encodeForHeader = (value: any): string => {
        if (value === null || value === undefined) return '';
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        return Buffer.from(stringValue, 'utf8').toString('base64');
      };
      
      if (token.id) requestHeaders.set('x-user-id', encodeForHeader(token.id));
      if (token.rol) requestHeaders.set('x-user-rol', encodeForHeader(token.rol));
      if (token.nombre) requestHeaders.set('x-user-nombre', encodeForHeader(token.nombre));
      if (token.usuario) requestHeaders.set('x-user-usuario', encodeForHeader(token.usuario));
      if (token.negocio) requestHeaders.set('x-user-negocio', encodeForHeader(token.negocio));
      if (token.localActual) requestHeaders.set('x-user-localActual', encodeForHeader(token.localActual));
      if (token.locales) requestHeaders.set('x-user-locales', encodeForHeader(token.locales));
      if (token.permisos) requestHeaders.set('x-user-permisos', encodeForHeader(token.permisos));

      // Crear una nueva request con los headers actualizados
      const requestWithHeaders = new NextRequest(req.url, {
        ...req,
        headers: requestHeaders,
      });

      // Ahora verificar el estado de suscripción para rutas de páginas (no APIs)
      if (!pathname.startsWith('/api/')) {
        return await subscriptionMiddleware(requestWithHeaders);
      }

      // Para APIs, solo pasar los headers
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // Si no hay token, verificar si es una ruta que requiere verificación de suscripción
    if (!pathname.startsWith('/api/')) {
      return await subscriptionMiddleware(req);
    }

    return NextResponse.next()
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error crítico en middleware:', error);
    // En caso de error crítico, permitir que la petición continúe sin headers de usuario
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    // Incluir todas las rutas excepto: _next, static assets, login, subscription-expired
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|login|subscription-expired).*)',
  ],
}
