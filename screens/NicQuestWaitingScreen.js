import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function NicQuestWaitingScreen({ route }) {
  const { userId, questDistance } = route.params;
  const navigation = useNavigation();

  const handleCancel = () => {
    navigation.navigate('Tabs', { screen: 'Home' });
  };

  const handleUpdate = () => {
    navigation.navigate('Tabs',{screen:'Settings'});
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/Logo3.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.message}>Waiting for NicAssist...</Text>
      <ActivityIndicator size="large" color="#60a8b8" style={styles.loading} />
      <View style={styles.distanceContainer}>
        <Text style={styles.distance}>Distance: {questDistance} ft </Text>
        <TouchableOpacity onPress={handleUpdate}>
          <Text style={styles.updateText}>Update</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.buttonText}>Cancel NicQuest</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#dcdcdc',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    marginTop: 30,
  },
  message: {
    fontSize: 18,
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  loading: {
    marginVertical: 20,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  distance: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  updateText: {
    fontSize: 16,
    color: '#60a8b8',
    textDecorationLine: 'underline',
    marginLeft: 5,
  },
  cancelButton: {
    marginVertical: 20,
    borderRadius: 5,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center',
    backgroundColor: '#60a8b8',
    borderBottomWidth: 4,
    borderBottomColor: '#4d8a9b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});