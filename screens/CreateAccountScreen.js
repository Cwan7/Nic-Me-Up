import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

export default function CreateAccountScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });
      console.log('✅ Email Sign-Up Success');
      navigation.navigate('Tabs'); // Navigate to Tabs after sign-up
    } catch (error) {
      alert(`Sign-Up Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.authContainer}>
        <Text style={styles.title}>Create Account</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#555"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#555"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.text}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonSignIn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.text}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dcdcdc', // Light gray
  },
  authContainer: {
    width: '90%',
    backgroundColor: '#fff', // White
    padding: 20,
    borderRadius: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000', // Black
  },
  input: {
    width: '100%',
    padding: 10,
    marginVertical: 10,
    borderRadius: 2,
    backgroundColor: '#dcdcdc', // Light gray
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 10,
  },
  button: {
    marginVertical: 5,
    borderRadius: 2,
    backgroundColor: '#60a8b8', // Teal
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonSignIn: {
    marginVertical: 5,
    borderRadius: 2,
    backgroundColor: '#000', // Black
    paddingVertical: 10,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff', // White
    fontSize: 16,
    fontWeight: 'bold',
  },
});