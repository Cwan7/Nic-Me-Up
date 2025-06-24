import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

export default function ProfileScreen() {
  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('✅ Sign-Out Success');
    } catch (error) {
      alert(`Sign-Out Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000', // Black
  },
  text: {
    fontSize: 16,
    marginVertical: 5,
    color: '#000000', // Black
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
    color: '#fc0000', // White
    fontSize: 16,
    fontWeight: 'bold',
  },
});