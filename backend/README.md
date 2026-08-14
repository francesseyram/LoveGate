# Love Inc Ticketing — Backend

Firebase project `loveinc-ticketting`: Cloud Functions + Firestore rules/indexes. See the
[repo root README](../README.md) for the full system overview and setup steps.

## Structure

- `functions/src/events.ts` — `getPublishedEvents`, `getEvent` (public)
- `functions/src/registration.ts` — `registerForEvent` (public; duplicate-phone check, QR
  generation, confirmation email)
- `functions/src/checkin.ts` — `checkInByQr`, `checkInByRegistrationId`, `searchRegistrations`
  (staff-only)
- `functions/src/reminders.ts` — `sendUpcomingReminders` (scheduled), `triggerManualReminder`
  (staff-only)
- `functions/src/{qr,email,phone}.ts` — QR generation, Resend email templates, phone normalization
- `functions/scripts/` — one-off Node scripts (seed an event, create/update a staff account) run
  locally with `gcloud auth application-default login` credentials, not deployed

`firestore.rules` denies all direct client access — every read/write goes through these functions
via the Admin SDK, which bypasses rules entirely.

## Common commands

```bash
cd functions && npm run build          # typecheck + compile
cd functions && npm run serve          # emulators: functions + firestore + auth
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
npx firebase-tools functions:secrets:set RESEND_API_KEY
npx firebase-tools functions:log
```
