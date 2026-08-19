/**
 * Seeds `member_db` — the standing membership roster — from the spreadsheets
 * the fellowship has kept since 2022.
 *
 * This collection is deliberately separate from `registrations`: a member is
 * someone on the roster, a registration is one person's ticket to one event.
 * Nothing in the ticketing or check-in path reads this collection.
 *
 * Input is one CSV per spreadsheet sheet, in backend/data/members/, named for
 * its key in MEMBER_SOURCES (loveinc-members.csv, ashesi-c2029.csv, …). That
 * directory is gitignored: it is 1,100 people's phone numbers and email
 * addresses and has no business in a git history. To regenerate it, open each
 * workbook and save each sheet as CSV under the matching name.
 *
 * Safe to re-run. Document ids are derived from the phone number, so a second
 * run updates the same people instead of doubling the roster.
 *
 * Usage:
 *   npm run build
 *   node scripts/seedMembers.js --dry-run     # parse + report, write nothing
 *   node scripts/seedMembers.js
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { MEMBER_SOURCES, mapHeaders, mapRow, mergeMembers, toMemberDoc, docIdFor } =
  require("../lib/memberImport");

const SAMPLE_COUNT = 3;

const COLLECTION = "member_db";
const BATCH_SIZE = 400;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirArg = args.find((a) => a.startsWith("--dir="));
const dataDir = dirArg
  ? path.resolve(dirArg.slice("--dir=".length))
  : path.resolve(__dirname, "../../data/members");

/**
 * Minimal RFC 4180 reader. These files contain quoted commas ("Gaza,
 * Libreville court") and quoted line breaks, so splitting on commas loses
 * people; pulling in a CSV dependency for one import script does not seem
 * worth it either.
 */
function parseCsv(text) {
  // Excel's "CSV UTF-8" export writes a BOM as the first character. Left in
  // place it prefixes the first header cell, and mapHeaders then misses the
  // name column ("no name column found") before any members are imported.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => cell.trim()));
}

function readSources() {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`No data directory at ${dataDir} — see the header of this script.`);
  }
  const files = fs.readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
  if (!files.length) throw new Error(`No CSVs found in ${dataDir}`);

  const unknown = files.map((f) => path.basename(f, ".csv")).filter((slug) => !MEMBER_SOURCES[slug]);
  if (unknown.length) {
    throw new Error(
      `No source defined for: ${unknown.join(", ")}. Add them to MEMBER_SOURCES in src/memberImport.ts ` +
      `(campus, priority and date order) so the import knows how to read them.`,
    );
  }
  return files;
}

function collect() {
  const members = new Map();       // docId -> MemberRecord
  const stats = { files: [], rowsRead: 0, skipped: 0, merges: 0 };
  const mergeLog = [];

  for (const file of readSources()) {
    const slug = path.basename(file, ".csv");
    const source = MEMBER_SOURCES[slug];
    const rows = parseCsv(fs.readFileSync(path.join(dataDir, file), "utf8"));
    const index = mapHeaders(rows[0] ?? []);

    if (index.fullName === undefined) {
      throw new Error(`${file}: no name column found in header [${(rows[0] ?? []).join(", ")}]`);
    }

    let read = 0;
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const record = mapRow(rows[i], index, source, i + 1);
      if (!record) { skipped++; continue; }
      read++;

      const id = docIdFor(record);
      const existing = members.get(id);
      if (!existing) { members.set(id, record); continue; }

      const { merged, log } = mergeMembers(existing, record);
      members.set(id, merged);
      stats.merges++;
      mergeLog.push(
        `MERGE ${merged.phone || "(no phone)"}  ${existing.fullName} [${existing.sources.join(", ")}]` +
        `  +  ${record.fullName} [${record.sources.join(", ")}]  ->  ${merged.fullName}` +
        (log.length ? `\n${log.join("\n")}` : ""),
      );
    }

    stats.files.push({ slug, read, skipped });
    stats.rowsRead += read;
    stats.skipped += skipped;
  }

  return { members, stats, mergeLog };
}

/**
 * Same person, two different numbers — so the phone key can't catch them.
 * Reported, never merged: the evidence (a shared email, or one person's
 * WhatsApp number being another's mobile) is strong enough to be worth a look
 * and far too weak to fold two records together automatically.
 */
function possibleDuplicates(members) {
  const all = [...members.values()];
  const byPhone = new Map(all.filter((m) => m.phoneKey).map((m) => [m.phoneKey, m]));
  const byEmail = new Map();
  const pairs = new Map();

  const flag = (a, b, why) => {
    if (a === b) return;
    const key = [a.nameLower, b.nameLower].sort().join("|");
    if (!pairs.has(key)) pairs.set(key, { a, b, why });
  };

  for (const member of all) {
    if (member.whatsappKey && member.whatsappKey !== member.phoneKey) {
      const other = byPhone.get(member.whatsappKey);
      if (other) flag(member, other, "one's WhatsApp number is the other's mobile");
    }
    if (member.email) {
      const other = byEmail.get(member.email);
      if (other) flag(member, other, `same email (${member.email})`);
      else byEmail.set(member.email, member);
    }
  }

  return [...pairs.values()];
}

