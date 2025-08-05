const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const FieldPath = admin.firestore.FieldPath;

async function performCleanup() {
  const now = Date.now();
  const cutoff = now - 1 * 60 * 1000; // 1-minute timeout for testing

  const usersSnapshot = await db.collection("users").where("sessionId", "!=", "").get();
  const updates = [];
  const notifications = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const userId = doc.id;

    if (data.lastActive && data.lastActive < cutoff) {
      const sessionId = data.sessionId;
      console.log(`🧹 Inactive user detected: ${userId} (session ${sessionId})`);

      // Update inactive user's own doc
      updates.push(doc.ref.update({
        showAlert: false,
        sessionId: "",
        nicQuestAssistedBy: null,
        nicAssistResponse: null,
        lastActive: null,
      }));
      console.log(`↪️ Cleared session fields for inactive user ${userId}`);

      // Find the other participant in the same session
      const sameSessionSnap = await db.collection('users')
        .where('sessionId', '==', sessionId)
        .get();

      const otherDoc = sameSessionSnap.docs.find(d => d.id !== userId);

      if (otherDoc) {
        const otherUserRef = otherDoc.ref;
        const otherUserData = otherDoc.data();
        const otherUserId = otherDoc.id;

        // Update active user's doc
        updates.push(otherUserRef.update({
          showAlert: true,
          // lastActive: null,
        }));
        console.log(`⚠️ Marked user ${otherUserId} as alerted (other user disconnected)`);

        // Send notification
        if (otherUserData.expoPushToken) {
          const messaging = admin.messaging();
          notifications.push(
            messaging.sendEachForMulticast({
              tokens: [otherUserData.expoPushToken],
              notification: {
                title: "Session Disconnected",
                body: `${data.username || "A user"} has disconnected.`,
              },
            })
          );
          console.log(`📲 Queued push notification to user ${otherUserId}`);
        } else {
          console.log(`🚫 No push token for user ${otherUserId}`);
        }
      } else {
        console.log(`❗ No other user found for session ${sessionId}`);
      }
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
