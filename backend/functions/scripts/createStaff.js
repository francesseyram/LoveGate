/**
 * One-off utility: creates (or updates the password of) a staff Firebase Auth
 * account. Any signed-in Firebase Auth user counts as staff for this app —
 * every staff-only Cloud Function checks context.auth, nothing more granular.
 *
 * Usage: node scripts/createStaff.js <email> <password>
 */
const admin = require("firebase-admin");

admin.initializeApp({ projectId: "loveinc-ticketting" });
const auth = admin.auth();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: node scripts/createStaff.js <email> <password>");
    process.exit(1);
  }

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password });
    console.log(`Updated password for existing staff user ${email} (${existing.uid})`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      const user = await auth.createUser({ email, password });
      console.log(`Created staff user ${email} (${user.uid})`);
    } else {
      throw err;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
