import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar que sea SUPER_ADMIN
    if (token.rol !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para generar backups' },
        { status: 403 }
      );
    }

    // Obtener las variables de entorno
    const backupUrl = process.env.CALL_GENERATE_BACKUP_URL;
    const backupSecret = process.env.CALL_GENERATE_BACKUP_SECRET;

    if (!backupUrl || !backupSecret) {
      console.error('Variables de entorno de backup no configuradas');
      return NextResponse.json(
        { error: 'Configuración de backup no disponible' },
        { status: 500 }
      );
    }

    // Hacer la petición al servicio de backup
    const response = await fetch(backupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': backupSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en servicio de backup:', response.status, errorText);
      return NextResponse.json(
        { error: `Error al generar backup: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Backup generado exitosamente',
      data
    });

  } catch (error) {
    console.error('Error al generar backup:', error);
    return NextResponse.json(
      { error: 'Error interno al generar backup' },
      { status: 500 }
    );
  }
}

