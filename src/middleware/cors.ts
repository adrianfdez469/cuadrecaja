import { NextRequest, NextResponse } from 'next/server';

/**
 * Configuración de CORS para permitir peticiones desde la app móvil y otros orígenes
 */

// Lista de orígenes permitidos
const ALLOWED_ORIGINS = [
  'http://localhost:3000',      // Desarrollo local web
  'http://localhost:8080',      // Desarrollo Flutter (web)
  'http://localhost:5173',      // Vite dev server
  'capacitor://localhost',      // Capacitor iOS
  'ionic://localhost',          // Ionic
  'http://localhost',           // Flutter mobile emulador
  'https://tu-dominio.com',     // Producción web
  // Agregar más orígenes según necesites
];

// Para desarrollo, puedes permitir todos los orígenes
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Aplica headers CORS a una respuesta
 */
export function corsHeaders(origin: string | null = '*') {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-api-key',
    'Access-Control-Max-Age': '86400', // 24 horas
    'Access-Control-Allow-Credentials': 'true',
  };

  // En desarrollo, permitir todos los orígenes
  if (isDevelopment) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  } else {
    // En producción, solo permitir orígenes específicos
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else {
      // Si el origen no está permitido, no agregar el header
      // El navegador bloqueará la petición
    }
  }

  return headers;
}

/**
 * Middleware para manejar peticiones OPTIONS (preflight)
 */
export function handleCorsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Manejar preflight request (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  return null; // Continuar con la petición normal
}

/**
 * Agregar headers CORS a una respuesta existente
 */
export function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const headers = corsHeaders(origin);
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}


