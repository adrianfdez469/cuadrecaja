import { NextRequest, NextResponse } from 'next/server';

interface ContactFormData {
  nombre: string;
  nombreNegocio?: string;
  correo: string;
  telefono: string;
  tipoNegocio?: string;
  numeroLocales?: string;
  mensaje?: string;
}

/** Normaliza el teléfono quitando espacios y valida: 7 dígitos o +53 seguido de 7 dígitos */
function validarTelefono(valor: string): { valido: boolean; normalizado: string } {
  const normalizado = valor.replace(/\s/g, '');
  const cumple = /^(\+53)?\d{7}$/.test(normalizado);
  return { valido: cumple, normalizado };
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();

    const { nombre, nombreNegocio, correo, telefono, tipoNegocio, numeroLocales } = body;

    if (!nombre?.trim() || !correo?.trim() || !telefono?.trim()) {
      return NextResponse.json(
        { error: 'Nombre, correo y teléfono son obligatorios' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo.trim())) {
      return NextResponse.json(
        { error: 'El formato del correo electrónico no es válido' },
        { status: 400 }
      );
    }

    const { valido: telefonoValido, normalizado: telefonoNormalizado } = validarTelefono(telefono);
    if (!telefonoValido) {
      return NextResponse.json(
        { error: 'El teléfono debe tener 7 dígitos, o +53 seguido de 7 dígitos' },
        { status: 400 }
      );
    }

    const payload = {
      nombre: nombre.trim(),
      nombreNegocio: nombreNegocio?.trim() ?? '',
      correo: correo.trim(),
      telefono: telefonoNormalizado,
      tipoNegocio: tipoNegocio ?? '',
      numeroLocales: numeroLocales ?? '',
      mensaje: body.mensaje ?? '',
      timestamp: new Date().toISOString(),
      source: 'landing-page',
    };

    console.log('📧 Nueva solicitud de demo recibida:', payload);

    const webhookUrl = process.env.N8N_CONTACT_FORM_WEBHOOK;
    const apiKey = process.env.N8N_CONTACT_FORM_API_KEY;

    if (webhookUrl && apiKey) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        const webhookResponse = await fetch(webhookUrl + apiKey, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!webhookResponse.ok) {
          console.error('❌ Webhook n8n contact-form respondió con error:', webhookResponse.status, await webhookResponse.text());
        }
      } catch (webhookError) {
        console.error('❌ Error al enviar al webhook n8n contact-form:', webhookError);
      }
    }

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
