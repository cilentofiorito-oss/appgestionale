# Setup SQL / Supabase

1. Apri Supabase > SQL Editor.
2. Incolla tutto il contenuto di `supabase/schema.sql`.
3. Esegui lo script.
4. In Vercel aggiungi:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Facoltativo per Google Calendar:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GOOGLE_REFRESH_TOKEN`
   - `GOOGLE_CALENDAR_ID`
6. Redeploy su Vercel.

## Nota sul bug slot
La disdetta adesso imposta la prenotazione a `cancelled` nel database e rimuove anche l'eventuale evento Google Calendar. Gli slot pubblici ignorano le prenotazioni `cancelled`, quindi tornano disponibili subito.
