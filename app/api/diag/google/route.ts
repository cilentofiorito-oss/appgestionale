import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "";
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || "";
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const missing = {
      GOOGLE_CLIENT_ID: !clientId,
      GOOGLE_CLIENT_SECRET: !clientSecret,
      GOOGLE_REDIRECT_URI: !redirectUri,
      GOOGLE_REFRESH_TOKEN: !refreshToken,
      GOOGLE_CALENDAR_ID: !process.env.GOOGLE_CALENDAR_ID,
    };

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const cal = google.calendar({ version: "v3", auth: oAuth2Client });

    // prova 1: lista calendari (verifica auth)
    const list = await cal.calendarList.list({ maxResults: 10 });

    // prova 2: freebusy (verifica permessi su calendarId)
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: in2h.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    return NextResponse.json({
      ok: true,
      missing,
      calendarId,
      calendarListSample: (list.data.items || []).slice(0, 5).map((c) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary,
      })),
      freebusyKeys: Object.keys(fb.data.calendars || {}),
      freebusy: fb.data.calendars?.[calendarId]?.busy || [],
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: e?.message || String(e),
        code: e?.code,
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        details: e?.response?.data || null,
      },
      { status: 500 }
    );
  }
}