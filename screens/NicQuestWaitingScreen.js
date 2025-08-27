import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db, auth } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp} from 'firebase/firestore';

export default function NicQuestWaitingScreen({ route }) {
  const { userId, questDistance, sessionId, nicAssistLat, nicAssistLng } = route.params;
  const navigation = useNavigation();
  const [waiting, setWaiting] = useState(true);
  const unsubscribeRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    const sessionRef = doc(db, 'nicSessions', sessionId);

    unsubscribeRef.current = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const session = docSnap.data();
        if (session.userBId && !hasNavigatedRef.current) {
          console.log('✅ userB accepted NicMeUp — navigating to NicAssistScreen');
          hasNavigatedRef.current = true;

          // fetch photoURLs before navigating
          const fetchAndNavigate = async () => {
            try {
              const userADoc = await getDoc(doc(db, 'users', session.userAId));
              const userBDoc = await getDoc(doc(db, 'users', session.userBId));

              const userAPhoto = userADoc.exists() ? userADoc.data().photoURL : null;
              const userBPhoto = userBDoc.exists() ? userBDoc.data().photoURL : null;

              // now navigate and pass photos too
              navigation.navigate('NicAssist', {
                userAId: session.userAId,
                userBId: session.userBId,
                sessionId: session.sessionId,
                nicAssistLat: session.nicAssistLat,
                nicAssistLng: session.nicAssistLng,
                isGroup2: session.isGroup2,
                userAPhoto,   // new
                userBPhoto,   // new
              });
            } catch (err) {
              console.error("Error fetching user photos:", err);
              // fallback navigation if docs fail
              navigation.navigate('NicAssist', {
                userAId: session.userAId,
                userBId: session.userBId,
                sessionId: session.sessionId,
                nicAssistLat: session.nicAssistLat,
                nicAssistLng: session.nicAssistLng,
                isGroup2: session.isGroup2,
              });
            }
          };

          fetchAndNavigate();
        }
      } else {
        console.log('⚠️ Session document deleted (possibly canceled)');
        if (!hasNavigatedRef.current) {
          Alert.alert('Session Canceled', 'Your NicMeUp was canceled or expired.');
          navigation.navigate('Tabs', { screen: 'Home' });
        }
      }
    }, (error) => {
      console.error('Error listening to session:', error);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        hasNavigatedRef.current = false;
      }
    };
  }, [sessionId, navigation]);
useEffect(() => {
  let hasNavigated = false;
  const userDocRef = doc(db, 'users', auth.currentUser.uid);

  const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
    const data = docSnap.data();
    const nicMeUp = data?.NicMeUp;

    if (!hasNavigated && nicMeUp?.nicQuestAssistedBy && nicMeUp?.sessionId) {
      console.log('🚀 NicMeUp assisted by:', nicMeUp.nicQuestAssistedBy);
      hasNavigated = true; // prevent future triggers
      unsubscribe(); // stop listening once navigated
      navigation.navigate('NicAssist', {
        userAId: auth.currentUser.uid,
        userBId: nicMeUp.nicQuestAssistedBy,
        sessionId: nicMeUp.sessionId,
        nicAssistLat: null,
        nicAssistLng: null,
        isGroup2: false,
      });
    }
  });

  return () => unsubscribe();
}, []);


  const handleCancel = async () => {
    try {
      console.log('🛑 NicMeUp canceled by userA');
      // Delete the session
      await updateDoc(doc(db, 'nicSessions', sessionId), {
        active: false,
        canceledBy: userId,
        canceledAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', userId), {
        'NicMeUp.sessionId': ''
      }, { merge: true });

      navigation.navigate('Tabs', { screen: 'Home' });
    } catch (error) {
      console.error('Error canceling NicMeUp:', error);
    }
  };

  const handleUpdate = async () => {
     await updateDoc(doc(db, 'nicSessions', sessionId), {
        active: false,
        canceledBy: userId,
        canceledAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', userId), {
        'NicMeUp.sessionId': ''
      }, { merge: true });
    navigation.navigate('Tabs', { screen: 'Settings' });
  };
  
  return (
    <View style={styles.container}>
      <Image source={require('../assets/Logo3.png')} style={styles.logo} resizeMode='contain' />
      {waiting ? (
        <>
          <Text style={styles.message}>Waiting for NicAssist...</Text>
          <ActivityIndicator size="large" color="#60a8b8" style={styles.loading} />
        </>
      ) : null}
      <View style={styles.distanceContainer}>
        <Text style={styles.distance}>Distance: {questDistance} ft</Text>
        <TouchableOpacity onPress={handleUpdate}>
          <Text style={styles.updateText}>Update</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.buttonText}>Cancel NicMeUp</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', backgroundColor: '#dcdcdc' },
  logo: { width: 200, height: 200, marginBottom: 20, marginTop: 30 },
  message: { fontSize: 18, color: '#000', marginBottom: 20, textAlign: 'center' },
  loading: { marginVertical: 20 },
  distanceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  distance: { fontSize: 16, color: '#555', textAlign: 'center' },
  updateText: { fontSize: 16, color: '#60a8b8', textDecorationLine: 'underline', marginLeft: 5 },
  cancelButton: {
    marginVertical: 20, borderRadius: 5, paddingVertical: 15, paddingHorizontal: 30,
    alignItems: 'center', backgroundColor: '#60a8b8', borderBottomWidth: 4,
    borderBottomColor: '#4d8a9b', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});