import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { auth, db } from '../../firebase'; // Adjust path as needed
import { collection, getDocs } from 'firebase/firestore';
import { sendNicQuestNotification, calculateDistance } from '../../notificationUtils'; // Adjust path

export default function HomeScreen({ user }) {
  const [nicAssists, setNicAssists] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const userName = user?.displayName || 'Friend';

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const assists = [];

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();

          if (docSnap.id === currentUser.uid && data.location) {
            setUserLocation(data.location);
          }

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
        console.error('Error loading NicAssist data:', error);
      }
    };

    loadUserData();
  }, []);

  const handleNicQuest = async () => {
    console.log(`📲${userName} NicQuest button pressed`);
    const currentUser = auth.currentUser;
    if (!currentUser || !userLocation) return;

    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach(async docSnap => {
        if (docSnap.id !== currentUser.uid) {
          const otherUserData = docSnap.data();
          if (otherUserData.NicAssists && otherUserData.location && otherUserData.expoPushToken) {
            await sendNicQuestNotification(userName, currentUser.uid, otherUserData, userLocation);
          }
        }
      });
    } catch (error) {
      console.error('Error sending NicQuest:', error);
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
                coordinate={{
                  latitude: assist.NicAssistLat,
                  longitude: assist.NicAssistLng,
                }}
                title={assist.NicAssistAddress}
                pinColor="#FF6347" // Tomato red for other users' pins
              />
            ))}
            <Marker
              key="currentUser"
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="Your Location"
              pinColor="blue" // Blue for current user
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
  container: {
    flex: 1,
    backgroundColor: '#dcdcdc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  welcomeText: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 20,
  },
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
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  map: {
    width: Dimensions.get('window').width - 40,
    height: 300,
    marginVertical: 20,
  },
  activitySection: {
    marginTop: 30,
    alignItems: 'center',
    width: '100%',
  },
  activityTitle: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '300',
    marginBottom: 10,
  },
  divider: {
    width: '90%',
    height: 2,
    backgroundColor: '#b7b7b7', 
    marginBottom: 10,
  },
  activityPlaceholder: {
    height: 50, 
    width: '90%',
    backgroundColor: '#f0f0f0', 
  },
  username: {
    fontWeight: 'bold',
    color: '#60a8b8', 
  },
});