function report(members, stats, mergeLog) {
  console.log(`Reading ${dataDir}\n`);
  for (const f of stats.files) {
    console.log(`  ${f.slug.padEnd(18)} ${String(f.read).padStart(4)} rows` +
      (f.skipped ? `  (${f.skipped} empty rows skipped)` : ""));
  }

  if (mergeLog.length) {
    console.log(`\n--- ${mergeLog.length} duplicates folded together ---`);
    for (const line of mergeLog) console.log(line);
  }

  const all = [...members.values()];
  const noPhone = all.filter((m) => !m.phoneKey);
  const suspect = all.filter((m) => m.phoneSuspect);
  const noDob = all.filter((m) => m.dobRaw && m.dobDay === null && m.dobMonth === null);
  const noYear = all.filter((m) => m.dobDay && !m.dobYear);

  if (suspect.length) {
    console.log(`\n--- ${suspect.length} phone numbers that are not valid Ghana numbers (imported anyway) ---`);
    for (const m of suspect) console.log(`  ${m.fullName} — ${m.phone} [${m.sources.join(", ")}]`);
  }
  if (noDob.length) {
    console.log(`\n--- ${noDob.length} unreadable dates of birth (kept verbatim in dobRaw) ---`);
    for (const m of noDob) console.log(`  ${m.fullName} — "${m.dobRaw}" [${m.sources.join(", ")}]`);
  }
  if (noPhone.length) {
    console.log(`\n--- ${noPhone.length} members with no phone number (imported, cannot be deduplicated) ---`);
    console.log(`  ${noPhone.map((m) => m.fullName).join(", ")}`);
  }

  const maybes = possibleDuplicates(members);
  if (maybes.length) {
    console.log(`\n--- ${maybes.length} possible duplicates on different numbers (NOT merged — check by hand) ---`);
    for (const { a, b, why } of maybes) {
      console.log(`  ${a.fullName} ${a.phone} [${a.sources.join(", ")}]`);
      console.log(`  ${b.fullName} ${b.phone} [${b.sources.join(", ")}]  — ${why}\n`);
    }
  }

  console.log(`\n--- what a document looks like (${SAMPLE_COUNT} of ${members.size}) ---`);
  for (const [id, record] of [...members.entries()].slice(0, SAMPLE_COUNT)) {
    console.log(`${COLLECTION}/${id}`, JSON.stringify(toMemberDoc(record), null, 2));
  }

  console.log(`\n${stats.rowsRead} rows read -> ${members.size} unique members` +
    `  (${stats.merges} duplicates folded, ${stats.skipped} blank rows skipped)`);
  console.log(`  with email:      ${all.filter((m) => m.email).length}`);
  console.log(`  with birthday:   ${all.filter((m) => m.dobDay && m.dobMonth).length}` +
    `  (of which ${all.filter((m) => m.dobYear).length} have a plausible year)`);
  console.log(`  needs review:    ${all.filter((m) => m.needsReview).length}`);
  if (noYear.length) console.log(`  day/month only:  ${noYear.length} (year missing or implausible, dropped)`);
}

async function write(members) {
  admin.initializeApp({ projectId: "loveinc-ticketting" });
  const db = admin.firestore();

  // Existing ids, so `createdAt` is stamped once and never overwritten on a
  // re-run. Fetching ids only keeps this to a single cheap query.
  const existing = new Set();
  const snap = await db.collection(COLLECTION).select().get();
  snap.docs.forEach((doc) => existing.add(doc.id));
  console.log(`\n${existing.size} documents already in ${COLLECTION}.`);

  const entries = [...members.entries()];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const [id, record] of entries.slice(i, i + BATCH_SIZE)) {
      const doc = toMemberDoc(record);
      doc.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      if (existing.has(id)) updated++;
      else { doc.createdAt = admin.firestore.FieldValue.serverTimestamp(); created++; }
      batch.set(db.collection(COLLECTION).doc(id), doc, { merge: true });
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }

  console.log(`\nDone. ${created} created, ${updated} updated in ${COLLECTION}.`);
}

async function main() {
  const { members, stats, mergeLog } = collect();
  report(members, stats, mergeLog);

  if (dryRun) {
    console.log(`\nDry run — nothing written. Drop --dry-run to seed ${COLLECTION}.`);
    return;
  }
  await write(members);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
