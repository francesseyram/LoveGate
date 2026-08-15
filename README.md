# LoveGate

A reusable event registration + check-in system for Love Inc. Every event gets its own hand-built,
themed page; registering issues one free QR ticket, emailed and shown on screen; front-desk staff
check people in by QR scan or name search.

## Repo layout

```
/frontend   Next.js (App Router, TypeScript, Tailwind) — deploys to Vercel
/backend    Firebase project: Cloud Functions, Firestore rules/indexes — deploys via Firebase CLI
```

The frontend never talks to Firestore directly. Every read/write (registration, check-in, event
lookups, reminders) goes through a Firebase Cloud Function. The only direct Firebase client usage
is Firebase Auth, for staff sign-in on `/checkin` and `/admin/reminders`.

## Firebase project

Project ID: `loveinc-ticketting`. Firestore and Authentication (Email/Password provider) are
already enabled. Cloud Functions require the **Blaze** (pay-as-you-go) plan — already upgraded.

## First-time setup

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend/functions && npm install
```

### 2. Frontend environment

Copy `frontend/.env.local.example` to `frontend/.env.local` and fill in the Firebase Web app config
(Firebase console → Project settings → General → Your apps → Web → SDK setup and configuration).

### 3. Backend secret

Confirmation and reminder emails are sent via [Resend](https://resend.com). Set the API key as a
Cloud Functions secret (this prompts for the value — nothing is stored in the repo):

```bash
cd backend
npx firebase-tools functions:secrets:set RESEND_API_KEY
```

You'll also need a verified sending domain in Resend, and to set `RESEND_FROM_EMAIL` (e.g.
`Love Inc <tickets@yourdomain.org>`) as a Cloud Functions environment variable if you don't want
the `tickets@loveinc.org` default in `backend/functions/src/email.ts`.

### 4. Create a staff account

There's no sign-up flow — staff accounts are created directly. Any signed-in Firebase Auth user
counts as staff (every staff-only Cloud Function just checks `context.auth`); there's no separate
roles/claims system.

```bash
cd backend/functions
GOOGLE_CLOUD_PROJECT=loveinc-ticketting node scripts/createStaff.js "staff@example.com" "a-password"
```

Requires `gcloud auth application-default login` to have been run once on your machine (or set
`GOOGLE_APPLICATION_CREDENTIALS` to a service account key).

## Adding a new event

There's intentionally no staff-facing "create event" UI — the dev team adds each event directly:

1. Add the Firestore doc (there's no CLI helper for arbitrary events yet — copy
   `backend/functions/scripts/seedEvent.js` and adjust the fields, or add it via the Firebase
   console under the `events` collection). Fields: `name`, `slug`, `description`, `coverPhotoUrl`,
   `startsAt` (Timestamp), `location`, `status` (`draft` while building, `published` when it should
   go live and accept registrations).
2. Add a cover image at `frontend/public/events/<slug>/cover.jpg` and point `coverPhotoUrl` at it.
3. Copy `frontend/events/revive/` to `frontend/events/<slug>/EventPage.tsx`, re-theme it, and embed
   `<RegistrationForm eventId={event.id} eventName={event.name} />` — that component is what
   actually handles validation, duplicate-phone detection, QR generation, and the confirmation
   email, so it shouldn't need to change per event.
4. Register the new page in `frontend/events/registry.tsx`.

## Running locally

```bash
# frontend
cd frontend && npm run dev          # http://localhost:3000

# backend, if you want to iterate against the Firebase emulators instead of prod
cd backend/functions && npm run serve
```

Local frontend dev talks to the **deployed** Cloud Functions by default (via `.env.local`), not the
emulators — swap `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`/project config if you want to point it at
emulators instead.

## Deploying

```bash
# backend — Firestore rules/indexes + all Cloud Functions
cd backend && npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions

# frontend — push to the branch Vercel is tracking, or:
cd frontend && npx vercel deploy --prod
```

Set the same `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local` in the Vercel project's
environment variables.

## Reminders

- Automatic: `sendUpcomingReminders` (scheduled Cloud Function) runs hourly and emails every
  `going` registrant of any published event starting 23–25 hours out, once per event
  (`events.reminderSentAt` guards against double-sends).
- Manual: staff can trigger an immediate reminder blast for a chosen event from
  `/admin/reminders` (behind staff sign-in).
