# Love Inc Ticketing — Frontend

Next.js (App Router, TypeScript, Tailwind). Deploys to Vercel. See the [repo root README](../README.md)
for the full system overview, Firebase setup, and how to add a new event.

## Develop

```bash
npm install
cp .env.local.example .env.local   # fill in Firebase Web app config
npm run dev
```

## Structure

- `app/` — routes: `/` (homepage), `/events/[slug]`, `/login`, `/checkin`, `/admin/reminders`
- `events/` — one folder per event's hand-built themed page, keyed by slug in `events/registry.tsx`
- `components/` — shared mechanics: `RegistrationForm`, `QRTicket`, `AuthGuard`,
  `CheckinScanner`/`CheckinSearch`
- `lib/` — `firebaseClient.ts` (Auth only), `functions.ts` (typed wrappers around every Cloud
  Function callable), `types.ts`

All data operations call Firebase Cloud Functions (see `../backend`) — this app never reads or
writes Firestore directly.
