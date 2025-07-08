import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getUserFromRequest from '@/utils/getUserFromRequest';


export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const nombre = searchParams.get('nombre');

        const whereClause: { negocioId: string, nombre?: { contains: string, mode: 'insensitive' } } = {
            negocioId: user.negocio.id,
        };

        if (nombre) {
            whereClause.nombre = {
                contains: nombre,
                mode: 'insensitive',
            };
        }
        const proveedores = await prisma.proveedor.findMany({
            where: whereClause,
            include: {
                prodProveedorConsignadorLiquidacionCierre: {
                    include: {
                        cierre: true,
                        producto: true,
                    }
                },
            }
        });

        return NextResponse.json(proveedores);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}