import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Image, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [pouchType, setPouchType] = useState('Random');
  const [strength, setStrength] = useState('6mg');
  const [flavors, setFlavors] = useState('All');
  const [notes, setNotes] = useState('Notes for NicQuest');
  const storage = getStorage();

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfilePhoto(data.photoURL || null);
          setUsername(data.username || user.displayName || '');
          setPouchType(data.pouchType || 'Random');
          setStrength(data.strength || '6mg');
          setFlavors(data.flavors || 'All');
          setNotes(data.notes || 'Notes for NicQuest');
        } else {
          setProfilePhoto(user.photoURL || null);
          setUsername(user.displayName || '');
          setNotes('Notes for NicQuest');
        }
      }).catch((error) => console.error('Firestore fetch error:', error));
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
    console.log('edit button clicked');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.IMAGE,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      console.log('ImagePicker result:', result);

      if (!result.canceled && result.assets) {
        const uri = result.assets[0].uri;
        console.log('Selected image URI:', uri);
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
      } else {
        console.log('Image selection canceled or failed');
      }
    } catch (error) {
      console.error('ImagePicker or upload error:', error);
      Alert.alert('Error', 'Failed to pick or upload image. Check logs for details.');
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const saveProfile = async () => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        username,
        pouchType,
        strength,
        flavors,
        notes,
        photoURL: profilePhoto,
      }, { merge: true });
      setIsEditing(false);
      console.log('Profile saved to Firestore');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.centeredProfile}>
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
              <TouchableOpacity style={styles.editIcon} onPress={pickImage} activeOpacity={0.7}>
                <MaterialIcons name="edit" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Profile</Text>
            <TouchableOpacity onPress={handleEditToggle} style={styles.editButton}>
              <MaterialIcons name="edit" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={username}
              onChangeText={setUsername}
              editable={isEditing}
            />
            <Text style={styles.label}>Type of Pouches</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={pouchType}
              onChangeText={setPouchType}
              editable={isEditing}
            />
            <Text style={styles.label}>Strength</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={strength}
              onChangeText={setStrength}
              editable={isEditing}
            />
            <Text style={styles.label}>Flavors</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={flavors}
              onChangeText={setFlavors}
              editable={isEditing}
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={notes}
              onChangeText={setNotes}
              editable={isEditing}
              multiline={true}
              numberOfLines={4}
            />
          </View>
          {isEditing && (
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dcdcdc',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  centeredProfile: {
    alignItems: 'center',
    marginTop: 20, // Fixed top margin to keep photo stationary
    marginBottom: 30,
  },
  profileContainer: {
    position: 'relative',
    width: 100,
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
    backgroundColor: '#eb8d5a',
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
    backgroundColor: '#60a8b8',
    borderRadius: 12,
    padding: 4,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 10,
  },
  editButton: {
    padding: 5,
    width: 30,
    height: 30,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 15,
  },
  editable: {
    borderWidth: 1,
    borderColor: '#60a8b8',
  },
  saveButton: {
    backgroundColor: '#60a8b8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginBottom: 20,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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