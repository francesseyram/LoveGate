import { describe, expect, it } from "vitest";
import {
  MEMBER_SOURCES, MemberRecord, docIdFor, mapHeaders, mapRow, mergeMembers, toMemberDoc,
} from "../memberImport";

const legon = MEMBER_SOURCES["loveinc-members"];
const knust = MEMBER_SOURCES.apostolos;
const ashesi = MEMBER_SOURCES["ashesi-c2029"];

function row(header: string[], values: string[], source = legon, line = 2): MemberRecord {
  const record = mapRow(values, mapHeaders(header), source, line);
  if (!record) throw new Error("row was skipped");
  return record;
}

describe("mapHeaders", () => {
  it("finds the same fields under each sheet's own headings", () => {
    expect(mapHeaders(["#", "Full Name", "Phone Number", "Email", "Date of Birth", "Hall/Hostel"]))
      .toMatchObject({ fullName: 1, phone: 2, email: 3, dob: 4, hostel: 5 });
    expect(mapHeaders(["NAME", "MOBILE", "WHATSAPP", "DOB", "LOCATION"]))
      .toMatchObject({ fullName: 0, phone: 1, whatsapp: 2, dob: 3, hostel: 4 });
  });

  it("still finds the name column when Excel's UTF-8 BOM prefixes the first heading", () => {
    expect(mapHeaders(["\uFEFFNAME", "MOBILE"])).toMatchObject({ fullName: 0, phone: 1 });
    expect(mapHeaders(["\uFEFFFull Name", "Phone Number"])).toMatchObject({ fullName: 0, phone: 1 });
  });
});

describe("mapRow", () => {
  const header = ["Full Name", "Phone Number", "Email", "Date of Birth", "Level", "Hall/Hostel", "Status", "Date Added"];

  it("carries a whole row across", () => {
    const record = row(header, [
      "Adrienne Dede Agbozo", "0552026265", "adrienneagbozo13@gmail.com", "03/07/2006", "100", "Pent", "Active", "01/01/2026",
    ]);
    expect(record).toMatchObject({
      fullName: "Adrienne Dede Agbozo",
      phone: "0552026265",
      phoneKey: "233552026265",
      email: "adrienneagbozo13@gmail.com",
      dobDay: 3, dobMonth: 7, dobYear: 2006,
      level: "100",
      hostel: "Pent",
      campus: "Legon",
      status: "active",
      joinedOn: "2026-01-01",
      sources: ["loveinc-members#2"],
      needsReview: false,
    });
  });

  it("skips a row that is neither a name nor a number", () => {
    expect(mapRow(["", "", "", "-"], mapHeaders(header), legon, 5)).toBeNull();
  });

  it("keeps someone listed with a name and nothing else, flagged for review", () => {
    const record = row(header, ["Asantewaa", "", "", "", "", "", "Inactive", ""]);
    expect(record.phoneKey).toBe("");
    expect(record.needsReview).toBe(true);
    expect(record.reviewNotes.join(" ")).toContain("cannot be deduplicated");
  });

  it("reads a whatsapp cell that just says the number is the same", () => {
    const record = row(["NAME", "MOBILE", "WHATSAPP"], ["Awula Dede", "0208286155", "Same"], knust);
    expect(record.whatsapp).toBe("0208286155");
  });

  it("does not record a placeholder as a hostel", () => {
    expect(row(header, ["Doxa Danso Arhin", "0559383828", "", "", "", "N/A"]).hostel).toBe("");
  });

  it("flags a date of birth nobody can read", () => {
    const record = row(header, ["Daniel Favour", "0538830090", "", "52007-03-01"]);
    expect(record.dobRaw).toBe("52007-03-01");
    expect(record.needsReview).toBe(true);
  });
});

