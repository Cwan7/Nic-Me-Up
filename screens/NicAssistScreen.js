import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebase'; // Ensure auth is imported

export default function NicAssistScreen({ route }) {
  const { userAId, userBId } = route.params;
  const [userAData, setUserAData] = useState(null);
  const [userBData, setUserBData] = useState(null);
  const navigation = useNavigation();
  const isUserA = auth.currentUser?.uid === userAId; // Use auth.currentUser.uid

  useEffect(() => {
    const fetchUserData = async () => {
      const userADoc = await getDoc(doc(db, 'users', userAId));
      const userBDoc = await getDoc(doc(db, 'users', userBId));
      setUserAData(userADoc.data());
      setUserBData(userBDoc.data());
    };
    fetchUserData();
  }, [userAId, userBId]);

  const handleCancel = async () => {
    try {
      if (isUserA) {
        await updateDoc(doc(db, 'users', userAId), { nicQuestAssistedBy: null }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' });
      } else {
        await updateDoc(doc(db, 'users', userBId), { nicAssistResponse: null }, { merge: true });
        navigation.navigate('Tabs', { screen: 'Home' });
      }
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
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#dcdcdc',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  userInfo: {
    alignItems: 'center',
    marginVertical: 10,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 10,
  },
  cancelButton: {
    marginVertical: 10,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
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
});