import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../../firebase';

export default function HomeScreen({ navigation }) {
  const handleNicUp = () => {
    console.log('NicUp button pressed');
    // Implement NicUp functionality later
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.nicUpButton} onPress={handleNicUp}>
          <Text style={styles.text}>NicUp</Text>
        </TouchableOpacity>
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
  nicUpButton: {
    marginVertical: 10,
    borderRadius: 2,
    backgroundColor: '#60a8b8', // Orange
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff', // White
    fontSize: 16,
    fontWeight: 'bold',
  },
});