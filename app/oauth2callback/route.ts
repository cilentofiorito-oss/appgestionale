import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing ?code" }, { status: 400 });

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = "https://w-eb-app-prenotazioni1-nuovo.vercel.app/oauth2callback";

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oAuth2Client.getToken(code);

  return NextResponse.json({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    scope: tokens.scope,
    expiry_date: tokens.expiry_date,
  });
}
