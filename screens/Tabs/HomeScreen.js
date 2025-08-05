import React, { useState, useEffect, useRef } from 'react';
import { Text, View, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { auth, db } from '../../firebase';
import { collection, getDocs, doc, getDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useIsFocused, useNavigation } from '@react-navigation/native';

// Functions for Notifications/Distance
export const sendNicQuestNotification = async (userName, currentUserId, otherUserData, userLocation, assist, isGroup2, userAQuestDistance) => {
  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      assist.NicAssistLat,
      assist.NicAssistLng
    );

    console.log(`📏 Distance to ${otherUserData.username} ${isGroup2 ? 'current location' : 'NicAssistAddress'} (${assist.NicAssistAddress}): ${distance.toFixed(2)} meters, userAQuestDistance: ${userAQuestDistance}m`);

    if (distance <= userAQuestDistance && otherUserData.expoPushToken) {
      console.log(`🔑 Push token for ${otherUserData.username}:`, otherUserData.expoPushToken);
      const message = {
        to: otherUserData.expoPushToken,
        sound: 'default',
        title: `${userName} needs a pouch!`,
        body: isGroup2 ? `Assist at your current location.` : `Check ${assist.NicAssistAddress} for assistance.`,
        data: {
          type: 'NicQuest',
          userId: currentUserId,
          displayName: userName,
          profilePhoto: auth.currentUser?.photoURL || null,
          nicAssistLat: assist.NicAssistLat,
          nicAssistLng: assist.NicAssistLng,
          isGroup2: isGroup2,
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
      console.log('⚠️ Not sending notification: distance too far or no expoPushToken, token:', otherUserData.expoPushToken);
    }
  } catch (error) {
    console.error('❌ Error sending NicQuest notification:', error);
  }
};

export const sendLocationBasedNotification = async (userName, currentUserId, otherUserData, userLocation, location, userAQuestDistance) => {
  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      location.latitude,
      location.longitude
    );

    console.log(`📏 Distance to ${otherUserData.username} current location: ${distance.toFixed(2)} meters, userAQuestDistance: ${userAQuestDistance}m`);

    if (distance <= userAQuestDistance && otherUserData.expoPushToken) {
      console.log(`🔑 Push token for ${otherUserData.username}:`, otherUserData.expoPushToken);
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
      console.log('⚠️ Not sending location-based notification: distance too far or no expoPushToken, token:', otherUserData.expoPushToken);
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
  const [recentLocations, setRecentLocations] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [questDistance, setQuestDistance] = useState(250);
  const [region, setRegion] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [userInfoMap, setUserInfoMap] = useState({});

  const regionRef = useRef({
    latitudeDelta: 0.003,
    longitudeDelta: 0.003,
  });

  const mapRef = useRef(null);
  const unsubscribeLocation = useRef(null);
  const unsubscribeActivities = useRef(null);
  const isFocused = useIsFocused();
  const { user } = route.params || { user: { displayName: 'Friend', uid: null } };
  const userName = user.displayName || 'Friend';
  const navigation = useNavigation();
  const isListenerActive = useRef(false);

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      console.log('🔍 Loading user data, isFocused:', isFocused, 'currentUser:', currentUser?.uid);
      if (!currentUser || !isFocused) {
        console.log('⏸️ Delaying load: no user or not focused');
        return;
      }

      if (unsubscribeLocation.current && isListenerActive.current) {
        unsubscribeLocation.current();
        console.log('🧹 Unsubscribed existing location listener');
      }

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        console.log('📋 User doc fetched:', userDoc.exists());
        const userData = userDoc.data();

        if (userData?.location) {
          setUserLocation(userData.location);
          setQuestDistance(userData.nicQuestDistance || 250);
          user.photoURL = userData.photoURL || user.photoURL;
          console.log('📍 User location set:', userData.location, 'questDistance:', userData.nicQuestDistance || 250);
        } else {
          setRegion({
            latitude: 39.7405,
            longitude: -104.9706,
            ...regionRef.current,
          });
          console.log('⚠️ No user location, using default region:', { latitude: 39.7405, longitude: -104.9706 });
        }

        const querySnapshot = await getDocs(collection(db, 'users'));
        const assists = [];
        const locations = [];
        const now = Date.now();
        console.log('🔍 Querying users, total docs:', querySnapshot.size);

        querySnapshot.forEach(docSnap => {
          if (docSnap.id === currentUser.uid) return;

          const data = docSnap.data();
          console.log(`👤 User ${docSnap.id}, NicAssists count: ${data.NicAssists?.length || 0}, location:`, data.location);
          if (data.NicAssists) {
            data.NicAssists.forEach(assist => {
              if (assist.Active) {
                assists.push({
                  userId: docSnap.id,
                  NicAssistAddress: assist.NicAssistAddress,
                  NicAssistLat: assist.NicAssistLat,
                  NicAssistLng: assist.NicAssistLng,
                });
                console.log(`✅ Active NicAssist for ${docSnap.id}: ${assist.NicAssistAddress}`);
              }
            });
          }
          if (
            data.location?.latitude &&
            data.location?.longitude &&
            data.location?.timestamp &&
            now - data.location.timestamp <= 5 * 60 * 1000
          ) {
            locations.push({
              userId: docSnap.id,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              username: data.username || 'Unknown',
            });
            console.log(`📍 Recent location for ${docSnap.id}:`, data.location);
          }
        });
        setNicAssists(assists);
        setRecentLocations(locations);
        console.log('🌍 Updated nicAssists:', assists, 'recentLocations:', locations);

        const userIds = new Set();
        if (unsubscribeActivities.current) {
          unsubscribeActivities.current();
          console.log('🧹 Unsubscribed existing activities listener');
        }

        const activityDocRef = doc(db, 'recentActivities', 'allActivities');
        unsubscribeActivities.current = onSnapshot(activityDocRef, (activityDoc) => {
          const activities = activityDoc.exists() ? activityDoc.data().activities || [] : [];
          console.log('📊 Recent activities fetched:', activities.length);
          setRecentActivities(activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5));
          
          activities.forEach(act => {
            if (act.userAId) userIds.add(act.userAId);
            if (act.userBId) userIds.add(act.userBId);
          });

          Promise.all(
            Array.from(userIds).map(async (uid) => {
              try {
                const docRef = doc(db, 'users', uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setUserInfoMap(prev => ({
                    ...prev,
                    [uid]: { displayName: data.username || 'Unknown' },
                  }));
                  console.log(`👤 User info fetched for ${uid}:`, data.username);
                }
              } catch (err) {
                console.warn(`⚠️ Failed to fetch user info for ${uid}:`, err);
              }
            })
          );
        }, (error) => {
          console.error('🔥 Firestore activities listener error:', error);
        });

        if (!isListenerActive.current) {
          unsubscribeLocation.current = onSnapshot(userDocRef, (docSnapshot) => {
            const data = docSnapshot.data();
            console.log('📍 Live location update:', data?.location ? 'Yes' : 'No');
            if (docSnapshot.exists() && data?.location) {
              const newLocation = data.location;
              setUserLocation(newLocation);
              console.log(`📍 Updated: ${newLocation.latitude}, ${newLocation.longitude}`);

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
                console.log('🌐 Region initialized:', newLocation);
              }
            }
          }, (error) => {
            console.error('🔥 Firestore location listener error:', error);
          });
          isListenerActive.current = true;
          console.log('✅ Started live location tracking');
        }
      } catch (err) {
        console.error('🛑 Error loading user data:', err);
      }
    };

    if (isFocused && auth.currentUser) {
      loadUserData();
    }

    return () => {
      if (unsubscribeLocation.current && isListenerActive.current) {
        unsubscribeLocation.current();
        console.log('🧹 Cleaned up live location tracking on unmount');
        isListenerActive.current = false;
      }
      if (unsubscribeActivities.current) {
        unsubscribeActivities.current();
        console.log('🧹 Cleaned up activities tracking on unmount');
      }
    };
  }, [isFocused]);

