import { defineSecret, defineString } from "firebase-functions/params";

export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/**
 * Sender for confirmation/reminder emails. The domain in this address MUST be
 * verified at https://resend.com/domains — Resend rejects anything else with a
 * 403 and the mail is silently never delivered.
 *
 * The default is Resend's shared sandbox sender, which works without any DNS
 * setup but can only deliver to the Resend account owner's own address, so it
 * is only useful for testing. Set the real value before an event:
 *   firebase functions:config unset  # (not needed; params are set at deploy)
 *   echo "Love Inc <tickets@yourdomain.org>" | firebase deploy --only functions
 * or add RESEND_FROM_EMAIL to backend/functions/.env
 */
export const RESEND_FROM_EMAIL = defineString("RESEND_FROM_EMAIL", {
  default: "Love Inc <onboarding@resend.dev>",
});

/**
 * Public origin of the frontend, no trailing slash — e.g. https://lovegate.vercel.app
 *
 * Events store `coverPhotoUrl` as a site-relative path, so this is what lets a
 * Cloud Function resolve the flyer and attach it to an email, and what makes
 * "view your ticket" links absolute. Empty by default: every use is optional,
 * so an unset value degrades to an email without artwork rather than breaking
 * the send. Set it in backend/functions/.env before an event.
 */
export const SITE_URL = defineString("SITE_URL", { default: "" });
