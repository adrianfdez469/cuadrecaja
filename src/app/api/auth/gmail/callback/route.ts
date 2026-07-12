//import { google } from 'googleapis';

// const oauth2Client = new google.auth.OAuth2(
//     process.env.GMAIL_CLIENT_ID,
//     process.env.GMAIL_CLIENT_SECRET,
//     process.env.GMAIL_REDIRECT_URI
// );

export async function GET(
    //request: Request
) {

    return Response.json({
        message: 'Gmail callback route',
    });
    
    // const { searchParams } = new URL(request.url);
    // const code = searchParams.get('code');

    // if (!code) {
    //     return Response.json({ error: 'No code provided' }, { status: 400 });
    // }

    // const { tokens } = await oauth2Client.getToken(code);

    // // tokens.refresh_token es lo que necesitas guardar de forma segura
    // console.log(tokens);

    // return Response.json({
    //     message: 'Copia el refresh_token y guárdalo en tus variables de entorno',
    //     tokens,
    // });
}