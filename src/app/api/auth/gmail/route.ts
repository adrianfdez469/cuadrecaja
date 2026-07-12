import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI // http://localhost:3000/api/auth/gmail/callback
);

export async function GET() {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // necesario para obtener refresh_token
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
  });

  return Response.redirect(url);
}