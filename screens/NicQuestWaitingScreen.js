import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function NicQuestWaitingScreen({ route }) {
  const { userId, questDistance, sessionId, nicAssistLat, nicAssistLng } = route.params;
  const navigation = useNavigation();
  const [waiting, setWaiting] = useState(true);
  const unsubscribeRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!unsubscribeRef.current) {
      const q = query(collection(db, 'users'), where('NicMeUp.nicAssistResponse', '==', userId));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const hasAssister = snapshot.docs.length > 0;
        setWaiting(!hasAssister);
        if (hasAssister && !hasNavigatedRef.current) {
          console.log('Assister found, navigating to NicAssistScreen');
          const userBId = snapshot.docs[0].id;
          const userADocRef = doc(db, 'users', userId);
          const userADoc = await getDoc(userADocRef);
          const userAData = userADoc.data();
          await updateDoc(userADocRef, {
            NicMeUp: {
              ...userAData?.NicMeUp,
              sessionId: sessionId
            }
          }, { merge: true });
          setTimeout(() => {
            navigation.navigate('NicAssist', { 
              userAId: userId, 
              userBId, 
              sessionId,
              nicAssistLat: route.params.nicAssistLat,
              nicAssistLng: route.params.nicAssistLng,
            });
          }, 100); // Delay to stabilize navigation
          hasNavigatedRef.current = true;
        }
      }, (error) => {
        console.error('Snapshot error:', error);
      });
      unsubscribeRef.current = unsubscribe;
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        hasNavigatedRef.current = false;
      }
    };
  }, [userId, sessionId, navigation, nicAssistLat, nicAssistLng]);

  const handleCancel = async () => {
    try {
      const userADocRef = doc(db, 'users', userId);
      const userADoc = await getDoc(userADocRef);
      const userAData = userADoc.data();
      await updateDoc(userADocRef, {
        NicMeUp: {
          ...userAData?.NicMeUp,
          nicQuestAssistedBy: null,
          sessionId: ""
        }
      }, { merge: true });
      navigation.navigate('Tabs', { screen: 'Home' });
      hasNavigatedRef.current = false;
    } catch (error) {
      console.error('Error cancelling NicQuest:', error);
    }
  };

  const handleUpdate = () => {
    navigation.navigate('Settings');
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
        <Text style={styles.buttonText}>Cancel NicQuest</Text>
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