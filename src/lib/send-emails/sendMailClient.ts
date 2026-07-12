import { google } from 'googleapis';
import EmailTemplateBuilder, { TemplateType } from './templates';


export default class EmailClient {
  private readonly gmail: ReturnType<typeof google.gmail>;

  constructor() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  public async buildAndSendEmailBody(bodyType: TemplateType) {
    const template = new EmailTemplateBuilder();
    return await template.selectTemplate(bodyType, async(to, subject, body) => {
      const raw = await this.buildEmail(to, subject, body );
      await this.sendEmail(raw);
    });
  }

  private async buildEmail(to: string, subject: string, body: string) {
    const message = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n');
  
    const raw = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return raw;
  }

  private async sendEmail(raw: string) {
    await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  }

}