import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
/**
 * Must match `setGlobalOptions({ region })` in backend/functions/src/index.ts.
 * The fallback is the real deployment region, not a library default: these
 * NEXT_PUBLIC_* values are inlined at build time, so a host that's missing the
 * variable bakes the wrong region into the bundle and every callable 404s with
 * an opaque "internal" error.
 */
const FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west1";

export const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);

/**
 * Point `npm run dev` at the local emulators instead of the deployed backend.
 *
 * Off by default, and deliberately so: the deployed functions carry the real
 * event and the real attendee list, which is what you want to look at almost
 * every time. Turn it on (NEXT_PUBLIC_USE_EMULATORS=1 in .env.local, with
 * `npm run serve` running in backend/functions) when the work involves a
 * callable that isn't deployed yet, or anything that sends email — the
 * emulator has no RESEND_API_KEY, so a blast there fails at the send and
 * cannot reach a real inbox.
 *
 * Ports mirror backend/firebase.json.
 */
const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

if (USE_EMULATORS && typeof window !== "undefined") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // `disableWarnings` only silences the banner the SDK prints over the page;
  // it does not weaken anything, and the console still says where auth points.
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  console.info("Firebase: using local emulators (functions :5001, auth :9099)");
}
