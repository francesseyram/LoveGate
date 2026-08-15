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

Functions run in **europe-west1**, not the `us-central1` default — the audience is in Accra and
West African traffic reaches Europe far more directly than Iowa. `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`
must match, both locally and in Vercel.

## Check-in works offline

The door is the one place a dropped connection is unacceptable, so `/checkin` downloads the whole
attendee list for the selected event into IndexedDB when it opens. After that:

- QR scans are matched against the local roster — no round trip per person
- Name / ticket-code search runs locally
- Check-ins are recorded instantly and queued
- The queue flushes automatically the moment connectivity returns

The header shows live Online/Offline status and a queued count. `syncCheckIns` is idempotent, so a
retried queue can't double-count or overwrite someone's original arrival time.

**Open the check-in page once while online before the doors open** — that's what caches the roster.

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

### ⚠️ 4. Verify a sending domain before any real event

**Email is currently in test mode and will not reach attendees.**

`RESEND_FROM_EMAIL` in `backend/functions/.env` is set to Resend's shared sandbox sender
(`onboarding@resend.dev`). That address needs no DNS setup but **only delivers to the Resend
account owner's own address** — every other recipient is rejected with a 403.

To go live:

1. Add and verify a domain at <https://resend.com/domains>.
2. Change `RESEND_FROM_EMAIL` in `backend/functions/.env` to an address on that domain, e.g.
   `Love Inc <tickets@yourdomain.org>`.
3. Redeploy: `cd backend && npx firebase-tools deploy --only functions`.

Send failures are logged but deliberately do **not** fail the registration — an attendee still
gets their on-screen ticket if email is down. So check the logs rather than assuming success:

```bash
cd backend && npx firebase-tools functions:log --only registerForEvent
```

### 5. Create a staff account

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

# backend unit tests (phone normalization, search tokenization, doc-id derivation)
cd backend/functions && npm test
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
