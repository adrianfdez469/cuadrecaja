import { NextRequest, NextResponse } from 'next/server';

// Rutas que requieren verificación de suscripción
const PROTECTED_ROUTES = [
  '/home',
  '/dashboard',
  '/dashboard-resumen',
  '/pos',
  '/ventas',
  '/inventario',
  '/movimientos',
  '/cierre',
  '/resumen_cierre',
  '/conformar_precios',
  '/cpp-analysis',
  '/proveedores',
  '/configuracion'
];

// Rutas que NO requieren verificación (siempre permitidas)
const ALLOWED_ROUTES = [
  '/login',
  '/',
  '/subscription-expired',
  '/descargar',
  '/api/auth',
  '/api/subscription/status',
  '/api/notificaciones/activas',
  '/api/notificaciones/marcar-leida'
];

export async function subscriptionMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verificar si es una ruta protegida
  const isProtectedRoute = PROTECTED_ROUTES.some(route =>
    pathname.startsWith(route)
  );

  // Verificar si es una ruta permitida
  // Para la raíz '/', hacemos match exacto. Para las demás, usamos startsWith
  const isAllowedRoute = ALLOWED_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/'; // Match exacto para la raíz
    }
    return pathname.startsWith(route);
  });

  // Si no es una ruta protegida o es una ruta permitida, continuar
  if (!isProtectedRoute || isAllowedRoute) {
    return NextResponse.next();
  }

  try {
    // Obtener información del negocio y rol del usuario
    const { negocioId, userRole } = await getNegocioIdFromRequest(request);

    // ⚠️ NOTA: La verificación principal de suspensión se hace en el LOGIN (authOptions.ts)
    // Aquí solo verificamos que los usuarios no-SUPER_ADMIN tengan autenticación válida
    // Si el negocio se suspende después del login, se bloqueará en el próximo login

    // Si no hay negocio, no permitir acceso (excepto para rutas sin autenticación)
    if (!negocioId && !userRole) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Si es SUPER_ADMIN o usuario autenticado, permitir acceso
    return NextResponse.next();

  } catch (error) {
    console.error('❌ [SUBSCRIPTION CHECK] Error en middleware de suscripción:', error);
    // En caso de error, redirigir a login por seguridad
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Función auxiliar para obtener el negocioId del request
async function getNegocioIdFromRequest(request: NextRequest): Promise<{ negocioId: string | null, userRole: string | null }> {
  try {
    // Intentar obtener la información del negocio desde los headers (establecidos por el middleware principal)
    const negocioHeader = request.headers.get('x-user-negocio');
    const rolHeader = request.headers.get('x-user-rol');

    if (negocioHeader && rolHeader) {
      try {
        // Decodificar desde Base64
        const negocioData = JSON.parse(Buffer.from(negocioHeader, 'base64').toString('utf8'));
        const userRole = Buffer.from(rolHeader, 'base64').toString('utf8');

        return {
          negocioId: negocioData?.id || null,
          userRole
        };
      } catch (decodeError) {
        console.error('Error al decodificar headers de usuario:', decodeError);
      }
    }

    // Si no hay headers, intentar obtener desde el token directamente
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (token?.negocio && token?.rol) {
      return {
        negocioId: typeof token.negocio === 'object' ? token.negocio.id : token.negocio,
        userRole: token.rol as string
      };
    }

    return { negocioId: null, userRole: null };

  } catch (error) {
    console.error('Error al obtener negocioId del request:', error);
    return { negocioId: null, userRole: null };
  }
}
