import { google } from "googleapis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Codice OAuth mancante" },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Variabili Google OAuth mancanti" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    await calendar.calendarList.list();

    return NextResponse.json({
      success: true,
      message: "Google collegato correttamente",
      refreshToken: tokens.refresh_token ?? null,
    });
  } catch (error: any) {
    console.error("Errore callback Google:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data,
    });

    return NextResponse.json(
      {
        error: "Errore durante autenticazione Google",
        details: error?.response?.data || error?.message || null,
      },
      { status: 500 }
    );
  }
}