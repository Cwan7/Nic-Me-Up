const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const INACTIVITY_LIMIT_MINUTES = 0.5;

async function performCleanup() {
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(now.toMillis() - INACTIVITY_LIMIT_MINUTES * 60 * 1000);

  const sessionsSnapshot = await db.collection("nicSessions")
    .where("active", "==", true)
    .get();

  const updates = [];
  const processedSessions = new Set();

  for (const sessionDoc of sessionsSnapshot.docs) {
    const sessionData = sessionDoc.data();
    const sessionId = sessionDoc.id;

    const updatedAtInactive = !sessionData.updatedAt || sessionData.updatedAt < cutoff;
    const userAInactive = !sessionData.userAActiveAt || sessionData.userAActiveAt < cutoff;
    const userBInactive = !sessionData.userBActiveAt || sessionData.userBActiveAt < cutoff;

    if (updatedAtInactive || userAInactive || userBInactive) {
      if (userAInactive && userBInactive) {
        // 🔹 Both inactive → delete session entirely
        updates.push(sessionDoc.ref.delete());

        // Clear both users NicMeUp state
        const participantsSnap = await db.collection("users")
          .where("NicMeUp.sessionId", "==", sessionId)
          .get();

        participantsSnap.forEach((userDoc) => {
          updates.push(userDoc.ref.update({
            "NicMeUp.nicAssistResponse": null,
            "NicMeUp.nicQuestAssistedBy": null,
            "NicMeUp.sessionId": "",
          }));
        });

      } else {
        // 🔹 One-sided inactivity → just mark session inactive
        updates.push(sessionDoc.ref.update({ active: false, canceledBy: 'Cloud' }));

        // Clear the inactive user’s NicMeUp
        const inactiveUserId = userAInactive ? sessionData.userAId : sessionData.userBId;
        updates.push(db.collection("users").doc(inactiveUserId).update({
          "NicMeUp.nicAssistResponse": null,
          "NicMeUp.nicQuestAssistedBy": null,
          "NicMeUp.sessionId": "",
        }));
      }
    }

    processedSessions.add(sessionId);
  }

  await Promise.all(updates);
  console.log(`✅ Cleaned ${processedSessions.size} sessions`);
}

// Run every 1 min
exports.cleanupInactiveSessions = onSchedule("every 1 minutes", async () => {
  await performCleanup();
});

// Local test endpoint
exports.testCleanup = onRequest(async (req, res) => {
  try {
    await performCleanup();
    res.status(200).send("Cleanup executed.");
  } catch (err) {
    console.error("❌ Error in testCleanup:", err);
    res.status(500).send("Error executing cleanup.");
  }
});
