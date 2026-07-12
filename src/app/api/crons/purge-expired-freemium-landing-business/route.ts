import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { LeadFuente } from '@prisma/client';
import EmailClient from "@/lib/send-emails/sendMailClient";
import { cancelReferralIfBusinessDeletedUnpaid } from "@/lib/referrals/cancelUnpaidReferral";
import { deleteNegocioCompleto } from "@/lib/negocio/deleteNegocioCompleto";
import { upsertLead } from "@/lib/leads/upsertLead";

type IAdministradorResumen = { nombre: string; correo: string };

type ICandidatoPurge = {
    id: string;
    nombre: string;
    administrador: IAdministradorResumen | null;
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_GRACIA_PURGE = 3;

const getBusinessExpired = async (date: Date) => {
    const rows = await prisma.negocio.findMany({
        where: {
            creadoPorActivacionLanding: true,
            planId: { not: null },
            plan: { precio: { lte: 0 } },
            limitTime: { lte: date },
        },
        select: {
            id: true,
            nombre: true,
            usuarios: {
                where: {
                    locales: {
                        some: {
                            rol: { nombre: 'Administrador' },
                        },
                    },
                },
                select: { nombre: true, usuario: true },
                orderBy: { usuario: 'asc' },
                take: 1,
            },
        },
        orderBy: { limitTime: 'asc' },
    });

    return rows;
};

/** Vencidos aún en ventana de gracia, sin aviso de purge enviado. */
const getBusinessPendingWarning = async (now: Date) => {
    const umbralPurge = new Date(now.getTime() - DIAS_GRACIA_PURGE * MS_POR_DIA);

    return prisma.negocio.findMany({
        where: {
            creadoPorActivacionLanding: true,
            planId: { not: null },
            plan: { precio: { lte: 0 } },
            avisoPurgeEnviadoAt: null,
            limitTime: {
                lte: now,
                gt: umbralPurge,
            },
        },
        select: {
            id: true,
            nombre: true,
            usuarios: {
                where: {
                    locales: {
                        some: {
                            rol: { nombre: 'Administrador' },
                        },
                    },
                },
                select: { nombre: true, usuario: true },
                orderBy: { usuario: 'asc' },
                take: 1,
            },
        },
        orderBy: { limitTime: 'asc' },
    });
};


export async function GET(request: NextRequest) {

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date();
    const emailClient = new EmailClient();

    // Día 0–2 (ventana de gracia): aviso una sola vez
    const pendingWarning = await getBusinessPendingWarning(now);

    for (const row of pendingWarning) {
        const u = row.usuarios[0];
        if (!u?.usuario) continue;

        try {
            await (await emailClient
                .buildAndSendEmailBody('expired-freemium-landing-business'))
                .buildExpiredFreemiumLandingBusinessTemplate({
                    bussinesName: row.nombre,
                    userName: u.nombre,
                    userEmail: u.usuario,
                });

            await prisma.negocio.update({
                where: { id: row.id },
                data: { avisoPurgeEnviadoAt: now },
            });
        } catch (error) {
            console.error(`❌ Aviso purge: error enviando correo para negocio ${row.id}:`, error);
        }
    }

    // Día ≥ 3: eliminar negocios freemium vencidos
    const expiredBussingesToremove = await getBusinessExpired(
        new Date(now.getTime() - DIAS_GRACIA_PURGE * MS_POR_DIA)
    );
    const admines: ICandidatoPurge[] = expiredBussingesToremove.map((r) => {
        const u = r.usuarios[0];
        return {
            id: r.id,
            nombre: r.nombre,
            administrador: u ? { nombre: u.nombre, correo: u.usuario } : null,
        };
    });

    const bussinesToEliminate = expiredBussingesToremove.map((b) => b.nombre);

    // Guardar leads antes de eliminar los negocios
    const leadsSaved: string[] = [];
    for (const n of admines) {
        if (!n.administrador?.correo) continue;
        try {
            await upsertLead({
                nombre: n.administrador.nombre,
                email: n.administrador.correo,
                fuente: LeadFuente.NEGOCIO_ELIMINADO,
                negocioNombre: n.nombre,
                metadata: {
                    negocioId: n.id,
                    motivo: 'TRIAL_EXPIRED_UNPAID_PURGE',
                },
            });
            leadsSaved.push(n.administrador.nombre);
        } catch (error) {
            console.error(`❌ Lead: error guardando lead para negocio ${n.id}:`, error);
        }
    }

    const bussinesNotEliminated: string[] = [];
    for (const business of expiredBussingesToremove) {
        try {
            await cancelReferralIfBusinessDeletedUnpaid({
                businessId: business.id,
                deletedAt: now,
                reason: 'TRIAL_EXPIRED_UNPAID_PURGE',
            });
        } catch (error) {
            console.error(`❌ Referral: error cancelando referral para negocio ${business.id}:`, error);
        }
        try {
            await deleteNegocioCompleto(business.id);
        } catch (error) {
            console.error(`❌ Negocio: error eliminando negocio ${business.id}:`, error);
            bussinesNotEliminated.push(business.nombre);
        }
    }

    if (bussinesToEliminate.length > 0) {
        try {
            await (await emailClient
                .buildAndSendEmailBody('delete-freemium-landing-business'))
                .buildDeleteFreemiumLandingBusinessTemplate({
                    bussinesToEliminate,
                    bussinesNotEliminated,
                    leadsSaved,
                });
        } catch (error) {
            console.error(error);
        }
    }

    return Response.json({ success: true });
}
