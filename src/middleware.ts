// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (token) {
    // Almacena la info del usuario en headers para que los endpoints la lean
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', token.id);
    requestHeaders.set('x-user-rol', token.rol);
    requestHeaders.set('x-user-nombre', token.nombre);
    requestHeaders.set('x-user-usuario', token.usuario);
    requestHeaders.set('x-user-negocio', JSON.stringify(token.negocio));
    // requestHeaders.set('x-user-tiendaActual', JSON.stringify(token.tiendaActual));
    requestHeaders.set('x-user-localActual', JSON.stringify(token.localActual));
    // requestHeaders.set('x-user-tiendas', JSON.stringify(token.tiendas));
    requestHeaders.set('x-user-locales', JSON.stringify(token.locales));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'], // solo aplica el middleware a las rutas del API
}
