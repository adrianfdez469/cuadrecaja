import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionService } from '@/services/subscriptionService';

// Rutas que requieren verificación de suscripción
const PROTECTED_ROUTES = [
  '/dashboard',
  '/pos',
  '/ventas',
  '/inventario',
  '/movimientos',
  '/cierre',
  '/configuracion'
];

// Rutas que NO requieren verificación (siempre permitidas)
const ALLOWED_ROUTES = [
  '/login',
  '/landing',
  '/subscription-expired',
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
  const isAllowedRoute = ALLOWED_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  
  // Si no es una ruta protegida o es una ruta permitida, continuar
  if (!isProtectedRoute || isAllowedRoute) {
    return NextResponse.next();
  }
  
  try {
    // Obtener información del negocio y rol del usuario
    const { negocioId, userRole } = await getNegocioIdFromRequest(request);
    
    // Si no hay negocio o es SUPER_ADMIN, permitir acceso
    if (!negocioId || userRole === 'SUPER_ADMIN') {
      return NextResponse.next();
    }
    
    // Verificar estado de suscripción del negocio
    const status = await SubscriptionService.getSubscriptionStatus(negocioId);
    
    // Verificar si el negocio está marcado como suspendido en la BD
    const { prisma } = await import('@/lib/prisma');
    const negocio = await prisma.negocio.findUnique({
      where: { id: negocioId },
      select: { suspended: true }
    });
    
    // Si el negocio está marcado como suspendido, redirigir
    if (negocio?.suspended) {
      return NextResponse.redirect(new URL('/subscription-expired', request.url));
    }
    
    // Si está suspendido por tiempo (fuera del período de gracia), redirigir
    if (status.isSuspended) {
      return NextResponse.redirect(new URL('/subscription-expired', request.url));
    }
    
    // Si está en período de gracia, mostrar advertencia pero permitir acceso
    if (status.isExpired && !status.isSuspended) {
      // Agregar header para indicar período de gracia
      const response = NextResponse.next();
      response.headers.set('X-Subscription-Grace-Period', 'true');
      response.headers.set('X-Subscription-Days-Expired', status.daysRemaining.toString());
      return response;
    }
    
    // Si está activo, continuar normalmente
    return NextResponse.next();
    
  } catch (error) {
    console.error('Error en middleware de suscripción:', error);
    // En caso de error, permitir el acceso (fail-safe)
    return NextResponse.next();
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
