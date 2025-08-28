import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, FlatList, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Keyboard, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth, db } from '../../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { GOOGLE_API_KEY } from '@env';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const [distance, setDistance] = useState(200);
  const [showPicker, setShowPicker] = useState(false);
  const [nicAssists, setNicAssists] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAddress, setModalAddress] = useState('');
  const [modalSuggestions, setModalSuggestions] = useState([]);
  const [selectedNicAssist, setSelectedNicAssist] = useState(null); // Store selected address
  const [editingIndex, setEditingIndex] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [renameIndex, setRenameIndex] = useState(null);
  const [newName, setNewName] = useState('');
  const [isRenameModal, setIsRenameModal] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    if (modalAddress.length > 2) {
      fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(modalAddress)}&types=address&components=country:us&key=${GOOGLE_API_KEY}`)
        .then((response) => response.json())
        .then((data) => {
          if (!selectedNicAssist) { // Only fetch suggestions if no address is selected
            setModalSuggestions(data.predictions || []);
          } else {
            setModalSuggestions([]); // Clear suggestions when an address is selected
          }
        })
        .catch((error) => console.log('Fetch Error:', error));
    } else {
      setModalSuggestions([]);
    }
  }, [modalAddress, selectedNicAssist]); // Added selectedNicAssist as dependency

  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (typeof data.nicQuestDistance === 'number') setDistance(data.nicQuestDistance);
          if (data.NicAssists) setNicAssists(data.NicAssists);
        }
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (newDistance, newNicAssist = null, update = {}) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const updateData = { nicQuestDistance: newDistance, ...update };
        if (newNicAssist) {
          const newAssists = [...nicAssists];
          if (editingIndex !== null) {
            newAssists[editingIndex] = newNicAssist;
          } else {
            newAssists.push(newNicAssist);
          }
          updateData.NicAssists = newAssists;
        }
        await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
        Alert.alert('Success', 'Settings saved!');
        setModalVisible(false);
        setModalAddress('');
        setModalSuggestions([]);
        setSelectedNicAssist(null);
        setEditingIndex(null);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.NicAssists) setNicAssists(data.NicAssists);
          if (typeof data.nicQuestDistance === 'number') setDistance(data.nicQuestDistance);
        }
      } catch (error) {
        console.error('Error saving settings:', error);
        Alert.alert('Error', 'Failed to save settings. Please try again.');
      }
    }
  };

  const handleAddressSelect = async (item) => {
    Keyboard.dismiss();
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_API_KEY}`
      );
      const details = await response.json();
      if (details.status === 'OK') {
        const { description } = item;
        const { lat, lng } = details.result.geometry.location;
        setSelectedNicAssist({
          NicAssistAddress: description,
          NicAssistLat: lat,
          NicAssistLng: lng,
          Active: true,
          Name: null
        });
        setModalAddress(description);
      } else {
        Alert.alert('Error', 'Failed to fetch place details.');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Error', 'Failed to process address. Please try again.');
    }
  };

  const toggleActive = (index) => {
    const newAssists = [...nicAssists];
    newAssists[index].Active = !newAssists[index].Active;
    setNicAssists(newAssists);
    saveSettings(distance, null, { NicAssists: newAssists });
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const deleteAddress = (index) => {
    const newAssists = [...nicAssists];
    newAssists.splice(index, 1);
    saveSettings(distance, null, { NicAssists: newAssists });
  };

  const handleSaveAddress = () => {
    if (selectedNicAssist) {
      saveSettings(distance, selectedNicAssist);
    } else {
      Alert.alert('Error', 'No address selected.');
    }
  };
  const renameAddress = (index) => {
  setRenameIndex(index);
  setNewName(nicAssists[index].Name || ''); // Set current name or empty string
  setIsRenameModal(true);
  };

  const saveRename = async () => {
    if (renameIndex !== null) {
      const newAssists = [...nicAssists];
      newAssists[renameIndex].Name = newName || null; // Update Name field, set to null if empty
      setNicAssists(newAssists);
      await saveSettings(distance, null, { NicAssists: newAssists });
      setIsRenameModal(false);
      setRenameIndex(null);
      setNewName('');
    }
  };

  return (
    <ScrollView style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.settingsList}>
        <Text style={styles.subheader}>NicMeUp</Text>
        <View style={[styles.settingItem, styles.nicQuestSpacing]}>
          <View style={styles.labelRow}>
            <Text style={styles.settingLabel}>Distance to an Assist</Text>
            <TouchableOpacity onPress={() => setShowPicker(!showPicker)} style={styles.valueButton}>
              <Text style={styles.selectedValue}>{`${distance}ft`}</Text>
            </TouchableOpacity>
          </View>
          {showPicker && (
            <View style={styles.pickerWrapper}>
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
            </View>
          )}
        </View>

        <View style={styles.nicAssistHeader}>
          <View style={styles.editSection}>
            <Text style={styles.subheader}>NicAssist</Text>
            <TouchableOpacity onPress={handleEditToggle} style={styles.editButton}>
              <MaterialIcons name="edit" size={24} color={isEditing ? '#60a8b8' : '#000'} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => {
            setModalVisible(true);
            setModalAddress('');
            setModalSuggestions([]);
            setEditingIndex(null);
          }}>
            <MaterialIcons name="add" size={24} color="#60a8b8" />
          </TouchableOpacity>
        </View>
        {nicAssists.length === 0 && (
          <View style={styles.settingItem}>
            <Text style={styles.AddAddress}>Add NicAssist Address</Text>
          </View>
        )}
        {nicAssists.map((assist, index) => (
          <View style={styles.settingItem} key={index}>
            <View style={styles.addressRow}>
              <Text style={styles.addressDisplay}>
                {assist.Name && assist.Name !== null ? assist.Name : assist.NicAssistAddress}
                </Text>
              <TouchableOpacity onPress={() => toggleActive(index)}>
                <MaterialIcons
                  name={assist.Active ? 'toggle-on' : 'toggle-off'}
                  size={40}
                  color={assist.Active ? '#60a8b8' : '#adadad'}
                />
              </TouchableOpacity>
            </View>
            {isEditing && (
              <View style={styles.editingContainer}>
                <TouchableOpacity
                  style={styles.renameButton}
                  onPress={() => renameAddress(index)}
                >
                  <Text style={styles.deleteText}>Rename Address</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteAddress(index)}
                >
                  <Text style={styles.deleteText}>Delete Address</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>

    {/* Existing Add Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => {
        setModalVisible(false);
        setModalAddress('');
        setModalSuggestions([]);
        setSelectedNicAssist(null);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add NicAssist Address</Text>
          <TouchableOpacity
            style={[styles.currentAddressButton, { backgroundColor: '#fff' }]}
            onPress={async () => {
              const user = auth.currentUser;
              if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  const location = data.location;
                  if (location?.latitude && location?.longitude) {
                    setSelectedNicAssist({
                      NicAssistAddress: "Current Location",
                      NicAssistLat: location.latitude,
                      NicAssistLng: location.longitude,
                      Active: true
                    });
                    setModalAddress("Current Location");
                    setModalSuggestions([]);
                  } else {
                    Alert.alert('Error', 'No location data available in Firestore.');
                  }
                }
              }
            }}
          >
            <Text style={styles.currentAddressText}>Use Current Location</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Enter your address"
            value={modalAddress}
            onChangeText={setModalAddress}
            returnKeyType="done"
            blurOnSubmit={true}
          />
          <FlatList
            data={modalSuggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleAddressSelect(item)}
                style={styles.suggestion}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>
                  {item.structured_formatting.main_text} {item.structured_formatting.secondary_text}
                </Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#60a8b8' }]}
              onPress={handleSaveAddress}
            >
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#cdcdcd' }]}
              onPress={() => {
                setModalVisible(false);
                setModalAddress('');
                setModalSuggestions([]);
                setSelectedNicAssist(null);
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* New Rename Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={isRenameModal}
      onRequestClose={() => {
        setIsRenameModal(false);
        setRenameIndex(null);
        setNewName('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Name</Text>
          {renameIndex !== null && (
            <Text style={styles.renameModalAddress}>{nicAssists[renameIndex].NicAssistAddress}</Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Enter new name" // Fixed placeholder
            value={newName}
            onChangeText={setNewName}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={saveRename}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#60a8b8' }]}
              onPress={saveRename}
            >
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#cdcdcd' }]}
              onPress={() => {
                setIsRenameModal(false);
                setRenameIndex(null);
                setNewName('');
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dcdcdc' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#000000', marginBottom: 20 },
  settingsList: { marginTop: 10 },
  subheader: { fontSize: 20, fontWeight: '600', color: '#000000' },
  nicAssistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  settingItem: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  nicQuestSpacing: { marginTop: 15 }, // Added spacing for NicQuest section only
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  settingLabel: { fontSize: 16, color: '#333' },
  selectedValue: { fontSize: 16, fontWeight: '600', color: '#4d8b9b' },
  valueButton: { paddingVertical: 8 },
  pickerWrapper: { borderRadius: 8, overflow: 'hidden' },
  pickerContainer: { borderWidth: 1, borderColor: '#60a8b8', borderRadius: 8, marginTop: 10 },
  picker: { height: Platform.OS === 'ios' ? 200 : 50, width: '100%' },
  input: { height: 50, fontSize: 16, paddingHorizontal: 10, borderWidth: 1, borderColor: '#60a8b8', borderRadius: 8, marginBottom: 10 },
  suggestion: { padding: 10, borderBottomWidth: 1, borderColor: '#60a8b8' },
  suggestionText: { color: '#000' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  addressDisplay: { fontSize: 16, color: '#333', flex: 1, marginRight: 10 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginHorizontal: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#000', marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, marginHorizontal: 10, alignItems: 'center', flex: 1 },
  modalButtonText: { color: '#fff', fontSize: 16 },
  editSection: { flexDirection: 'row', alignItems: 'center' },
  editButton: { width: 30, height: 30, marginLeft: 5 },
  deleteButton: { backgroundColor: '#cdcdcd', padding: 10, borderRadius: 5, marginTop: 5, alignItems: 'center' },
  renameButton: {backgroundColor: '#60a8b8', padding: 10, borderRadius: 5, marginTop: 5, alignItems: 'center'},
  deleteText: { color: '#fff', fontSize: 16 },
  AddAddress: {paddingTop: 10, paddingBottom: 10, fontSize: 16},
  currentAddressText: {color: '#60a8b8', fontSize: 16, fontWeight: '500', textAlign: 'center'},
  currentAddressButton: {paddingVertical: 10,borderRadius: 4,alignItems: 'flex-start',marginBottom: 10},
  editingContainer: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 5},
  renameModalAddress: {color: '#757575', fontSize: 13, fontWeight: '500', textAlign: 'flex-start', marginBottom: 10},
});
