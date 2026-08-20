import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import {
  accraDayKey,
  buildDaySeries,
  buildHourSeries,
  topCategories,
  type CategoryBucket,
  type DayBucket,
  type HourBucket,
} from "./analytics";
import { RegistrationDoc, RegistrationSummaryDTO, registrationToSummary } from "./types";

function requireStaff(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
  return request.auth.uid;
}

/**
 * The roster row the dashboard table needs: the door's summary, plus signup
 * time, who invited them, and a contact number.
 *
 * Widened here rather than in RegistrationSummaryDTO on purpose. The summary is
 * what the check-in desk receives, and the door has no use for a referral or a
 * phone number — the narrower that payload stays, the less a compromised
 * volunteer login is worth. Organisers running this page do need to reach
 * people, so the number is carried on this DTO alone.
 */
export interface DashboardAttendeeDTO extends RegistrationSummaryDTO {
  registeredAt: string;
  invitedBy: string;
  phone: string;
}

export interface DashboardDTO {
  totals: {
    registered: number;
    checkedIn: number;
    yetToArrive: number;
    registeredToday: number;
    checkedInToday: number;
  };
  registrationsByDay: DayBucket[];
  checkInsByHour: HourBucket[];
  schools: CategoryBucket[];
  levels: CategoryBucket[];
  inviters: CategoryBucket[];
  attendees: DashboardAttendeeDTO[];
  generatedAt: string;
}

/**
 * Everything the dashboard plots, in one call.
 *
 * One pass over the event's registrations rather than a set of count()
 * aggregations: the charts need per-registration timestamps regardless, so
 * aggregating separately would read the same documents twice for numbers this
 * pass already has. getEventStats stays as it is — the door polls it all night
 * and only ever wants three integers.
 *
 * The buckets are computed here, not in the browser, so no page has to receive
 * the whole attendee record to draw a bar. What crosses the wire is the same
 * narrow summary the check-in desk gets, plus signup time.
 */
export const getEventDashboard = onCall<{ eventId: string }>(async (request) => {
  requireStaff(request);
  const eventId = request.data?.eventId;
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }

  const snap = await db.collection("registrations").where("eventId", "==", eventId).get();

  const now = new Date();
  const today = accraDayKey(now);

  const registeredDates: Date[] = [];
  const checkedInDates: Date[] = [];
  const schools: string[] = [];
  const levels: string[] = [];
  const inviters: string[] = [];
  const attendees: DashboardAttendeeDTO[] = [];

  let checkedIn = 0;
  let registeredToday = 0;
  let checkedInToday = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as RegistrationDoc;

    const registeredAt = data.registeredAt?.toDate() ?? null;
    if (registeredAt) {
      registeredDates.push(registeredAt);
      if (accraDayKey(registeredAt) === today) registeredToday += 1;
    }

    if (data.school) schools.push(data.school);
    if (data.level) levels.push(data.level);
    if (data.invitedBy) inviters.push(data.invitedBy);

    if (data.status === "checked_in") {
      checkedIn += 1;
      const checkedInAt = data.checkedInAt?.toDate() ?? null;
      if (checkedInAt) {
        checkedInDates.push(checkedInAt);
        if (accraDayKey(checkedInAt) === today) checkedInToday += 1;
      }
    }

    attendees.push({
      ...registrationToSummary(doc.id, data),
      registeredAt: registeredAt ? registeredAt.toISOString() : "",
      // Absent on anything registered before the field existed.
      invitedBy: data.invitedBy ?? "",
      phone: data.phone ?? "",
    });
  }

  // Newest first: the rows staff act on — a just-added test ticket, the person
  // who signed up while they were looking — are the ones they came here for.
  attendees.sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1));

  const registered = snap.size;

  const dashboard: DashboardDTO = {
    totals: {
      registered,
      checkedIn,
      yetToArrive: registered - checkedIn,
      registeredToday,
      checkedInToday,
    },
    registrationsByDay: buildDaySeries(registeredDates, now),
    checkInsByHour: buildHourSeries(checkedInDates),
    schools: topCategories(schools),
    levels: topCategories(levels, 8),
    inviters: topCategories(inviters, 8),
    attendees,
    generatedAt: Timestamp.now().toDate().toISOString(),
  };

  return dashboard;
});

/**
 * Hard-deletes one registration.
 *
 * Tickets left over from a dry run inflate every number on this page and are
 * indistinguishable from real attendees everywhere else, so staff need a way to
 * remove them. There is no soft-delete: a "deleted" flag would have to be
 * honored by every count, roster, search and reminder query in the codebase,
 * and one missed spot puts a ghost back in the room count.
 *
 * Scoped to the event the caller is looking at, so a stale id from another
 * event can't delete a stranger's ticket.
 */
export const deleteRegistration = onCall<{ eventId: string; registrationId: string }>(
  async (request) => {
    const staffUid = requireStaff(request);
    const { eventId, registrationId } = request.data ?? { eventId: "", registrationId: "" };

    if (!eventId || !registrationId) {
      throw new HttpsError("invalid-argument", "eventId and registrationId are required");
    }

    const docRef = db.collection("registrations").doc(registrationId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Registration not found");
    }

    const registration = snap.data() as RegistrationDoc;
    if (registration.eventId !== eventId) {
      throw new HttpsError("not-found", "This registration is not for the selected event");
    }

    await docRef.delete();

    // The document is gone, so the log line is the only remaining record of who
    // removed whom.
    logger.info("Deleted registration", {
      eventId,
      registrationId,
      name: registration.name,
      email: registration.email,
      status: registration.status,
      deletedBy: staffUid,
    });

    return { deleted: true, registrationId };
  }
);
