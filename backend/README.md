# Love Inc Ticketing — Backend

Firebase project `loveinc-ticketting`: Cloud Functions + Firestore rules/indexes. See the
[repo root README](../README.md) for the full system overview and setup steps.

## Structure

- `functions/src/events.ts` — `getPublishedEvents`, `getEvent` (public)
- `functions/src/registration.ts` — `registerForEvent` (public; duplicate-phone check, QR
  generation, confirmation email)
- `functions/src/checkin.ts` — `checkInByQr`, `checkInByRegistrationId`, `searchRegistrations`
  (staff-only). Returns a reduced DTO: name, email, ticket ref and status only — never DOB, phone,
  school or the QR payload
- `functions/src/roster.ts` — `getEventRoster` (whole attendee list for offline check-in),
  `getEventStats` (registered / checked-in counts via `count()` aggregation), `syncCheckIns`
  (idempotent batch flush of check-ins recorded while offline)
- `functions/src/eventWindow.ts` — how long after `startsAt` an event stays listed, so finished
  events drop off the homepage and out of the staff picker
- `functions/src/reminders.ts` — `sendUpcomingReminders` (scheduled), `triggerManualReminder`
  (staff-only)
- `functions/src/{qr,email,phone}.ts` — QR generation, Resend email templates, phone normalization
- `functions/src/phone.ts` — `toPhoneKey` collapses "020 …", "+233 20 …" and "233…" onto one
  canonical key so the same person can't take two tickets
- `functions/src/search.ts` — prefix tokens for surname-searchable check-in, plus the deterministic
  registration doc id that makes duplicate registration collide atomically
- `functions/scripts/` — one-off Node scripts (seed an event, create/update a staff account,
  backfill older registrations) run locally with `gcloud auth application-default login`
  credentials, not deployed

`firestore.rules` denies all direct client access — every read/write goes through these functions
via the Admin SDK, which bypasses rules entirely.

## Common commands

```bash
cd functions && npm run build          # typecheck + compile
cd functions && npm test               # unit tests
cd functions && npm run serve          # emulators: functions + firestore + auth

# backfill phoneKey / searchPrefixes on registrations created before those existed
cd functions && GOOGLE_CLOUD_PROJECT=loveinc-ticketting node scripts/migrateRegistrations.js --dry-run
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
npx firebase-tools functions:secrets:set RESEND_API_KEY
npx firebase-tools functions:log
```
