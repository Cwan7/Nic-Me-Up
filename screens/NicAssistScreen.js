import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native'; // Updated import
import { auth } from '../firebase';

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
  const route = useRoute(); // Use useRoute to get params
  const { userAId, userBId, sessionId } = route.params || {};
  const navigation = useNavigation();
  const sessionIdRef = useRef(sessionId); // Persist sessionId
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
  }, [userAId, userBId]); // No sessionId in deps, use ref instead

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
      <CancelAlert visible={showAlert} onOk={handleAlertOk} userId={auth.currentUser.uid} />
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