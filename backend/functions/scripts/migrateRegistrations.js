/**
 * Backfills registrations created before `phoneKey` / `searchPrefixes` /
 * `checkedInBy` existed, so surname search and phone dedupe cover old records
 * too. Safe to re-run: it only writes docs that are actually missing fields.
 *
 * Note: documents created before this migration still have random ids, so the
 * atomic create()-collision dedupe only protects registrations made from now
 * on. `phoneKey` is written here so those older rows are at least queryable
 * and comparable.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=loveinc-ticketting node scripts/migrateRegistrations.js [--dry-run]
 */
const admin = require("firebase-admin");
const { toPhoneKey } = require("../lib/phone");
const { buildSearchPrefixes, buildTicketRef } = require("../lib/search");

const dryRun = process.argv.includes("--dry-run");

admin.initializeApp({ projectId: "loveinc-ticketting" });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("registrations").get();
  console.log(`Scanning ${snap.size} registrations${dryRun ? " (dry run)" : ""}…`);

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};

    if (!data.phoneKey) {
      patch.phoneKey = toPhoneKey(data.phone ?? "");
    }
    if (!Array.isArray(data.searchPrefixes) || data.searchPrefixes.length === 0) {
      patch.searchPrefixes = buildSearchPrefixes(data.name ?? "", buildTicketRef(doc.id));
    }
    if (data.checkedInBy === undefined) {
      patch.checkedInBy = null;
    }

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    console.log(`  ${doc.id} (${data.name}) <- ${Object.keys(patch).join(", ")}`);
    if (!dryRun) {
      await doc.ref.update(patch);
    }
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${skipped} already current.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
