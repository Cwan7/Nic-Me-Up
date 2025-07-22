import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';

export default function NicAssistScreen({ route }) {
  const { userAId, userBId } = route.params;
  const [userAData, setUserAData] = useState(null);
  const [userBData, setUserBData] = useState(null);
  const navigation = useNavigation();
  const isUserA = auth.currentUser?.uid === userAId;
  const unsubscribeSession = useRef(null);
  const hasNavigatedRef = useRef(false); // Flag to prevent multiple navigations

  useEffect(() => {
    let unsubscribe;

    const init = async () => {
      try {
        const userADoc = await getDoc(doc(db, 'users', userAId));
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        setUserAData(userADoc.data());
        setUserBData(userBDoc.data());

        // Set sessionStatus to true
        const userADocRef = doc(db, 'users', userAId);
        const userBDocRef = doc(db, 'users', userBId);
        await updateDoc(userADocRef, { sessionStatus: true }, { merge: true });
        await updateDoc(userBDocRef, { sessionStatus: true }, { merge: true });

        // Listener for session status and alert
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.showAlert && !hasNavigatedRef.current) {
              console.log('Showing alert for user:', auth.currentUser.uid);
              Alert.alert(
                'NicQuest Canceled',
                'The NicQuest session has been canceled.',
                [{ text: 'OK', onPress: async () => {
                  const userDocRef = doc(db, 'users', auth.currentUser.uid);
                  await updateDoc(userDocRef, { showAlert: false, sessionStatus: false }, { merge: true });
                  console.log('Reset showAlert and sessionStatus to false for user:', auth.currentUser.uid);
                  navigation.navigate('Tabs', { screen: 'Home' });
                  hasNavigatedRef.current = true; // Set flag after navigation
                }, style: 'default' }]
              );
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
      hasNavigatedRef.current = false; // Reset flag on unmount
    };
  }, [userAId, userBId, navigation]);

  const handleCancel = async () => {
    try {
      console.log('Cancelling for user:', auth.currentUser?.uid, 'isUserA:', isUserA);
      const userADocRef = doc(db, 'users', userAId);
      const userBDocRef = doc(db, 'users', userBId);
      if (isUserA) {
        console.log('Updating userAId:', userAId, 'and userBId:', userBId);
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, sessionStatus: false }, { merge: true });
        await updateDoc(userBDocRef, { nicAssistResponse: null, showAlert: true }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' }); // Navigate only UserA
      } else {
        console.log('Updating userBId:', userBId, 'and userAId:', userAId);
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        console.log('UserB nicAssistResponse:', userBDoc.data()?.nicAssistResponse);
        await updateDoc(userBDocRef, { nicAssistResponse: null, sessionStatus: false }, { merge: true });
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, showAlert: true }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' }); // Navigate only UserB
      }
      // No sessionStatus listener navigation for the canceling user
    } catch (error) {
      console.error('Error cancelling:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NicAssist Session</Text>
      {userAData && (
        <View style={styles.userInfo}>
          <Text style={styles.userName}>NicQuest: {userAData.username}</Text>
          {userAData.photoURL && <Image source={{ uri: userAData.photoURL }} style={styles.userPhoto} />}
          <Text>Flavors: {userAData.flavors}</Text>
          <Text>Pouch Type: {userAData.pouchType}</Text>
          <Text>Strength: {userAData.strength}</Text>
          {isUserA && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.buttonText}>Cancel NicQuest</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {userBData && (
        <View style={styles.userInfo}>
          <Text style={styles.userName}>NicAssist: {userBData.username}</Text>
          {userBData.photoURL && <Image source={{ uri: userBData.photoURL }} style={styles.userPhoto} />}
          <Text>Flavors: {userBData.flavors}</Text>
          <Text>Pouch Type: {userBData.pouchType}</Text>
          <Text>Strength: {userBData.strength}</Text>
          {!isUserA && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.buttonText}>Cancel NicAssist</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', backgroundColor: '#dcdcdc', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  userInfo: { alignItems: 'center', marginVertical: 10 },
  userName: { fontSize: 20, fontWeight: 'bold' },
  userPhoto: { width: 100, height: 100, borderRadius: 50, marginVertical: 10 },
  cancelButton: {
    marginVertical: 10, borderRadius: 5, paddingVertical: 10, paddingHorizontal: 20,
    alignItems: 'center', backgroundColor: '#60a8b8', borderBottomWidth: 2,
    borderBottomColor: '#4d8a9b',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});