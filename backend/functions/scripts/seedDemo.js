/**
 * Fills the *emulator* with enough to exercise the whole app locally: a
 * finished event, an open one, and a spread of registrations across both.
 *
 * This exists because the emulator's Firestore starts empty, so pointing the
 * frontend at it (NEXT_PUBLIC_USE_EMULATORS=1) otherwise shows every screen in
 * its "nothing here" state — which is the one state you are never trying to
 * test. Nothing here is realistic data; it is shaped to make the archive, the
 * dashboard and the thank-you tool all have something to draw.
 *
 * Usage, with `npm run serve` already running in backend/functions:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seedDemo.js
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seedDemo.js --upcoming
 *
 * The flag is the only knob, and it exists because an event's date decides
 * which of two completely different pages it renders. Without it, the open
 * event, its registration form and the homepage hero are all unreachable
 * locally; with it, the archive is. Run it both ways to see both.
 */
const admin = require("firebase-admin");

// Hard refusal rather than a warning. This script writes fabricated people
// into `registrations`, and the only thing standing between that and the real
// attendee list is which host the Admin SDK happens to be pointed at.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "Refusing to run: FIRESTORE_EMULATOR_HOST is not set, so this would write demo data to the real project.\n" +
      "Run it as: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seedDemo.js"
  );
  process.exit(1);
}

admin.initializeApp({ projectId: "loveinc-ticketting" });
const db = admin.firestore();

const DAY = 24 * 60 * 60 * 1000;

const UPCOMING = process.argv.includes("--upcoming");

/** N days from today at 18:30 Accra, which is UTC+0 all year. */
function atHalfSeven(offsetDays) {
  const date = new Date(Date.now() + offsetDays * DAY);
  date.setUTCHours(18, 30, 0, 0);
  return date;
}

/**
 * Only `revive`, because it is the one slug with a hand-built page. Seeding a
 * second event would put a card on the homepage pointing at a route that
 * correctly 404s, which looks like a bug and isn't one.
 */
const EVENTS = [
  {
    slug: "revive",
    name: "Revive",
    description:
      "Revive is an open invitation to everyone in Accra — a night to encounter the presence of God and the fire of God. Come as you are, and leave carrying a fire that doesn't go out.",
    coverPhotoUrl: "/events/revive/cover.jpg",
    // Snapped to 18:30 Accra (UTC+0 year-round) rather than "now, shifted".
    // A doors time of 16:53 in a screenshot reads as a bug in the formatter.
    startsAt: atHalfSeven(UPCOMING ? 9 : -3),
    location: "Anglican Church Hall, University of Ghana",
    locationUrl: "https://maps.app.goo.gl/ak1oJNFkHanHXY9F9",
    registrations: 42,
    checkedInRatio: UPCOMING ? 0 : 0.72,
  },
];

const FIRST = "Ama Kofi Yaw Akosua Kwame Efua Kojo Abena Nana Esi Fiifi Adwoa".split(" ");
const LAST = "Mensah Osei Boateng Asante Owusu Addo Danso Appiah Baffour Tetteh".split(" ");
const SCHOOLS = ["Legon", "KNUST", "UPSA", "Ashesi", "GIMPA"];
const LEVELS = ["100", "200", "300", "400", "Working"];

function personAt(index) {
  const name = `${FIRST[index % FIRST.length]} ${LAST[(index * 7) % LAST.length]}`;
  // 0244000000 + index keeps every number distinct, which matters: phone is
  // the dedupe key, so repeats would collapse into one registration.
  const phone = `0${244000000 + index}`;
  return { name, phone };
}

/** Mirrors buildSearchPrefixes in src/search.ts closely enough for local search to work. */
function prefixesFor(name) {
  const out = new Set();
  for (const token of name.toLowerCase().split(/\s+/).filter(Boolean)) {
    for (let i = 1; i <= token.length; i++) out.add(token.slice(0, i));
  }
  return [...out];
}

async function seedEvent(spec) {
  const existing = await db.collection("events").where("slug", "==", spec.slug).limit(1).get();
  const ref = existing.empty ? db.collection("events").doc() : existing.docs[0].ref;

  await ref.set({
    name: spec.name,
    slug: spec.slug,
    description: spec.description,
    coverPhotoUrl: spec.coverPhotoUrl,
    startsAt: admin.firestore.Timestamp.fromDate(spec.startsAt),
    location: spec.location,
    ...(spec.locationUrl ? { locationUrl: spec.locationUrl } : {}),
    status: "published",
  });

  // Rewrite this event's registrations from scratch so re-running the seeder
  // doesn't stack a second set of fake people on top of the first.
  const old = await db.collection("registrations").where("eventId", "==", ref.id).get();
  for (let i = 0; i < old.docs.length; i += 400) {
    const batch = db.batch();
    old.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  const batch = db.batch();
  for (let i = 0; i < spec.registrations; i++) {
    const { name, phone } = personAt(i);
    const regRef = db.collection("registrations").doc();
    const checkedIn = i < Math.round(spec.registrations * spec.checkedInRatio);
    const registeredAt = new Date(spec.startsAt.getTime() - (spec.registrations - i) * 3600_000);

    batch.set(regRef, {
      eventId: ref.id,
      name,
      nameLower: name.toLowerCase(),
      searchPrefixes: prefixesFor(name),
      phone,
      phoneKey: phone,
      email: `demo+${spec.slug}${i}@example.com`,
      dob: "",
      school: SCHOOLS[i % SCHOOLS.length],
      level: LEVELS[i % LEVELS.length],
      whatsapp: phone,
      invitedBy: i % 3 === 0 ? FIRST[(i + 2) % FIRST.length] : "",
      qrValue: `ticket_${ref.id}_${regRef.id}`,
      status: checkedIn ? "checked_in" : "going",
      registeredAt: admin.firestore.Timestamp.fromDate(registeredAt),
      checkedInAt: checkedIn
        ? admin.firestore.Timestamp.fromDate(
            new Date(spec.startsAt.getTime() + (i % 5) * 1200_000)
          )
        : null,
      checkedInBy: checkedIn ? "demo-staff" : null,
    });
  }
  await batch.commit();

  console.log(
    `Seeded "${spec.slug}" (${ref.id}) — ${spec.registrations} registrations, starts ${spec.startsAt.toISOString()}`
  );
}

async function main() {
  for (const spec of EVENTS) {
    await seedEvent(spec);
  }
  console.log(UPCOMING ? "Mode: open event (themed page)" : "Mode: finished event (archive view)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
