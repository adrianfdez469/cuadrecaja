import { NextRequest, NextResponse } from 'next/server';

interface ContactFormData {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono: string;
  tipoNegocio: string;
  numeroLocales: string;
  mensaje?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    
    // Validar datos requeridos
    const { nombre, nombreNegocio, correo, telefono, tipoNegocio, numeroLocales } = body;
    
    if (!nombre || !nombreNegocio || !correo || !telefono || !tipoNegocio || !numeroLocales) {
      return NextResponse.json(
        { error: 'Todos los campos obligatorios deben ser completados' },
        { status: 400 }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      return NextResponse.json(
        { error: 'El formato del correo electrónico no es válido' },
        { status: 400 }
      );
    }

    // Validar teléfono (básico)
    if (telefono.length < 10) {
      return NextResponse.json(
        { error: 'El número de teléfono debe tener al menos 10 dígitos' },
        { status: 400 }
      );
    }

    // Aquí puedes agregar la lógica para:
    // 1. Guardar en base de datos
    // 2. Enviar email de notificación
    // 3. Integrar con CRM
    // 4. Enviar a webhook de n8n para automatización
    
    console.log('📧 Nueva solicitud de demo recibida:', {
      timestamp: new Date().toISOString(),
      nombre,
      nombreNegocio,
      correo,
      telefono,
      tipoNegocio,
      numeroLocales,
      mensaje: body.mensaje || 'Sin mensaje adicional'
    });

    // TODO: Implementar lógica de persistencia
    // Por ejemplo, guardar en Prisma:
    /*
    await prisma.contactForm.create({
      data: {
        nombre,
        nombreNegocio,
        correo,
        telefono,
        tipoNegocio,
        numeroLocales,
        mensaje: body.mensaje || '',
        fechaCreacion: new Date(),
        estado: 'PENDIENTE'
      }
    });
    */

    // TODO: Enviar email de notificación
    // Por ejemplo, usando un servicio de email como SendGrid, Resend, etc.
    /*
    await sendNotificationEmail({
      to: 'ventas@cuadrecaja.com',
      subject: `Nueva solicitud de demo - ${nombreNegocio}`,
      data: body
    });
    */

    // TODO: Enviar datos a n8n webhook para automatización
    /*
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        timestamp: new Date().toISOString(),
        source: 'landing-page'
      })
    });
    */

    return NextResponse.json(
      { 
        message: 'Solicitud enviada correctamente',
        success: true 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error procesando formulario de contacto:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor. Por favor, intenta nuevamente.',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Método OPTIONS para CORS si es necesario
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
