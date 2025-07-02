// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  try {
    // Verificar que NEXTAUTH_SECRET esté disponible
    if (!process.env.NEXTAUTH_SECRET) {
      console.error('❌ [MIDDLEWARE] NEXTAUTH_SECRET no está definido en las variables de entorno');
      return NextResponse.json({ error: 'Configuración de autenticación faltante' }, { status: 500 });
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (token) {
      // Almacena la info del usuario en headers para que los endpoints la lean
      const requestHeaders = new Headers(req.headers)
      
      // Agregar headers básicos de forma segura
      if (token.id) requestHeaders.set('x-user-id', String(token.id));
      if (token.rol) requestHeaders.set('x-user-rol', String(token.rol));
      if (token.nombre) requestHeaders.set('x-user-nombre', String(token.nombre));
      if (token.usuario) requestHeaders.set('x-user-usuario', String(token.usuario));
      
      // Serializar objetos de forma segura
      if (token.negocio) {
        try {
          requestHeaders.set('x-user-negocio', JSON.stringify(token.negocio));
        } catch (error) {
          console.error('❌ [MIDDLEWARE] Error al serializar negocio:', error);
          requestHeaders.set('x-user-negocio', '{}');
        }
      }
      
      if (token.localActual) {
        try {
          requestHeaders.set('x-user-localActual', JSON.stringify(token.localActual));
        } catch (error) {
          console.error('❌ [MIDDLEWARE] Error al serializar localActual:', error);
          requestHeaders.set('x-user-localActual', '{}');
        }
      }
      
      if (token.locales) {
        try {
          requestHeaders.set('x-user-locales', JSON.stringify(token.locales));
        } catch (error) {
          console.error('❌ [MIDDLEWARE] Error al serializar locales:', error);
          requestHeaders.set('x-user-locales', '[]');
        }
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    return NextResponse.next()
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error crítico en middleware:', error);
    
    // En caso de error crítico, permitir que la petición continúe sin headers de usuario
    // Esto evita que se rompa toda la aplicación
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/:path*'], // solo aplica el middleware a las rutas del API
}
