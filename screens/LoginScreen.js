import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email Sign-In Success');
    } catch (error) {
      alert(`Sign-In Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.authContainer}>
        <Text style={styles.title}>NicMeUp</Text>
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
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.buttonSignIn} onPress={handleSignIn}>
            <Text style={styles.text}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('CreateAccount')}
          >
            <Text style={styles.text}>Create Account</Text>
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
    backgroundColor: '#dcdcdc',
  },
  authContainer: {
    width: '90%',
    backgroundColor: '#fff', 
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
    borderWidth: 1,
    borderColor: '#ffffff', // White
    borderRadius: 2,
    backgroundColor: '#dcdcdc', // White
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 10,
  },
  button: {
    marginVertical: 5,
    borderRadius: 2,
    backgroundColor: '#000', // Orange
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonSignIn: {
    marginVertical: 5,
    borderRadius: 2,
    backgroundColor: '#60a8b8', // Teal
    paddingVertical: 10,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff', // White
    fontSize: 16,
    fontWeight: 'bold',
  },
});