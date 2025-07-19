import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { auth, db } from '../../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useIsFocused, useNavigation } from '@react-navigation/native';

// Functions for Notifications/Distance
export const sendNicQuestNotification = async (userName, currentUserId, otherUserData, userLocation, assist) => {
  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      assist.NicAssistLat,
      assist.NicAssistLng
    );

    const questDistanceFeet = otherUserData.nicQuestDistance || 250;
    const questDistance = questDistanceFeet * 0.3048;

    console.log(`📏 Distance to ${otherUserData.username} NicAssistAddress (${assist.NicAssistAddress}): ${distance.toFixed(2)} meters`);

    if (distance <= questDistance && otherUserData.expoPushToken) {
      const message = {
        to: otherUserData.expoPushToken,
        sound: 'default',
        title: `${userName} needs a pouch!`,
        body: `Check ${assist.NicAssistAddress} for assistance.`,
        data: { type: 'NicQuest', userId: currentUserId, displayName: userName, profilePhoto: auth.currentUser?.photoURL || null },
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
  };
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
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

export default function HomeScreen({ route }) {
  const [nicAssists, setNicAssists] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [questDistance, setQuestDistance] = useState(250); // Default 250 feet
  const { user } = route.params || { user: { displayName: 'Friend', uid: null } };
  const userName = user.displayName || 'Friend';
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        if (userData && userData.location) {
          setUserLocation(userData.location);
          setQuestDistance(userData.nicQuestDistance || 250); // Update with user's NicQuestDistance
        }

        const querySnapshot = await getDocs(collection(db, 'users'));
        const assists = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (docSnap.id !== currentUser.uid && data.NicAssists) {
            data.NicAssists.forEach(assist => {
              if (assist.Active) {
                assists.push({
                  NicAssistAddress: assist.NicAssistAddress,
                  NicAssistLat: assist.NicAssistLat,
                  NicAssistLng: assist.NicAssistLng,
                });
              }
            });
          }
        });
        setNicAssists(assists);
        console.log('Loaded NicAssists:', assists);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [isFocused]);

  const handleNicQuest = async () => {
    console.log(`📲${userName} NicQuest button pressed`);
    const currentUser = auth.currentUser;
    if (!currentUser || !userLocation) return;

    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let notifiedUsers = [];

      usersSnapshot.forEach(docSnap => {
        if (docSnap.id !== currentUser.uid) {
          const otherUserData = docSnap.data();
          const activeAssists = otherUserData.NicAssists?.filter(assist => assist.Active) || [];

          activeAssists.forEach(assist => {
            const distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              assist.NicAssistLat,
              assist.NicAssistLng
            );
            const questDistanceFeet = otherUserData.nicQuestDistance || 250;
            const questDistance = questDistanceFeet * 0.3048;

            if (distance <= questDistance && otherUserData.expoPushToken) {
              notifiedUsers.push(otherUserData.username);
              sendNicQuestNotification(userName, currentUser.uid, otherUserData, userLocation, assist);
            }
          });
        }
      });

      if (notifiedUsers.length > 0) {
        console.log(`📬 NicQuest sent to ${notifiedUsers.length} users: ${notifiedUsers.join(', ')}`);
        navigation.navigate('NicQuestWaiting', { userId: currentUser.uid, questDistance: questDistance });
      } else {
        console.log('⚠️ No nearby active NicAssists within quest distance');
      }
    } catch (error) {
      console.error('❌ Error sending NicQuest:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>Hey  
          <Text style={styles.username}> {userName}</Text>! Need a pouch?</Text>
        <Text style={styles.subText}>Tap to send a NicQuest to nearby users.</Text>
        <TouchableOpacity style={styles.nicQuestButton} onPress={handleNicQuest}>
          <Text style={styles.text}>NicQuest</Text>
        </TouchableOpacity>
        {userLocation && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {nicAssists.map((assist, index) => (
              <Marker
                key={index}
                coordinate={{ latitude: assist.NicAssistLat, longitude: assist.NicAssistLng }}
                title={assist.NicAssistAddress}
                pinColor="#FF6347"
              />
            ))}
            <Marker
              key="currentUser"
              coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
              title="Your Location"
              pinColor="blue"
            />
            <Circle
              center={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
              radius={questDistance * 0.3048} // Convert feet to meters
              fillColor="rgba(0, 0, 255, 0.2)" // Blue circle with 20% opacity
              strokeColor="rgba(0, 0, 255, 0.5)" // Blue outline with 50% opacity
              strokeWidth={1}
            />
          </MapView>
        )}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Recent Activity</Text>
          <View style={styles.divider} />
          <View style={styles.activityPlaceholder} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dcdcdc' },
  scrollView: { flex: 1 },
  content: { alignItems: 'center', padding: 20 },
  welcomeText: { fontSize: 20, color: '#000', textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  subText: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20 },
  nicQuestButton: {
    marginVertical: 10, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 30,
    alignItems: 'center', backgroundColor: '#60a8b8', borderBottomWidth: 4, borderBottomColor: '#4d8a9b',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  text: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  map: { width: Dimensions.get('window').width - 40, height: 300, marginVertical: 20 },
  activitySection: { marginTop: 30, alignItems: 'center', width: '100%' },
  activityTitle: { fontSize: 18, color: '#000', fontWeight: '300', marginBottom: 10 },
  divider: { width: '90%', height: 2, backgroundColor: '#b7b7b7', marginBottom: 10 },
  activityPlaceholder: { height: 50, width: '90%', backgroundColor: '#f0f0f0' },
  username: { fontWeight: 'bold', color: '#60a8b8' },
});