describe("mergeMembers", () => {
  const header = ["Full Name", "Phone Number", "Email", "Date of Birth", "Level", "Hall/Hostel"];

  it("keeps the fuller spelling of the name and remembers the other", () => {
    const short = row(["NAME", "MOBILE"], ["Ben Arthur", "0593808821"], knust, 101);
    const full = row(header, ["Benedict Arthur", "0593808821", "", "", "", "Home"], legon, 68);
    const { merged } = mergeMembers(short, full);

    expect(merged.fullName).toBe("Benedict Arthur");
    expect(merged.aka).toEqual(["Ben Arthur"]);
    expect(merged.sources).toEqual(["apostolos#101", "loveinc-members#68"]);
  });

  it("finds someone under the name that lost", () => {
    const short = row(["NAME", "MOBILE"], ["Ben Arthur", "0593808821"], knust, 101);
    const full = row(header, ["Benedict Arthur", "0593808821"], legon, 68);
    const { merged } = mergeMembers(short, full);
    expect(toMemberDoc(merged).searchPrefixes).toContain("ben");
  });

  it("lets the sheet that is still maintained win a real disagreement", () => {
    const old = row(header, ["Ama Owusu", "0201234567", "", "", "", "Old Hostel"], knust, 3);
    const recent = row(header, ["Ama Owusu", "0201234567", "", "", "", "Pent"], legon, 9);
    const { merged, log } = mergeMembers(old, recent);

    expect(merged.hostel).toBe("Pent");
    expect(log.join("\n")).toContain("Old Hostel");
  });

  it("never lets an empty cell overwrite a filled one", () => {
    const withEmail = row(header, ["Ama Owusu", "0201234567", "ama@example.com"], knust, 3);
    const without = row(header, ["Ama Owusu", "0201234567", ""], legon, 9);
    expect(mergeMembers(withEmail, without).merged.email).toBe("ama@example.com");
    expect(mergeMembers(without, withEmail).merged.email).toBe("ama@example.com");
  });

  it("prefers the row whose date of birth survived with a year", () => {
    const dayOnly = row(header, ["Ama Owusu", "0201234567", "", "24/05"], legon, 9);
    const withYear = row(header, ["Ama Owusu", "0201234567", "", "24/05/2006"], knust, 3);
    expect(mergeMembers(dayOnly, withYear).merged.dobYear).toBe(2006);
  });

  it("keeps the second number rather than losing it", () => {
    const a = row(header, ["Ama Owusu", "0201234567"], legon, 9);
    const b = row(header, ["Ama Owusu", "233201234567"], knust, 3);
    expect(mergeMembers(a, b).merged.altPhones).toEqual([]);

    const c = row(["NAME", "MOBILE"], ["Ama Owusu", "0201234567/0247654321"], knust, 4);
    expect(mergeMembers(a, c).merged.altPhones).toEqual(["0247654321"]);
  });

  it("carries the class year over from the cohort sheet", () => {
    const cohort = row(["Name", "Mobile"], ["Kyra Laryea", "0201983431"], ashesi, 11);
    const members = row(header, ["Kyra Laryea", "0201983431"], legon, 9);
    expect(mergeMembers(members, cohort).merged.classYear).toBe(2029);
  });

  it("flags a merge between two people who share nothing but a number", () => {
    const one = row(["Name", "Mobile"], ["Sedem Kporvi", "0201111111"], ashesi, 48);
    const other = row(["Name", "Mobile"], ["Nana Yaw Muzzu", "0201111111"], ashesi, 49);
    const { merged, log } = mergeMembers(one, other);

    expect(merged.needsReview).toBe(true);
    expect(log.join("\n")).toContain("mistyped");
  });

  it("does not flag a merge between two spellings of one name", () => {
    const one = row(["Name", "Mobile"], ["Bryan Hans-Ampiah", "0206444833"], ashesi, 31);
    const other = row(["Name", "Mobile"], ["Bryan hans", "0206444833"], ashesi, 87);
    expect(mergeMembers(one, other).merged.needsReview).toBe(false);
  });
});

describe("docIdFor", () => {
  it("lands a re-import on the same document", () => {
    const first = row(["Name", "Mobile"], ["Ama Owusu", "0201234567"], legon, 9);
    const again = row(["NAME", "MOBILE"], ["Ama Owusu", "(+233) 201234567"], knust, 40);
    expect(docIdFor(first)).toBe(docIdFor(again));
  });

  it("scopes a member with no number to the sheet they came from", () => {
    const legonJoshua = row(["Name", "Mobile"], ["Joshua", ""], legon, 235);
    const knustJoshua = row(["NAME", "MOBILE"], ["Joshua", ""], knust, 12);
    expect(docIdFor(legonJoshua)).not.toBe(docIdFor(knustJoshua));
    expect(docIdFor(legonJoshua)).toBe(docIdFor(row(["Name", "Mobile"], ["Joshua", ""], legon, 235)));
  });
});

describe("toMemberDoc", () => {
  it("does not write import bookkeeping into Firestore", () => {
    const doc = toMemberDoc(row(["Name", "Mobile"], ["Ama Owusu", "0201234567"], legon, 9));
    expect(doc).not.toHaveProperty("priority");
    expect(doc.sourceCount).toBe(1);
  });
});

describe("confirmed aliases", () => {
  it("stops re-flagging a mismatch someone has already checked by hand", () => {
    const sheet = MEMBER_SOURCES["ashesi-c2027"];
    const one = row(["Name", "Mobile"], ["Sedem Kporvi", "0503879141"], sheet, 48);
    const other = row(["Name", "Mobile"], ["Nana Yaw Muzzu", "0503879141"], sheet, 49);
    const { merged } = mergeMembers(one, other);

    expect(merged.needsReview).toBe(false);
    expect(merged.aka).toEqual(["Sedem Kporvi"]);
  });
});
