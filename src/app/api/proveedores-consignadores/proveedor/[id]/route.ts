import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';


export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        const user = session.user;
        const { id } = await params;

        if (!user) {
            return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Debe pasar el id del proveedor' }, { status: 404 })
        }

        const proveedor = await prisma.proveedor.findUnique({
            where: {
                id
            },
            include: {
                prodProveedorLiquidacion: {
                    include: {
                        cierre: true,
                        producto: {
                            include: {
                                categoria: true
                            }
                        },
                    }
                },
            }
        });

        return NextResponse.json(proveedor);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}