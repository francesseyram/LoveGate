import { setGlobalOptions } from "firebase-functions/v2";

/**
 * Everything runs in Belgium rather than the us-central1 default: the audience
 * is in Accra, and West African traffic reaches Europe far more directly than
 * Iowa — it saves well over 100ms on every registration and every door scan.
 *
 * maxInstances is a deliberate cost ceiling. registerForEvent is public and
 * sends an email per call, so an unbounded fan-out is a runaway bill; 20
 * concurrent instances is far more than a campus event needs.
 */
setGlobalOptions({ region: "europe-west1", maxInstances: 20 });

export { getPublishedEvents, getEvent } from "./events";
export { registerForEvent } from "./registration";
export { checkInByQr, checkInByRegistrationId, undoCheckIn, searchRegistrations } from "./checkin";
export { getEventSettings, setEventAutoCheckIn } from "./eventSettings";
export { getEventRoster, getEventStats, syncCheckIns } from "./roster";
export { getEventDashboard, deleteRegistration } from "./dashboard";
export { searchSelfCheckin, selfCheckIn } from "./selfCheckin";
export {
  sendUpcomingReminders,
  triggerManualReminder,
  getReminderRecipientCount,
} from "./reminders";
