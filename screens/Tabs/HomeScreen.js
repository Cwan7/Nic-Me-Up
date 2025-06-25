import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../../firebase';

export default function HomeScreen({ navigation }) {
  const handleNicQuest = () => {
    console.log('NicQuestbutton pressed');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.nicQuestButton} onPress={handleNicQuest}>
          <Text style={styles.text}>NicQuest</Text>
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
  nicQuestButton: {
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