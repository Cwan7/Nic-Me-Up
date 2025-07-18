// notificationUtils.js
import * as Notifications from 'expo-notifications';
import { db } from './firebase'; 
import { collection, getDocs, query, where } from 'firebase/firestore';

export const sendNicQuestNotification = async (userName, currentUserId, otherUserData, userLocation) => {
  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      otherUserData.location.latitude,
      otherUserData.location.longitude
    );

    const questDistance = otherUserData.nicQuestDistance || 250;

    console.log(`📏 Distance to ${otherUserData.username}: ${distance} meters`);

    if (distance <= questDistance && otherUserData.expoPushToken) {
      const message = {
        to: otherUserData.expoPushToken,
        sound: 'default',
        title: `${userName} needs a pouch!`,
        body: `Check ${otherUserData.NicAssists[0].NicAssistAddress} for assistance.`,
        data: { type: 'NicQuest', userId: currentUserId },
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('📬 Notification sent:', result);
    } else {
      console.log('⚠️ Not sending notification: distance too far or no expoPushToken');
    }
  } catch (error) {
    console.error('❌ Error sending NicQuest notification:', error);
  }
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

