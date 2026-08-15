/**
 * One-off utility: writes/updates the Firestore doc for an event. There's no
 * staff-facing event-creation UI by design (spec §6) — the dev team runs
 * this (or edits Firestore directly) when standing up a new event page.
 *
 * Usage: node scripts/seedEvent.js
 */
const admin = require("firebase-admin");

admin.initializeApp({ projectId: "loveinc-ticketting" });
const db = admin.firestore();

async function main() {
  const slug = "revive";
  // 6:30 PM in Accra, which is UTC+0 year-round (no DST).
  const startsAt = new Date("2026-08-22T18:30:00Z");

  const existing = await db.collection("events").where("slug", "==", slug).limit(1).get();
  const ref = existing.empty ? db.collection("events").doc() : existing.docs[0].ref;

  await ref.set({
    name: "Revive",
    slug,
    description:
      "Revive is a night of worship and prayer, open to the whole campus community. Come ready to encounter God and leave carrying a fire that doesn't go out.",
    coverPhotoUrl: "/events/revive/cover.jpg",
    startsAt: admin.firestore.Timestamp.fromDate(startsAt),
    location: "Anglican Church, University of Ghana",
    status: "published",
  });

  console.log(`Seeded event "${slug}" (${ref.id}) — starts ${startsAt.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
