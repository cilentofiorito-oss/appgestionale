# Setup SQL per gestionale + web app

## 1) Crea il database in Supabase
Apri SQL Editor e incolla il file:

- `supabase/schema.sql`

Questo crea:
- `business_settings`
- `services`
- `bookings`

## 2) Variabili ambiente
Crea `.env.local` partendo da `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
```

## 3) Installa dipendenze
```bash
npm install
```

## 4) Avvio locale
```bash
npm run dev
```

## 5) Variabili su Vercel
Inserisci le stesse variabili in:

Project Settings -> Environment Variables

## Come funziona ora
- Il gestionale salva `impostazioni` nel database SQL.
- La web app legge gli stessi dati dal database SQL.
- I `servizi` modificati dal gestionale compaiono subito nella web app.
- Le `prenotazioni` vengono salvate nel database SQL.
- Se Google Calendar è configurato, ogni prenotazione viene anche sincronizzata su Google Calendar.
- Se Google Calendar non è configurato, la web app continua comunque a funzionare con il solo database SQL.
