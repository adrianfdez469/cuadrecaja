import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/utils/authOptions';

export async function POST(request: NextRequest) {
  try {
    // Obtener la sesión del usuario
    const session = await getServerSession(authOptions);
    
    // Extraer el mensaje y sessionId del cuerpo de la petición
    const body = await request.json();
    const { message, sessionId: frontendSessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Mensaje requerido' },
        { status: 400 }
      );
    }

    // Determinar el sessionId a usar
    let finalSessionId: string;
    
    if (session?.user?.id) {
      // Usuario autenticado: usar su ID
      finalSessionId = `user_${session.user.id}`;
    } else if (frontendSessionId) {
      // Usuario anónimo con sessionId del frontend
      finalSessionId = frontendSessionId;
    } else {
      // Fallback: generar sessionId temporal
      finalSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Configuración de N8N
    const N8N_WEBHOOK_URL = process.env.N8N_CHATBOT_WEBHOOK;
    const N8N_API_KEY = process.env.N8N_API_KEY;

    if (!N8N_WEBHOOK_URL) {
      console.error('N8N_CHATBOT_WEBHOOK no está configurado');
      return NextResponse.json(
        { error: 'Servicio de chatbot no disponible' },
        { status: 503 }
      );
    }

    // Preparar los datos para enviar a N8N
    const n8nPayload = {
      message: message,
      timestamp: new Date().toISOString(),
      source: 'landing-page-chatbot',
      sessionId: finalSessionId,
      userInfo: session ? {
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name,
        userRole: session.user.rol,
        isAuthenticated: true
      } : {
        isAuthenticated: false,
        anonymousSessionId: finalSessionId
      }
    };

    // Realizar la petición a N8N
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY && { 'x-api-key': N8N_API_KEY }),
      },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      throw new Error(`N8N respondió con status: ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json();
    
    // Extraer la respuesta del bot
    const botResponse = n8nData.output || n8nData.message || n8nData.response;

    if (!botResponse) {
      throw new Error('Respuesta inválida de N8N');
    }

    // Responder al frontend
    return NextResponse.json({
      success: true,
      response: botResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en chatbot API:', error);

    // Extraer el mensaje para respuestas de fallback
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }
    
    const message = requestBody?.message?.toLowerCase() || '';
    
    let fallbackResponse = 'Gracias por tu pregunta. Te recomiendo completar el formulario de contacto para que uno de nuestros especialistas pueda darte información más detallada. 😊';

    if (message.includes('precio') || message.includes('costo') || message.includes('cuánto')) {
      fallbackResponse = 'Nuestros planes empiezan desde $89,000/mes. Tenemos planes Básico, Profesional y Empresarial. ¿Te gustaría que te envíe más detalles por email?';
    } else if (message.includes('internet') || message.includes('offline') || message.includes('conexión')) {
      fallbackResponse = '¡Sí! Una de nuestras características principales es el funcionamiento offline. Puedes seguir vendiendo sin conexión a internet y todo se sincroniza automáticamente cuando vuelve la conexión.';
    } else if (message.includes('demo') || message.includes('prueba') || message.includes('gratis')) {
      fallbackResponse = 'Ofrecemos una demo personalizada de 30 minutos completamente gratis. También incluye 15 días de prueba sin costo. ¿Te gustaría programar una demo?';
    } else if (message.includes('tienda') || message.includes('local') || message.includes('multi')) {
      fallbackResponse = 'Sí, nuestro sistema está diseñado para manejar múltiples tiendas desde una sola plataforma. Puedes controlar inventarios independientes y hacer traspasos automáticos entre locales.';
    } else if (message.includes('capacitación') || message.includes('entrenamiento') || message.includes('aprender')) {
      fallbackResponse = 'Incluimos capacitación completa para tu equipo sin costo adicional. También tenemos soporte técnico 24/7 y documentación detallada.';
    }

    return NextResponse.json({
      success: true,
      response: fallbackResponse,
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
}
