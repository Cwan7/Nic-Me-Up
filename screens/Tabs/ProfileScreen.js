import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { auth } from '../../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Ensure this is correctly imported

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [profilePhoto, setProfilePhoto] = useState(null);
  const storage = getStorage();

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfilePhoto(data.photoURL || null);
        } else {
          setProfilePhoto(user.photoURL || null); // Fallback to auth photoURL if no Firestore data
        }
      });
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('✅ Sign-Out Success');
    } catch (error) {
      alert(`Sign-Out Error: ${error.message}`);
    }
  };

const pickImage = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaType?.IMAGE, // ✅ Updated line
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled && result.assets) {
    const uri = result.assets[0].uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { photoURL: downloadURL }, { merge: true });

      await updateProfile(user, { photoURL: downloadURL }).catch((error) =>
        console.error('Update Profile Error:', error)
      );

      setProfilePhoto(downloadURL);
    }
  }
};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.profileContainer}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {user?.displayName?.charAt(0) || 'U'}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
            <MaterialIcons name="edit" size={20} color="#000" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.text}>Username: {user?.displayName || 'N/A'}</Text>
        <Text style={styles.text}>Email: {user?.email}</Text>
        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dcdcdc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#60a8b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#60a8b8', // Changed to match placeholder
    borderRadius: 12,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
  },
  text: {
    fontSize: 16,
    marginVertical: 5,
    color: '#000000',
  },
  button: {
    marginVertical: 10,
    borderRadius: 2,
    backgroundColor: '#cdcdcd',
    paddingVertical: 10,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fc0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});