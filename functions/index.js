const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function performCleanup() {
  const usersSnapshot = await db.collection("users")
    .where("NicMeUp.sessionId", "!=", "")
    .get();
  const updates = [];
  const notifications = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const userId = doc.id;

    console.log(`🧹 Processing user: ${userId} (session ${data.NicMeUp?.sessionId || "N/A"})`);

    // Update user's own doc to clear all specified fields
    updates.push(doc.ref.update({
      "NicMeUp.lastActive": null,
      "NicMeUp.nicAssistResponse": null,
      "NicMeUp.nicQuestAssistedBy": null,
      "NicMeUp.sessionId": "",
      "NicMeUp.showAlert": false,
    }));
    console.log(`↪️ Cleared session fields for user ${userId}`);

    // Find the other participant in the same session
    const sameSessionSnap = await db.collection('users')
      .where("NicMeUp.sessionId", "==", data.NicMeUp?.sessionId || "")
      .get();

    const otherDoc = sameSessionSnap.docs.find(d => d.id !== userId);

    if (otherDoc) {
      const otherUserRef = otherDoc.ref;
      const otherUserData = otherDoc.data();
      const otherUserId = otherDoc.id;

      // Update other user's doc to set showAlert to true
      updates.push(otherUserRef.update({
        "NicMeUp.showAlert": true,
      }));
      console.log(`⚠️ Marked user ${otherUserId} as alerted (session cleared)`);

      // Send notification
      if (otherUserData.expoPushToken) {
        const messaging = admin.messaging();
        notifications.push(
          messaging.sendEachForMulticast({
            tokens: [otherUserData.expoPushToken],
            notification: {
              title: "Session Cleared",
              body: `${data.username || "A user"} has cleared the session.`,
            },
          })
        );
        console.log(`📲 Queued push notification to user ${otherUserId}`);
      } else {
        console.log(`🚫 No push token for user ${otherUserId}`);
      }
    } else {
      console.log(`❗ No other user found for session ${data.NicMeUp?.sessionId || "N/A"}`);
    }
  }

  await Promise.all(updates);
  await Promise.all(notifications);
  console.log(`✅ Cleaned up ${updates.length} fields, sent ${notifications.length} notifications`);
}

// Scheduled Cloud Function
exports.cleanupInactiveSessions = onSchedule("every 1 minutes", async () => {
  await performCleanup();
});

// Local Test Endpoint
exports.testCleanup = functions.https.onRequest(async (req, res) => {
  try {
    await performCleanup();
    res.status(200).send("Cleanup function executed.");
  } catch (error) {
    console.error("❌ Error running testCleanup:", error);
    res.status(500).send("Error executing cleanup function.");
  }
});