import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { landingContactFormSchema } from '@/schemas/referral';

export async function POST(request: NextRequest) {
  try {
    const body = landingContactFormSchema.parse(await request.json());

    const telefonoNormalizado =
      typeof body.telefono === 'string' && body.telefono.trim() ? body.telefono.replace(/\s/g, '') : '';
    const referidoNormalizado = body.referido?.trim().toUpperCase() || '';

    const payload = {
      nombre: body.nombre.trim(),
      nombreNegocio: body.nombreNegocio.trim(),
      correo: body.correo.trim(),
      telefono: telefonoNormalizado,
      numeroLocales: body.numeroLocales,
      mensaje: body.mensaje ?? '',
      referido: referidoNormalizado,
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
          referido: payload.referido,
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? 'Datos del formulario inválidos',
          success: false,
        },
        { status: 400 }
      );
    }

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
