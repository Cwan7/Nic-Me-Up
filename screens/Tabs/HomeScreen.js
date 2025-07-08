import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../../firebase';

export default function HomeScreen({ navigation }) {
  const handleNicQuest = () => {
    console.log('☎️ NicQuest button pressed');
  };

  const userName = auth.currentUser?.displayName || 'Friend';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Hey  
          <Text style={styles.username}> {userName}</Text>! Need a pouch?</Text>
        <Text style={styles.subText}>Tap to send a NicQuest to nearby users.</Text>
        <TouchableOpacity style={styles.nicQuestButton} onPress={handleNicQuest}>
          <Text style={styles.text}>NicQuest</Text>
        </TouchableOpacity>
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Recent Activity</Text>
          <View style={styles.divider} />
          <View style={styles.activityPlaceholder} />
        </View>
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
  welcomeText: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 20,
  },
  nicQuestButton: {
    marginVertical: 10,
    borderRadius: 10, // Rounded corners for a cooler look
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center',
    backgroundColor: '#60a8b8', // Base color
    // Pseudo-gradient effect with multiple background colors
    borderBottomWidth: 4,
    borderBottomColor: '#4d8a9b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5, // For Android shadow
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  activitySection: {
    marginTop: 30,
    alignItems: 'center',
    width: '100%',
  },
  activityTitle: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '300',
    marginBottom: 10,
  },
  divider: {
    width: '90%',
    height: 2,
    backgroundColor: '#b7b7b7', // Dark grey line
    marginBottom: 10,
  },
  activityPlaceholder: {
    height: 50, // Placeholder height for future content
    width: '90%',
    backgroundColor: '#f0f0f0', // Light grey for visibility
  },
  username: {
    fontWeight: 'bold',
    color: '#4d8a9b', // Matches your brand color
  },
});