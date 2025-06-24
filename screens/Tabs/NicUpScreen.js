import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function NicUpScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>NicUp Screen</Text>
        <Text style={styles.text}>This is the NicUp feature screen. Functionality to be implemented.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dcdcdc', // Pinkish-red
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
    color: '#000000', // Black
  },
});