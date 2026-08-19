import { describe, expect, it } from "vitest";
import {
  isPlausiblePhoneKey, memberDocId, parseDob, parseEmail, parseLevel, parsePhone,
  tidyName, unkeyedMemberDocId,
} from "../members";

describe("parsePhone", () => {
  it("keys the same person's number to one value however they wrote it", () => {
    const written = ["(+233) 549806258", "0549806258", "054 980 6258", "233549806258", "549806258"];
    const keys = new Set(written.map((raw) => parsePhone(raw).phoneKey));
    expect(keys).toEqual(new Set(["233549806258"]));
  });

  it("displays Ghana numbers the way people dial them", () => {
    expect(parsePhone("(+233) 549806258").phone).toBe("0549806258");
  });

  it("recovers the leading zero Excel ate", () => {
    expect(parsePhone("504371221").phone).toBe("0504371221");
  });

  it("undoes Excel reading the number as a float", () => {
    expect(parsePhone("553997671.0").phone).toBe("0553997671");
  });

  it("reads a letter O typed for a zero", () => {
    const parsed = parsePhone("O536692716");
    expect(parsed.phone).toBe("0536692716");
    expect(parsed.note).toContain("read");
  });

  it("does not treat words containing an o as a phone number", () => {
    expect(parsePhone("no answer").phoneKey).toBe("");
  });

  it("splits a cell holding two numbers", () => {
    const parsed = parsePhone("0505011723/0257993771");
    expect(parsed.phone).toBe("0505011723");
    expect(parsed.altPhones).toEqual(["0257993771"]);
  });

  it("rescues an email address typed into the phone column", () => {
    const parsed = parsePhone("andrewsamega2016@gmail.com");
    expect(parsed.phoneKey).toBe("");
    expect(parsed.strandedEmail).toBe("andrewsamega2016@gmail.com");
  });

  it("flags a number that is the wrong length instead of dropping the person", () => {
    const parsed = parsePhone("5951600");
    expect(parsed.suspect).toBe(true);
    expect(parsed.phoneKey).not.toBe("");
  });

  it("leaves a dialled foreign number as dialled", () => {
    expect(parsePhone("+19034490210").phone).toBe("+19034490210");
  });

  it("treats placeholder text as no number at all", () => {
    for (const blank of ["N/A", "no", "-", "None", ""]) {
      expect(parsePhone(blank).phoneKey).toBe("");
    }
  });
});

describe("isPlausiblePhoneKey", () => {
  it("accepts a full Ghana mobile number", () => {
    expect(isPlausiblePhoneKey("233549806258")).toBe(true);
  });

  it("rejects one digit too many", () => {
    expect(isPlausiblePhoneKey("2335945451088")).toBe(false);
  });
});

describe("parseDob", () => {
  it("reads the day and month out of every format in the sheets", () => {
    const cases: [string, number, number][] = [
      ["18-Sep", 18, 9],
      ["29th July", 29, 7],
      ["20th July,2006", 20, 7],
      ["17/11/2006", 17, 11],
      ["20/06", 20, 6],
      ["17-08-06", 17, 8],
      ["2006-03-18", 18, 3],
      ["9th February", 9, 2],
    ];
    for (const [raw, day, month] of cases) {
      const parsed = parseDob(raw);
      expect([raw, parsed.day, parsed.month]).toEqual([raw, day, month]);
    }
  });

  it("reads the UMaT sheet month-first", () => {
    expect(parseDob("10/18/2006", "mdy")).toMatchObject({ day: 18, month: 10 });
  });

  it("ignores the stated order when only one reading is possible", () => {
    expect(parseDob("18/10/2006", "mdy")).toMatchObject({ day: 18, month: 10 });
  });

  it("keeps a birth year that could be real", () => {
    expect(parseDob("17/11/2006").year).toBe(2006);
  });

  it("drops the year Excel stamped on a day and month", () => {
    // Someone typed "18 Sep"; Excel filed it as September 2023.
    expect(parseDob("2023-09-18")).toMatchObject({ day: 18, month: 9, year: null });
  });

  it("drops a birth year in the future", () => {
    expect(parseDob("07/09/2026").year).toBeNull();
  });

  it("expands a two-digit year", () => {
    expect(parseDob("17/11/06").year).toBe(2006);
  });

  it("keeps what was written when it cannot be read at all", () => {
    const parsed = parseDob("52007-03-01");
    expect(parsed).toMatchObject({ raw: "52007-03-01", day: null, month: null });
  });

  it("treats a placeholder as no date", () => {
    expect(parseDob("-")).toMatchObject({ raw: "", day: null, month: null });
  });
});

describe("tidyName", () => {
  it("calms a name that was shouted", () => {
    expect(tidyName("GLORIA ANNABELLA FOKUOH")).toBe("Gloria Annabella Fokuoh");
  });

  it("capitalises each part of a hyphenated name", () => {
    expect(tidyName("NANA ASOR-DEBRAH")).toBe("Nana Asor-Debrah");
  });

  it("leaves a name that is already mixed case exactly as written", () => {
    expect(tidyName("Nii-Addoquaye McCarthy")).toBe("Nii-Addoquaye McCarthy");
  });

  it("collapses stray whitespace", () => {
    expect(tidyName("Nhyira  Addo ")).toBe("Nhyira Addo");
  });
});

describe("parseEmail / parseLevel", () => {
  it("lowercases an email and rejects anything without an address in it", () => {
    expect(parseEmail("ANDERSONARNOLD514@GMAIL.COM")).toBe("andersonarnold514@gmail.com");
    expect(parseEmail("not in school")).toBe("");
  });

  it("reduces a level to its number", () => {
    expect(parseLevel("Level 100")).toBe("100");
    expect(parseLevel("N/A")).toBe("");
  });
});

describe("document ids", () => {
  it("gives the same person the same id on every run", () => {
    expect(memberDocId("233549806258")).toBe(memberDocId("233549806258"));
    expect(memberDocId("233549806258")).not.toBe(memberDocId("233549806259"));
  });

  it("does not put the phone number in the id", () => {
    expect(memberDocId("233549806258")).not.toContain("549806258");
  });

  it("keeps two nameless-sheet namesakes apart", () => {
    expect(unkeyedMemberDocId("loveinc-members", "joshua"))
      .not.toBe(unkeyedMemberDocId("apostolos", "joshua"));
  });
});
