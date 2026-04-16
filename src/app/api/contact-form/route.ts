import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const MAX_LOCALES_CONTACT = 19;

interface ContactFormData {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono?: string;
  numeroLocales: number;
  mensaje?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();

    const { nombre, nombreNegocio, correo, telefono, numeroLocales } = body;

    if (!nombre?.trim() || !nombreNegocio?.trim() || !correo?.trim()) {
      return NextResponse.json(
        { error: 'Nombre, nombre del negocio y correo son obligatorios' },
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

    const nLocales = Number(numeroLocales);
    if (
      !Number.isFinite(nLocales) ||
      !Number.isInteger(nLocales) ||
      nLocales < 1 ||
      nLocales > MAX_LOCALES_CONTACT
    ) {
      return NextResponse.json(
        { error: `El número de locales debe ser un entero entre 1 y ${MAX_LOCALES_CONTACT}` },
        { status: 400 }
      );
    }

    const telefonoNormalizado =
      typeof telefono === 'string' && telefono.trim() ? telefono.replace(/\s/g, '') : '';

    const payload = {
      nombre: nombre.trim(),
      nombreNegocio: nombreNegocio.trim(),
      correo: correo.trim(),
      telefono: telefonoNormalizado,
      numeroLocales: nLocales,
      mensaje: body.mensaje ?? '',
      timestamp: new Date().toISOString(),
      source: 'landing-page',
    };


    const activationSecret = process.env.ACTIVATION_JWT_SECRET;
    let activationToken: string | null = null;
    let activationUrl: string | null = null;

    if (activationSecret) {
      activationToken = jwt.sign(
        {
          nombre: payload.nombre,
          nombreNegocio: payload.nombreNegocio,
          correo: payload.correo,
          telefono: payload.telefono,
          numeroLocales: payload.numeroLocales,
        },
        activationSecret,
        { expiresIn: '30m' }
      );
      const appUrl = [
        request.nextUrl.origin,
        process.env.NEXTAUTH_URL,
      ]
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.replace(/\/$/, ''))[0] ?? 'http://localhost:3000';
      activationUrl = `${appUrl}/activar?token=${activationToken}`;
      console.log('🔗 URL de activación:', activationUrl);
    } else {
      console.warn('⚠️ ACTIVATION_JWT_SECRET no configurado, no se generará token de activación');
    }

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
          body: JSON.stringify({ ...payload, token: activationToken, activationUrl }),
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
