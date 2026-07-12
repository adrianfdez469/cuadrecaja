import { escapeHtml } from '@/lib/send-emails/escapeHtml';

export type TemplateType = 'expired-freemium-landing-business' | 'delete-freemium-landing-business';

export interface EmailTemplateBaseData {
    bussinesName: string;
    userName: string;
    userEmail: string;
}
export interface DeleteFreemiumLandingBusinessTemplateData {
    bussinesToEliminate: string[];
    bussinesNotEliminated: string[];
    leadsSaved: string[];
}

export default class EmailTemplateBuilder {

    constructor() { }

    public selectTemplate(template: TemplateType, cb: (to: string, subject: string, body: string) => Promise<void>) {
        switch (template) {
            case 'expired-freemium-landing-business':
                return { buildExpiredFreemiumLandingBusinessTemplate: (data: EmailTemplateBaseData) => this.buildExpiredFreemiumLandingBusinessTemplate(data, cb) }
            case 'delete-freemium-landing-business':
                return { buildDeleteFreemiumLandingBusinessTemplate: (data: DeleteFreemiumLandingBusinessTemplateData) => this.buildDeleteFreemiumLandingBusinessTemplate(data, cb) }
        }
    }

    private async buildExpiredFreemiumLandingBusinessTemplate(data: EmailTemplateBaseData, cb: (to: string, subject: string, body: string) => Promise<void>) {
        if (!data.userEmail) {
            throw new Error('User email is required');
        }

        const userName = escapeHtml(data.userName);
        const bussinesName = escapeHtml(data.bussinesName);

        const subject = 'Tu cuenta en CuadreCaja será eliminada en 3 días';
        const body = `
                    <!-- Contenedor principal --> 
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:8px; padding:30px;"> 
                    
                    <!-- Header --> 
                    <tr> <td align="center" style="padding-bottom:20px;"> <h2 style="margin:0; color:#333;">CuadreCaja</h2> </td> </tr> 
                    <!-- Mensaje principal --> 
                    <tr> <td style="color:#333; font-size:16px; line-height:1.6;"> Hola <strong>${userName}</strong>, 
                    <br><br> Soy <strong>Adrian</strong>, formo parte del equipo de desarrollo de <strong>CuadreCaja</strong>. </td> 
                    </tr> <!-- Aviso --> <tr> <td style="padding-top:20px; color:#555; font-size:15px; line-height:1.6;"> Queríamos avisarte que el período de prueba de tu negocio <strong>${bussinesName}</strong> ha finalizado. 
                    <br><br> Tu cuenta será <strong style="color:#dc2626;">eliminada permanentemente en los próximos 3 días</strong>, junto con toda la información almacenada (ventas, inventario y registros). </td> </tr> <!-- CTA --> <tr> <td style="padding-top:20px; color:#555; font-size:15px; line-height:1.6;"> Si deseas continuar utilizando CuadreCaja y conservar tus datos, puedes activar tu suscripción contactándonos directamente: </td> </tr> <!-- Botón principal --> <tr> <td style="padding:30px 0;"> <a href="https://cuadrecaja.ventario.cloud/" style="background-color:#2563eb; color:#ffffff; text-decoration:none; padding:16px; border-radius:6px; font-size:16px; display:block; width:100%; text-align:center; box-sizing:border-box;"> Ver planes y continuar con mi cuenta </a> </td> </tr> <!-- Contacto --> <tr> <td style="color:#333; font-size:15px; line-height:1.6;"> También puedes escribirnos directamente por WhatsApp: <br><br> 📱 <strong>Camilo:</strong> <a href="https://wa.me/5354319958" style="color:#2563eb; text-decoration:none;">+53 54319958</a><br> 📱 <strong>Adrián:</strong> <a href="https://wa.me/5353334449" style="color:#2563eb; text-decoration:none;">+53 53334449</a> </td> </tr> <!-- Advertencia --> <tr> <td style="padding-top:20px; color:#b91c1c; font-size:14px;"> ⚠️ Una vez eliminada la cuenta, los datos no podrán ser recuperados. </td> </tr> <!-- Divider --> <tr> <td style="padding:25px 0;"> <hr style="border:none; border-top:1px solid #eee;"> </td> </tr> <!-- Cierre humano --> <tr> <td style="color:#555; font-size:14px; line-height:1.6;"> Nos encantaría que sigas usando CuadreCaja y continuar apoyándote en la gestión de tu negocio. </td> </tr> <!-- Firma --> <tr> <td style="padding-top:20px; color:#333; font-size:14px; line-height:1.6;"> Un saludo, <br> <strong>Adrian Fernandez</strong><br> Equipo de desarrollo – CuadreCaja </td> </tr> <!-- Footer --> <tr> <td style="padding-top:20px; color:#777; font-size:13px; text-align:center;"> © ${new Date().getFullYear()} CuadreCaja. Todos los derechos reservados. </td> </tr> </table> </td> </tr>
                `;
        await cb(data.userEmail, subject, body);
    }

    private async buildDeleteFreemiumLandingBusinessTemplate(data: DeleteFreemiumLandingBusinessTemplateData, cb: (to: string, subject: string, body: string) => Promise<void>) {
        const subject = 'Delete Freemium Landing Business';
        const body = `
            <table>
                <tr>
                    <td>Negocios que se intentaron eliminar</td>
                    <td>${data.bussinesToEliminate.map(escapeHtml).join(', ')}</td>
                </tr>
                <tr>
                    <td>Negocios que no se pudieron eliminar</td>
                    <td>${data.bussinesNotEliminated.map(escapeHtml).join(', ')}</td>
                </tr>
                <tr>
                    <td>Leads que se intentaron guardar</td>
                    <td>${data.leadsSaved.map(escapeHtml).join(', ')}</td>
                </tr>
            </table>`;
        await cb('adrianfdez469@gmail.com', subject, body);
    }
}
