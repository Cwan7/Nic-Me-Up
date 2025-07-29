import React, { useState, useEffect, useRef } from 'react';
import { Text, View, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { auth, db } from '../../firebase';
import { collection, getDocs, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
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
        data: { 
          type: 'NicQuest', 
          userId: currentUserId, 
          displayName: userName, 
          profilePhoto: auth.currentUser?.photoURL || null,
          nicAssistLat: assist.NicAssistLat,
          nicAssistLng: assist.NicAssistLng,
        },
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

export const sendLocationBasedNotification = async (userName, currentUserId, otherUserData, userLocation, location) => {
  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      location.latitude,
      location.longitude
    );

    const questDistanceFeet = otherUserData.nicQuestDistance || 250;
    const questDistance = questDistanceFeet * 0.3048;

    console.log(`📏 Distance to ${otherUserData.username} current location: ${distance.toFixed(2)} meters`);

    if (distance <= questDistance && otherUserData.expoPushToken) {
      const message = {
        to: otherUserData.expoPushToken,
        sound: 'default',
        title: `${userName} needs a pouch!`,
        body: `You’re nearby—offer assistance!`,
        data: { 
          type: 'NicQuest', 
          userId: currentUserId, 
          displayName: userName, 
          profilePhoto: auth.currentUser?.photoURL || null,
          nicAssistLat: location.latitude,
          nicAssistLng: location.longitude,
        },
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
      console.log('📬 Location-based notification sent:', result);
    } else {
      console.log('⚠️ Not sending location-based notification: distance too far or no expoPushToken');
    }
  } catch (error) {
    console.error('❌ Error sending location-based notification:', error);
  }
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
  const [questDistance, setQuestDistance] = useState(250);
  const [region, setRegion] = useState(null);

  const regionRef = useRef({
    latitudeDelta: 0.003,
    longitudeDelta: 0.003,
  });

  const mapRef = useRef(null);
  const unsubscribeLocation = useRef(null);
  const isFocused = useIsFocused();
  const { user } = route.params || { user: { displayName: 'Friend', uid: null } };
  const userName = user.displayName || 'Friend';
  const navigation = useNavigation();

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        if (userData?.location) {
          setUserLocation(userData.location);
          setQuestDistance(userData.nicQuestDistance || 250);
          user.photoURL = userData.photoURL || user.photoURL;

          const { latitude, longitude } = userData.location;
          setRegion({
            latitude,
            longitude,
            ...regionRef.current,
          });
        } else {
          setRegion({
            latitude: 39.7405,
            longitude: -104.9706,
            ...regionRef.current,
          });
        }

        const querySnapshot = await getDocs(collection(db, 'users'));
        const assists = [];
        const now = Date.now();

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (docSnap.id === currentUser.uid) return;

          // Active NicAssist markers
          if (data.NicAssists) {
            data.NicAssists.forEach(assist => {
              if (assist.Active) {
                assists.push({
                  userId: docSnap.id,
                  NicAssistAddress: assist.NicAssistAddress,
                  NicAssistLat: assist.NicAssistLat,
                  NicAssistLng: assist.NicAssistLng,
                });
              }
            });
          }

          // Location marker if updated in last 5 min
          if (
            data.location?.latitude &&
            data.location?.longitude &&
            data.location?.timestamp &&
            now - data.location.timestamp <= 5 * 60 * 1000
          ) {
            assists.push({
              userId: docSnap.id,
              NicAssistAddress: 'Current Location',
              NicAssistLat: data.location.latitude,
              NicAssistLng: data.location.longitude,
            });
          }
        });

        // Optional: deduplicate by lat/lng if needed
        const seen = new Set();
        const uniqueAssists = assists.filter(a => {
          const key = `${a.NicAssistLat.toFixed(5)}-${a.NicAssistLng.toFixed(5)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setNicAssists(uniqueAssists);

        unsubscribeLocation.current = onSnapshot(userDocRef, (docSnapshot) => {
          const data = docSnapshot.data();
          if (docSnapshot.exists() && data?.location) {
            const newLocation = data.location;
            setUserLocation(newLocation);

            if (mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                ...regionRef.current,
              }, 1000);
            }

            if (!region) {
              setRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                ...regionRef.current,
              });
            }
          }
        }, (error) => {
          console.error('🔥 Firestore location listener error:', error);
        });

      } catch (err) {
        console.error('🛑 Error loading user data:', err);
      }
    };

    loadUserData();

    return () => {
      if (unsubscribeLocation.current) unsubscribeLocation.current();
    };
  }, [isFocused]);

  const handleNicQuest = async () => {
  console.log(`📲 ${userName} NicQuest button pressed`);
  const currentUser = auth.currentUser;
  if (!currentUser || !userLocation) return;

  try {
    const sessionId = Date.now().toString(); 
    const userADocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userADocRef, { sessionId }, { merge: true });
    console.log('Session initialized with sessionId:', sessionId);

    const usersSnapshot = await getDocs(collection(db, 'users'));
    let notifiedUsers = [];
    let nearestAssist = null;
    let minDistance = Infinity;
    const now = Date.now();

    usersSnapshot.forEach(docSnap => {
      if (docSnap.id === currentUser.uid) return;

      const otherUserData = docSnap.data();
      const activeAssists = otherUserData.NicAssists?.filter(assist => assist.Active) || [];
      const otherLocation = otherUserData.location;
      const notifiedUserIds = new Set();

      // 1️⃣ Notify based on NicAssist
      activeAssists.forEach(assist => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          assist.NicAssistLat,
          assist.NicAssistLng
        );
        const questDistance = (otherUserData.nicQuestDistance || 250) * 0.3048;

        if (distance <= questDistance && otherUserData.expoPushToken && !notifiedUserIds.has(docSnap.id)) {
          console.log(`📍 NicAssist-based NicQuest to ${docSnap.id}, distance ${distance.toFixed(2)}m`);
          sendNicQuestNotification(userName, currentUser.uid, otherUserData, userLocation, assist);
          notifiedUserIds.add(docSnap.id);
          notifiedUsers.push({ userId: docSnap.id });

          if (distance < minDistance) {
            minDistance = distance;
            nearestAssist = assist;
          }
        }
      });

      // 2️⃣ Notify based on recent location (only if not already notified)
      if (
        otherLocation?.latitude &&
        otherLocation?.longitude &&
        otherLocation?.timestamp &&
        now - otherLocation.timestamp <= 5 * 60 * 1000
      ) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          otherLocation.latitude,
          otherLocation.longitude
        );
        const questDistance = (otherUserData.nicQuestDistance || 250) * 0.3048;

        if (distance <= questDistance && otherUserData.expoPushToken && !notifiedUserIds.has(docSnap.id)) {
          console.log(`📍 Location-based NicQuest to ${docSnap.id}, distance ${distance.toFixed(2)}m`);
          sendNicQuestNotification(userName, currentUser.uid, otherUserData, userLocation, {
            NicAssistLat: otherLocation.latitude,
            NicAssistLng: otherLocation.longitude,
            NicAssistAddress: "Current Location",
          });
          notifiedUserIds.add(docSnap.id);
          notifiedUsers.push({ userId: docSnap.id });

          if (distance < minDistance) {
            minDistance = distance;
            nearestAssist = {
              NicAssistLat: otherLocation.latitude,
              NicAssistLng: otherLocation.longitude,
              NicAssistAddress: "Current Location",
            };
          }
        }
      }
    });

    if (notifiedUsers.length > 0 || nearestAssist) {
      console.log(`📬 NicQuest sent to users: ${notifiedUsers.map(n => n.userId).join(', ')}`);
      navigation.navigate('NicQuestWaiting', {
        userId: currentUser.uid,
        questDistance,
        sessionId,
        nicAssistLat: nearestAssist?.NicAssistLat,
        nicAssistLng: nearestAssist?.NicAssistLng,
      });
    } else {
      console.log('⚠️ No nearby active NicAssists or recent locations');
      Alert.alert('No Available Users', 'No active NicAssists or recent users within range.');
    }
  } catch (error) {
    console.error('❌ Error sending NicQuest:', error);
  }
};

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>
          Hey
          <Text style={styles.username}> {userName}</Text>! Need a pouch?
        </Text>
        <Text style={styles.subText}>Tap to send a NicQuest to nearby users.</Text>

        <TouchableOpacity style={styles.nicQuestButton} onPress={handleNicQuest}>
          <Text style={styles.text}>NicQuest</Text>
        </TouchableOpacity>

        {region ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            onRegionChangeComplete={(newRegion) => {
              regionRef.current = {
                latitudeDelta: newRegion.latitudeDelta,
                longitudeDelta: newRegion.longitudeDelta,
              };
            }}
          >
            {nicAssists.map((assist, index) => (
              <Marker
                key={`assist-${index}`}
                coordinate={{
                  latitude: assist.NicAssistLat,
                  longitude: assist.NicAssistLng,
                }}
                title={assist.NicAssistAddress}
                pinColor="#FF6347"
              />
            ))}

            {userLocation && (
              <>
                <Circle
                  center={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  radius={questDistance * 0.3048}
                  fillColor="rgba(0, 0, 255, 0.2)"
                  strokeColor="rgba(0, 0, 255, 0.5)"
                  strokeWidth={1}
                />

                <Marker
                  key="currentUser"
                  coordinate={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                >
                  {user.photoURL ? (
                    <Image
                      source={{ uri: user.photoURL }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: 'white',
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#4682B4',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: 'white',
                      }}
                    >
                      <Text
                        style={{
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: 18,
                        }}
                      >
                        {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                </Marker>
              </>
            )}
          </MapView>
        ) : (
          <Text style={styles.errorText}>Waiting for location data...</Text>
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