const handleNicQuest = async () => {
  console.log(`📲 ${userName} NicQuest button pressed, userLocation:`, userLocation, 'questDistance:', questDistance);
  const currentUser = auth.currentUser;
  if (!currentUser || !userLocation) {
    console.log('⛔ No currentUser or userLocation');
    return;
  }

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
    const userAQuestDistance = questDistance * 0.3048;

    usersSnapshot.forEach(docSnap => {
      if (docSnap.id === currentUser.uid) return;

      const otherUserData = docSnap.data();
      const activeAssists = otherUserData.NicAssists?.filter(assist => assist.Active) || [];
      const otherLocation = otherUserData.location;
      const notifiedUserIds = new Set();

      console.log(`🔍 Checking user ${docSnap.id}, UserA questDistance: ${userAQuestDistance}m, activeAssists:`, activeAssists, 'location:', otherLocation);

      activeAssists.forEach(assist => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          assist.NicAssistLat,
          assist.NicAssistLng
        );
        console.log(`📍 NicAssist ${assist.NicAssistAddress} distance: ${distance.toFixed(2)}m, within ${userAQuestDistance}m? ${distance <= userAQuestDistance}`);
        if (distance <= userAQuestDistance && otherUserData.expoPushToken && !notifiedUserIds.has(docSnap.id)) {
          sendNicQuestNotification(userName, currentUser.uid, otherUserData, userLocation, assist, false, userAQuestDistance);
          notifiedUserIds.add(docSnap.id);
          notifiedUsers.push({ userId: docSnap.id });

          if (distance < minDistance) {
            minDistance = distance;
            nearestAssist = assist;
          }
        }
      });

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
        console.log(`📍 Location-based distance to ${docSnap.id}: ${distance.toFixed(2)}m, within ${userAQuestDistance}m? ${distance <= userAQuestDistance}`);
        if (distance <= userAQuestDistance && otherUserData.expoPushToken && !notifiedUserIds.has(docSnap.id)) {
          sendLocationBasedNotification(userName, currentUser.uid, otherUserData, userLocation, otherLocation, userAQuestDistance);
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
      console.log(`📬 NicQuest sent to users: ${notifiedUsers.map(n => n.userId).join(', ')}, nearestAssist:`, nearestAssist);
      setTimeout(() => {
        navigation.navigate('NicQuestWaiting', {
          userId: currentUser.uid,
          questDistance,
          sessionId,
          nicAssistLat: nearestAssist?.NicAssistLat || userLocation.latitude,
          nicAssistLng: nearestAssist?.NicAssistLng || userLocation.longitude,
          isGroup2: nearestAssist?.NicAssistAddress === "Current Location",
        });
      }, 100); // Delay to ensure stack is ready
    } else {
      console.log('⚠️ No nearby active NicAssists or recent locations, userLocation:', userLocation, 'nicAssists:', nicAssists, 'recentLocations:', recentLocations);
      await updateDoc(userADocRef, { sessionId: "" }, { merge: true });
      Alert.alert('No Available Users', 'No active NicAssists or recent users within range.');
    }
  } catch (error) {
    console.error('❌ Error sending NicQuest:', error);
    await updateDoc(userADocRef, { sessionId: "" }, { merge: true });
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
            {recentLocations.map((location, index) => (
              <Marker
                key={`location-${index}`}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title={`${location.username}'s Current Location`}
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
                        backgroundColor: '#60a8b8',
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
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => {
              const userA = userInfoMap[activity.userAId] || { displayName: 'Unknown' };
              const userB = userInfoMap[activity.userBId] || { displayName: 'Unknown' };

              return (
                <View key={index} style={styles.activityCard}>
                  <View style={styles.usersContainer}>
                    <View style={styles.userCard}>
                      <Text style={styles.usernameActivity}>{userA.displayName}</Text>
                      <Text style={styles.roleLabel}>NicQuest</Text>
                    </View>
                    <View style={styles.vsContainer}>
                      <Text style={styles.vsText}>→</Text>
                    </View>
                    <View style={styles.userCard}>
                      <Text style={styles.usernameActivity}>{userB.displayName}</Text>
                      <Text style={styles.roleLabel}>NicAssist</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.activityPlaceholder}>No recent activity</Text>
          )}
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
    marginVertical: 10,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center',
    backgroundColor: '#60a8b8',
    borderBottomWidth: 4,
    borderBottomColor: '#4d8a9b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  text: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  map: { width: Dimensions.get('window').width - 40, height: 300, marginVertical: 20 },
  activitySection: { marginTop: 30, alignItems: 'center', width: '100%' },
  activityTitle: { fontSize: 18, color: '#000', fontWeight: '300', marginBottom: 10 },
  divider: { width: '90%', height: 2, backgroundColor: '#b7b7b7', marginBottom: 10 },
  activityPlaceholder: { height: 50, width: '90%', backgroundColor: '#f0f0f0' },
  username: { fontWeight: 'bold', color: '#60a8b8' },
  usernameActivity: { fontWeight: 'bold', color: '#000' },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 7,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 15,
    width: '100%',
  },
  usersContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userCard: { alignItems: 'center', justifyContent: 'center', width: '40%' },
  roleLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  vsContainer: { width: '20%', alignItems: 'center' },
  vsText: { fontSize: 35, color: '#60a8b8' },
});