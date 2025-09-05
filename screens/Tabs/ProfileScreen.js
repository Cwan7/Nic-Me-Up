import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Image, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { auth } from '../../firebase';
import { signOut, updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword, updateEmail } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FontAwesome } from 'react-native-vector-icons';

export default function ProfileScreen({ user, setUser }) {
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [pouchType, setPouchType] = useState('Random');
  const [strength, setStrength] = useState('6mg');
  const [flavors, setFlavors] = useState('All');
  const [notes, setNotes] = useState('Notes for NicQuest');
  const [email, setEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reenterPassword, setReenterPassword] = useState('');
  const [rating, setRating] = useState(null)
  const [ratingCount, setRatingCount] = useState(null)
  const storage = getStorage();

    const CustomStarRating = ({ rating = 5, size = 20 }) => {
      const stars = [];
      const rounded = Math.round(rating * 2) / 2;
      for (let i = 1; i <= 5; i++) {
        if (i <= rounded) {
          stars.push(<FontAwesome key={i} name="star" size={size} color="#FFD700" />);
        } else if (i - 0.5 === rounded) {
          stars.push(
            <View key={i} style={{ position: 'relative', width: size, height: size }}>
              <FontAwesome name="star" size={size} color="#cdcdcd" style={{ position: 'absolute', left: 0 }} />
              <View style={{ width: size / 2, overflow: 'hidden', position: 'absolute', left: 0, height: size }}>
                <FontAwesome name="star" size={size} color="#FFD700" />
              </View>
            </View>
          );
        } else {
          stars.push(<FontAwesome key={i} name="star" size={size} color="#cdcdcd" />);
        }
      }
      return <View style={{ flexDirection: 'row', marginTop: 5 }}>{stars}</View>;
    };

  useEffect(() => {
    if (user) {
      // Sync local state with the user prop
      setProfilePhoto(user.photoURL || null);
      setUsername(user.username || user.displayName || '');
      setEmail(user.email || '');
      setPouchType(user.pouchType || 'Random');
      setStrength(user.strength || '6mg');
      setFlavors(user.flavors || 'All');
      setNotes(user.notes || 'Notes for NicQuest');
      if (user.ratingsAverage) {
        setRating(user.ratingsAverage);
      } else {
        setRating(null)
      }
      if (user.ratingsCount) {
        setRatingCount(user.ratingsCount)
      } else {
        setRatingCount(null)
      }
    }
  }, [user]); // Re-run when user prop changes

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
          await updateProfile(user.firebaseUser, { photoURL: downloadURL }).catch((error) =>
            console.error('Update Profile Error:', error)
          );
          setProfilePhoto(downloadURL);
          setUser({ ...user, photoURL: downloadURL }); // Update parent state
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

  const reauthenticate = (currentPassword) => {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    return reauthenticateWithCredential(user, credential);
  };

  const saveProfile = async () => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);

        // Update email if changed
        if (email && email !== user.email) {
          await reauthenticate(currentPassword);
          await updateEmail(user.firebaseUser, email);
          console.log('📧 Email updated successfully');
        }

        // Update Firestore profile
        await setDoc(userDocRef, {
          username,
          pouchType,
          strength,
          flavors,
          notes,
          photoURL: profilePhoto,
        }, { merge: true });

        // Update auth displayName if username changed
        if (username !== user.displayName) {
          await updateProfile(user.firebaseUser, { displayName: username });
        }

        // Update parent state with new data
        setUser({ ...user, username, email, pouchType, strength, flavors, notes, photoURL: profilePhoto });
        setIsEditing(false);
        console.log('✅ Profile saved to Firestore');
      } catch (error) {
        console.error('Save Profile Error:', error.message);
        Alert.alert(
          'Error',
          error.message.includes('requires-recent-login')
            ? 'Please enter your current password to update email.'
            : 'Failed to save profile. Check logs for details.'
        );
      }
    }
  };

  const updateUserPassword = async () => {
    if (newPassword !== reenterPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }

    try {
      await reauthenticate(currentPassword);
      await updatePassword(user.firebaseUser, newPassword);
      setModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setReenterPassword('');
      console.log('Password updated successfully');
      Alert.alert('Success', 'Password has been updated.');
    } catch (error) {
      console.error('Password Update Error:', error.message);
      Alert.alert('Error', error.message.includes('requires-recent-login')
        ? 'Incorrect current password.'
        : 'Failed to update password. Check logs for details.');
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
            <View style={styles.profileBorder2}>
              <View style={styles.profileBorder}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>
                      {user?.displayName?.charAt(0) || 'F'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.editIcon} onPress={pickImage} activeOpacity={0.7}>
                  <MaterialIcons name="edit" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
            {rating ? (
              <View style={{ alignItems: "center", marginTop: 5,  }}>
                <CustomStarRating rating={rating} size={20} />
                <Text style={{ marginTop: 2, fontSize: 14, color: "#555" }}>
                  {rating.toFixed(2)} ({ratingCount} ratings)
                  </Text>
              </View>
            ) : (
              <Text style={{ marginTop: 5, fontStyle: 'italic', color: '#555' }}>No Account Ratings</Text>
            )}
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
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.value, isEditing && styles.editable]}
              value={email}
              onChangeText={setEmail}
              editable={isEditing}
              autoCapitalize="none"
              keyboardType="email-address"
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
          <TouchableOpacity style={styles.link} onPress={() => setModalVisible(true)}>
            <Text style={styles.linkText}>Update Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Password</Text>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={[styles.value, styles.editable, styles.fullWidthInput]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={true}
              placeholder="Enter current password"
              autoCapitalize="none"
              selectionColor="#000"
              placeholderTextColor="#888"
            />
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={[styles.value, styles.editable, styles.fullWidthInput]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
              placeholder="Enter new password"
              autoCapitalize="none"
              selectionColor="#000"
              placeholderTextColor="#888"
            />
            <Text style={styles.label}>Re-Enter New Password</Text>
            <TextInput
              style={[styles.value, styles.editable, styles.fullWidthInput]}
              value={reenterPassword}
              onChangeText={setReenterPassword}
              secureTextEntry={true}
              placeholder="Re-enter new password"
              autoCapitalize="none"
              selectionColor="#000"
              placeholderTextColor="#888"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={updateUserPassword}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 20,
    marginBottom: 30,
  },
  profileBorder2: {
    position: 'relative',
    width: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileBorder: {
    position: 'relative',
    width: 102,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: '#b7b7b7',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff'
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
    fontWeight: '300',
    color: '#3d3d3d',
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
  link: {
    marginVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#60a8b8',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 80, // Ensure bottom padding includes buttons
    borderRadius: 10,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
  },
  fullWidthInput: {
    flex: 1,
    width: '100%',
    minHeight: 40,
    paddingVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#60a8b8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginHorizontal: 10,
    alignItems: 'center',
    flex: 1,
  },
    modalButtonCancel: {
    backgroundColor: '#cdcdcd',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginHorizontal: 10,
    alignItems: 'center',
    flex: 1,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});