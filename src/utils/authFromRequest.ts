import { NextRequest } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from './authOptions';
import { jwtVerify } from 'jose';

/**
 * Obtiene la sesión del usuario desde cookies (web) o desde headers (Flutter/mobile)
 * 
 * Para aplicaciones web: Usa cookies de NextAuth
 * Para aplicaciones móviles: Usa el token JWT en el header Authorization
 * 
 * @param request - Request de Next.js
 * @returns Session object o null
 */
export async function getSessionFromRequest(request: NextRequest): Promise<Session | null> {
  try {
    // 1. Intentar obtener sesión desde cookies (para web)
    const cookieSession = await getServerSession(authOptions);
    if (cookieSession) {
      return cookieSession;
    }

    // 2. Si no hay sesión por cookies, intentar obtener token JWT desde headers (para Flutter)
    const authHeader = request.headers.get("authorization");
    console.log("🔍 [AUTH] Authorization header:", authHeader ? `Bearer ${authHeader.substring(7, 27)}...` : 'No presente');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] No se encontró token en header Authorization');
      return null;
    }

    // Extraer el token del header "Bearer <token>"
    const tokenString = authHeader.substring(7);
    
    if (!tokenString || !process.env.NEXTAUTH_SECRET) {
      console.log('❌ [AUTH] Token vacío o NEXTAUTH_SECRET no configurado');
      return null;
    }

    // Verificar y decodificar el token JWT usando jose
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(tokenString, secret);
    
    console.log('✅ [AUTH] Token JWT verificado y decodificado');
    console.log('📋 [AUTH] Usuario:', payload.usuario, '| Rol:', payload.rol);

    // 3. Construir objeto de sesión desde el payload del token JWT
    return {
      user: {
        id: payload.id as string,
        usuario: payload.usuario as string,
        nombre: payload.nombre as string,
        rol: payload.rol as string,
        negocio: payload.negocio as any,
        localActual: payload.localActual as any,
        locales: payload.locales as any[],
        permisos: typeof payload.permisos === 'string' ? payload.permisos : JSON.stringify(payload.permisos || []),
        expiresAt: payload.expCustom as string || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      expires: payload.exp ? new Date((payload.exp as number) * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error('❌ [AUTH] Error al obtener sesión desde request:', error);
    return null;
  }
}

/**
 * Extrae el token JWT del header Authorization
 * 
 * @param request - Request de Next.js
 * @returns Token string o null
 */
export function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }

  // Formato esperado: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verifica si el usuario está autenticado
 * 
 * @param request - Request de Next.js
 * @returns true si está autenticado, false si no
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const session = await getSessionFromRequest(request);
  return session !== null;
}

/**
 * Obtiene el usuario desde el request o lanza error si no está autenticado
 * 
 * @param request - Request de Next.js
 * @returns User object
 * @throws Error si no está autenticado
 */
export async function requireAuth(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  
  if (!session || !session.user) {
    throw new Error('UNAUTHORIZED');
  }

  return session.user;
}

