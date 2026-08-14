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
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const existing = await db.collection("events").where("slug", "==", slug).limit(1).get();
  const ref = existing.empty ? db.collection("events").doc() : existing.docs[0].ref;

  await ref.set({
    name: "Revive",
    slug,
    description: "An evening of worship, community, and renewal.",
    coverPhotoUrl: "/events/revive/cover.jpg",
    startsAt: admin.firestore.Timestamp.fromDate(startsAt),
    location: "Love Inc Main Campus",
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
