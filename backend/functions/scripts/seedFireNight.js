/**
 * Writes/updates the Firestore docs for Fire Night and Sunday Service: two
 * separate events, each with its own registrations, that point at each other
 * through `companionSlug`. Registering for either offers a tick-box to sign up
 * for the other too, and someone who ticks it gets one QR ticket that works
 * at both (see registerForEvent).
 *
 * Nothing about these events lives in the frontend: the shared EventTemplate
 * draws each one from its doc.
 *
 *   chapter        "knust" | "global": the logo and the email sign-off.
 *   theme          "fire" | "embers" | "glow": the hero's atmosphere.
 *   tagline        optional line under the title.
 *   companionSlug  the sister event offered on this one's form.
 *   mapQuery       what the page's map and "Get directions" button point at.
 *                  A plus code is the reliable choice on campus.
 *   locationUrl    the venue link in the emails and on the ticket.
 *   coverPhotoUrl  the flyer. Also shown on the sister event's form beside the
 *                  tick-box, so people see what they're signing up for. Leave
 *                  "" until there is one; the form shows the details instead.
 *
 * Usage: node scripts/seedFireNight.js            (writes both as draft)
 *        node scripts/seedFireNight.js --publish  (both go live)
 * Against the emulator: prefix with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
const admin = require("firebase-admin");

admin.initializeApp({ projectId: "loveinc-ticketting" });
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

async function upsert(slug, fields) {
  const existing = await db.collection("events").where("slug", "==", slug).limit(1).get();
  const ref = existing.empty ? db.collection("events").doc() : existing.docs[0].ref;
  // merge keeps staff-set fields (autoCheckIn, reminderSentAt) on a re-run.
  // `sessions` is cleared: an earlier version of this script made Fire Night
  // one event with both gatherings as sessions.
  await ref.set({ slug, ...fields, sessions: FieldValue.delete() }, { merge: true });
  return ref.id;
}

async function main() {
  const status = process.argv.includes("--publish") ? "published" : "draft";
  // Accra (and Kumasi) are UTC+0 year-round, so these are local times.
  const ts = (iso) => Timestamp.fromDate(new Date(iso));

  const fireNight = await upsert("fire-night", {
    name: "Fire Night",
    description:
      "A night of worship and prayer at the College of Engineering. Come ready to meet God.",
    coverPhotoUrl: "/events/fire-night/cover.jpg",
    startsAt: ts("2026-11-27T19:30:00Z"),
    location: "Engineering Auditorium (Kumapley), Ground Floor, New Engineering Building",
    // The auditorium's plus code on Google Maps.
    mapQuery: "MCFP+22R, Kumasi",
    locationUrl: "https://www.google.com/maps/search/?api=1&query=MCFP%2B22R%2C%20Kumasi",
    chapter: "knust",
    theme: "fire",
    companionSlug: "sunday-service",
    status,
  });

  const sunday = await upsert("sunday-service", {
    name: "Sunday Service",
    description: "We gather again on Sunday morning for service.",
    coverPhotoUrl: "",
    startsAt: ts("2026-11-29T11:00:00Z"),
    location: "Mastercard Medium Conference Room",
    chapter: "knust",
    theme: "glow",
    companionSlug: "fire-night",
    status,
  });

  console.log(`Seeded "fire-night" (${fireNight}) and "sunday-service" (${sunday}) as ${status}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
