// notificationUtils.js
import * as Notifications from 'expo-notifications';
import { db } from './firebase'; 
import { collection, getDocs, query, where } from 'firebase/firestore';

export const sendNicQuestNotification = async (userName, currentUserId, otherUserData, userLocation) => {
  try {
    const currentUserDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', currentUserId)));
    const currentUserData = currentUserDoc.docs[0].data();
    const questDistance = currentUserData.nicQuestDistance || 250; // Default to 250 meters

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      otherUserData.location.latitude,
      otherUserData.location.longitude
    );

    console.log(`Distance to ${otherUserData.username}: ${distance} meters`);

    if (distance <= questDistance && otherUserData.expoPushToken) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${userName} needs a pouch!`,
          body: `Check ${otherUserData.NicAssists[0].NicAssistAddress} for assistance.`,
          data: { type: 'NicQuest', userId: currentUserId },
        },
        trigger: null, // Send immediately
      });
      console.log(`Notification sent to ${otherUserData.username} at ${otherUserData.NicAssists[0].NicAssistAddress}`);
    }
  } catch (error) {
    console.error('Error sending NicQuest notification:', error);
  }
};

// Haversine formula to calculate distance between two coordinates
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};
