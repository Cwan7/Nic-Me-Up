import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth, db } from '../../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons'; // Import MaterialIcons

export default function SettingsScreen() {
  const [distance, setDistance] = useState(200); // Store as number
  const [showPicker, setShowPicker] = useState(false);

  // Load saved settings from Firestore on mount
  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (typeof data.nicQuestDistance === 'number') {
            setDistance(data.nicQuestDistance);
          }
        }
      }
    };
    loadSettings();
  }, []);

  // Save settings to Firestore
  const saveSettings = async (newDistance) => {
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          nicQuestDistance: newDistance
        }, { merge: true });
        Alert.alert('Success', 'Settings saved!');
      } catch (error) {
        console.error('Error saving settings:', error);
        Alert.alert('Error', 'Failed to save settings. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.settingsList}>
          <Text style={styles.subheader}>NicQuest</Text>
          <View style={styles.settingItem}>
            <View style={styles.labelRow}>
              <Text style={styles.settingLabel}>Distance to a NicAssist</Text>
              <TouchableOpacity
                onPress={() => setShowPicker(!showPicker)}
                style={styles.valueButton}
              >
                <Text style={styles.selectedValue}>{`${distance}ft`}</Text>
              </TouchableOpacity>
            </View>

            {showPicker && (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={distance}
                  style={styles.picker}
                  onValueChange={(itemValue) => {
                    setDistance(itemValue);
                    setShowPicker(false);
                    saveSettings(itemValue);
                  }}
                  dropdownIconColor="#000"
                >
                  <Picker.Item label="100ft" value={100} />
                  <Picker.Item label="150ft" value={150} />
                  <Picker.Item label="200ft" value={200} />
                  <Picker.Item label="250ft" value={250} />
                  <Picker.Item label="300ft" value={300} />
                  <Picker.Item label="400ft" value={400} />
                  <Picker.Item label="500ft" value={500} />
                </Picker>
              </View>
            )}
          </View>

          <View style={styles.nicAssistHeader}>
            <Text style={styles.subheader}>NicAssist</Text>
            <TouchableOpacity>
              <MaterialIcons name="add" size={24} color="#60a8b8" />
            </TouchableOpacity>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Coming Soon</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f1f1',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
  },
  settingsList: {
    marginTop: 10,
  },
  subheader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  nicAssistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 10,
  },
  settingItem: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  selectedValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4d8a9b',
  },
  valueButton: {
    paddingVertical: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#60a8b8',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
  },
  picker: {
    height: Platform.OS === 'ios' ? 200 : 50,
    width: '100',
  },
  settingText: {
    fontSize: 16,
    color: '#666666',
  },
});