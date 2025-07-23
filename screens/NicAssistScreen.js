import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Dimensions } from 'react-native'; // Added Dimensions
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../firebase';
import MapView, { Marker } from 'react-native-maps';

const CancelAlert = ({ visible, onOk, userId }) => {
  const [isVisible, setIsVisible] = useState(visible);
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  if (!isVisible) return null;
  return Alert.alert(
    'NicQuest Canceled',
    'The NicQuest session has been canceled.',
    [{ text: 'OK', onPress: () => {
      setIsVisible(false);
      onOk();
    }, style: 'default' }]
  );
};

export default function NicAssistScreen() {
  const route = useRoute();
  const { userAId, userBId, sessionId } = route.params || {};
  const navigation = useNavigation();
  const sessionIdRef = useRef(sessionId);
  const [userAData, setUserAData] = useState(null);
  const [userBData, setUserBData] = useState(null);
  const isUserA = auth.currentUser?.uid === userAId;
  const unsubscribeSession = useRef(null);
  const hasNavigatedRef = useRef(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    let unsubscribe;

    const init = async () => {
      if (!sessionIdRef.current) {
        console.error('SessionId is undefined, cannot initialize NicAssistScreen');
        return;
      }

      try {
        const userADoc = await getDoc(doc(db, 'users', userAId));
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        setUserAData(userADoc.data());
        setUserBData(userBDoc.data());

        const userADocRef = doc(db, 'users', userAId);
        const userBDocRef = doc(db, 'users', userBId);
        await updateDoc(userADocRef, { sessionStatus: true, sessionId: sessionIdRef.current }, { merge: true });
        await updateDoc(userBDocRef, { sessionStatus: true, sessionId: sessionIdRef.current }, { merge: true });
        console.log('Session initialized with sessionId:', sessionIdRef.current);

        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists() && !hasNavigatedRef.current) {
            const data = docSnapshot.data();
            console.log('Listener fired for user:', auth.currentUser.uid, 'data.sessionId:', data.sessionId, 'current sessionId:', sessionIdRef.current);
            if (data.showAlert && data.sessionId === sessionIdRef.current) {
              console.log('Alert triggered for user:', auth.currentUser.uid);
              setShowAlert(true);
            }
          }
        }, (error) => {
          console.error('Session status listener error:', error);
        });
      } catch (err) {
        console.error('Error initializing NicAssistScreen:', err);
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
      hasNavigatedRef.current = false;
      setShowAlert(false);
    };
  }, [userAId, userBId]);

  const handleCancel = async () => {
    try {
      console.log('Cancelling for user:', auth.currentUser?.uid, 'isUserA:', isUserA);
      const userADocRef = doc(db, 'users', userAId);
      const userBDocRef = doc(db, 'users', userBId);
      const otherUserId = isUserA ? userBId : userAId;
      if (isUserA) {
        console.log('Updating userAId:', userAId, 'and userBId:', userBId);
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, sessionStatus: false, showAlert: false, sessionId: "" }, { merge: true });
        await updateDoc(userBDocRef, { nicAssistResponse: null, showAlert: true, sessionId: sessionIdRef.current }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' });
      } else {
        console.log('Updating userBId:', userBId, 'and userAId:', userAId);
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        console.log('UserB nicAssistResponse:', userBDoc.data()?.nicAssistResponse);
        await updateDoc(userBDocRef, { nicAssistResponse: null, sessionStatus: false, showAlert: false, sessionId: "" }, { merge: true });
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, showAlert: true, sessionId: sessionIdRef.current }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' });
      }
    } catch (error) {
      console.error('Error cancelling:', error);
    }
  };

  const handleAlertOk = async () => {
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, { showAlert: false, sessionStatus: false, sessionId: "" }, { merge: true });
    console.log('Reset showAlert, sessionStatus, and sessionId to false/"" for user:', auth.currentUser.uid);
    navigation.navigate('Tabs', { screen: 'Home' });
    hasNavigatedRef.current = true;
  };

  return (
    <View style={styles.container}>
      {userAData && userBData && (
        <View>
          <View style={styles.card}>
            <Text style={styles.title}>{isUserA ? 'NicQuest' : 'NicAssist'} Session</Text>
            <View style={styles.usersContainer}>
              {/* User A */}
              <View style={styles.userCard}>
                <Image source={{ uri: userAData.photoURL }} style={styles.userPhoto} />
                <Text style={styles.roleLabel}>{isUserA ? 'You' : 'NicQuest'}</Text>
                <Text style={styles.username}>{userAData.username}</Text>
              </View>

              {/* Divider */}
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>→</Text>
              </View>

              {/* User B */}
              <View style={styles.userCard}>
                <Image source={{ uri: userBData.photoURL }} style={styles.userPhoto} />
                <Text style={styles.roleLabel}>{isUserA ? 'NicAssist' : 'You'}</Text>
                <Text style={styles.username}>{userBData.username}</Text>
              </View>
            </View>

            {/* PonyBoy's Info */}
            <View style={styles.detailsContainer}>
              <Text style={styles.infoHeader}>{userBData.username}’s Info</Text>
              <View style={styles.data}>
                <View>
                  <Text style={styles.detail}>Pouch Type: <Text style={styles.detailValue}>{userBData.pouchType}</Text></Text>
                  <Text style={styles.detail}>Strength: <Text style={styles.detailValue}>{userBData.strength}</Text></Text>
                </View>
                <View>
                  <Text style={styles.detail}>Flavors: <Text style={styles.detailValue}>{userBData.flavors}</Text></Text>
                  <Text style={styles.detail}>Notes: <Text style={styles.detailValue}>{userBData.notes}</Text></Text>
                </View>
              </View>
            </View>
          </View>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (userAData.location.latitude + userBData.location.latitude) / 2,
              longitude: (userAData.location.longitude + userBData.location.longitude) / 2,
              latitudeDelta: 0.001, // Reduced for closer zoom
              longitudeDelta: 0.001, // Reduced for closer zoom
            }}
          >
            <Marker
              key="userA"
              coordinate={{ latitude: userAData.location.latitude, longitude: userAData.location.longitude }}
              title="Your Location"
              pinColor="blue"
            />
            <Marker
              key="userB"
              coordinate={{ latitude: userBData.location.latitude, longitude: userBData.location.longitude }}
              title={userBData.username + "'s Location"}
              pinColor="#FF6347"
            />
          </MapView>
        </View>
      )}
      <TouchableOpacity style={styles.bottomButton} onPress={handleCancel}>
        <Text style={styles.buttonText}>{isUserA ? 'Cancel NicQuest' : 'Cancel NicAssist'}</Text>
      </TouchableOpacity>
      <CancelAlert visible={showAlert} onOk={handleAlertOk} userId={auth.currentUser.uid} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dcdcdc',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#60a8b8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  usersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '40%',
  },
  userPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 6,
    backgroundColor: '#e0e0e0',
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
  },
  roleLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  vsContainer: {
    width: '20%',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 45,
    color: '#60a8b8',
  },
  detailsContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  infoHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2b2b2b',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  data: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  detail: {
    fontSize: 14,
    color: '#555',
    marginVertical: 6,
  },
  detailValue: {
    fontWeight: '600',
    color: '#333',
  },
  bottomButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: '80%',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#60a8b8',
    borderBottomWidth: 2,
    borderBottomColor: '#4d8a9b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  map: {
    width: Dimensions.get('window').width - 40,
    height: 300,
    marginBottom: 20,
  },
});


