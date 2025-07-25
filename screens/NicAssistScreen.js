import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Dimensions, Modal, FlatList, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, addDoc, setDoc } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../firebase';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

const CancelAlert = ({ visible, onOk, userId }) => {
  const [isVisible, setIsVisible] = useState(visible);
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  if (!isVisible) return null;
  return Alert.alert(
    'NicQuest Canceled',
    'The NicQuest session has been canceled.',
    [{ text: 'OK', onPress: () => {
      setIsVisible(false);
      onOk();
    }, style: 'default' }]
  );
};

export default function NicAssistScreen() {
  const route = useRoute();
  const { userAId, userBId, sessionId, nicAssistLat: initialNicAssistLat, nicAssistLng: initialNicAssistLng } = route.params || {};
  const navigation = useNavigation();
  const sessionIdRef = useRef(sessionId);
  const [userAData, setUserAData] = useState(null);
  const [userBData, setUserBData] = useState(null);
  const isUserA = auth.currentUser?.uid === userAId;
  const unsubscribeSession = useRef(null);
  const unsubscribeMessages = useRef(null);
  const unsubscribeChat = useRef(null);
  const hasNavigatedRef = useRef(false);
  const [showAlert, setShowAlert] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    let unsubscribe;
    if (!sessionIdRef.current || !userAId || !userBId || !currentUserId) {
      console.error('Invalid session or user IDs:', { sessionId: sessionIdRef.current, userAId, userBId, currentUserId });
      return;
    }
    console.log('NicAssistScreen initialized for', currentUserId, 'isUserA:', isUserA, 'sessionId:', sessionId);

    const init = async () => {
      try {
        const userADoc = await getDoc(doc(db, 'users', userAId));
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        if (!userADoc.exists() || !userBDoc.exists()) {
          console.error('User data not found:', { userAId, userBId });
          return;
        }
        setUserAData(userADoc.data());
        setUserBData(userBDoc.data());

        const userADocRef = doc(db, 'users', userAId);
        const userBDocRef = doc(db, 'users', userBId);
        await updateDoc(userADocRef, { sessionId: sessionIdRef.current }, { merge: true });
        await updateDoc(userBDocRef, { sessionId: sessionIdRef.current }, { merge: true });
        console.log('Session initialized with sessionId:', sessionIdRef.current);

        unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (docSnapshot) => {
          if (docSnapshot.exists() && !hasNavigatedRef.current) {
            const data = docSnapshot.data();
            if (data.showAlert && data.sessionId === sessionIdRef.current) {
              setShowAlert(true);
            }
          }
        }, (error) => console.error('Session status listener error:', error));

        const chatId = [userAId, userBId].sort().join('_');
        const chatDocRef = doc(db, 'chats', chatId);
        if (!(await getDoc(chatDocRef)).exists()) {
          await setDoc(chatDocRef, { participants: [userAId, userBId], unreadCount: { [userBId]: 0 }, lastMessage: null }, { merge: true });
          console.log('Chat document initialized for:', chatId);
        }

        unsubscribeMessages.current = onSnapshot(collection(db, 'chats', chatId, 'messages'), (snapshot) => {
          const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const sortedMessages = msgList.sort((a, b) => a.timestamp - b.timestamp);
          setMessages(sortedMessages);
          if (sortedMessages.length > 0 && sortedMessages[sortedMessages.length - 1].senderId !== currentUserId && !modalVisible) {
            const newCount = unreadCount + 1;
            updateDoc(chatDocRef, { 
              [`unreadCount.${currentUserId}`]: newCount,
              lastMessage: sortedMessages[sortedMessages.length - 1].text 
            }, { merge: true });
          }
        }, (error) => console.error('Message listen error:', error));

        unsubscribeChat.current = onSnapshot(chatDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            setUnreadCount(docSnapshot.data().unreadCount?.[currentUserId] || 0);
          } else {
            console.warn('Chat document not found:', chatId);
          }
        }, (error) => console.error('Chat doc listen error:', error));
      } catch (err) {
        console.error('Error initializing NicAssistScreen:', err);
      }
    };

    init();

    // Cleanup listeners on component unmount or auth change
    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeMessages.current) unsubscribeMessages.current();
      if (unsubscribeChat.current) unsubscribeChat.current();
      hasNavigatedRef.current = false;
      setShowAlert(false);
    };
  }, [userAId, userBId, sessionId, initialNicAssistLat, initialNicAssistLng]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const sendMessage = async () => {
    if (newMessage.trim()) {
      const chatId = [userAId, userBId].sort().join('_');
      const newMsgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: newMessage,
        senderId: currentUserId,
        timestamp: Date.now(),
      });
      const chatDocRef = doc(db, 'chats', chatId);
      await updateDoc(chatDocRef, { 
        lastMessage: newMessage 
      }, { merge: true });
      setNewMessage('');
    }
  };

  const handleCancel = async () => {
    try {
      const userADocRef = doc(db, 'users', userAId);
      const userBDocRef = doc(db, 'users', userBId);
      const otherUserId = isUserA ? userBId : userAId;
      if (isUserA) {
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, showAlert: false, sessionId: "" }, { merge: true });
        await updateDoc(userBDocRef, { nicAssistResponse: null, showAlert: true, sessionId: sessionIdRef.current }, { merge: true });
      } else {
        await updateDoc(userBDocRef, { nicAssistResponse: null, showAlert: false, sessionId: "" }, { merge: true });
        await updateDoc(userADocRef, { nicQuestAssistedBy: null, showAlert: true, sessionId: sessionIdRef.current }, { merge: true });
      }
      navigation.navigate('Tabs', { screen: 'Home' });
    } catch (error) {
      console.error('Error cancelling:', error);
    }
  };

  const handleAlertOk = async () => {
    await updateDoc(doc(db, 'users', currentUserId), { showAlert: false, sessionId: "" }, { merge: true });
    setModalVisible(false);
    navigation.navigate('Tabs', { screen: 'Home' });
    hasNavigatedRef.current = true;
  };

  const nicAssistLat = userBData?.NicAssists?.find(assist => assist.Active)?.NicAssistLat || initialNicAssistLat;
  const nicAssistLng = userBData?.NicAssists?.find(assist => assist.Active)?.NicAssistLng || initialNicAssistLng;

  useEffect(() => {
    if (modalVisible && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
      const chatId = [userAId, userBId].sort().join('_');
      updateDoc(doc(db, 'chats', chatId), { [`unreadCount.${currentUserId}`]: 0 }, { merge: true });
    }
  }, [modalVisible, userAId, userBId, currentUserId, messages.length]); // Added messages.length as dependency

  const closeModal = () => {
    setModalVisible(false);
    const chatId = [userAId, userBId].sort().join('_');
    updateDoc(doc(db, 'chats', chatId), { [`unreadCount.${currentUserId}`]: 0 }, { merge: true });
  };

  return (
    <View style={styles.container}>
      {userAData && userBData && nicAssistLat && nicAssistLng && (
        <View>
          <View style={styles.card}>
            <Text style={styles.title}>{isUserA ? 'NicQuest' : 'NicAssist'} Session</Text>
            <View style={styles.usersContainer}>
              <View style={styles.userCard}>
                <Image source={{ uri: userAData.photoURL }} style={styles.userPhoto} />
                <Text style={styles.roleLabel}>{isUserA ? 'You' : 'NicQuest'}</Text>
                <Text style={styles.username}>{userAData.username}</Text>
              </View>
              <View style={styles.vsContainer}><Text style={styles.vsText}>→</Text></View>
              <View style={styles.userCard}>
                <Image source={{ uri: userBData.photoURL }} style={styles.userPhoto} />
                <Text style={styles.roleLabel}>{isUserA ? 'NicAssist' : 'You'}</Text>
                <Text style={styles.username}>{userBData.username}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.chatIcon} onPress={() => setModalVisible(true)}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="chat" size={40} color="#60a8b8" />
                {unreadCount > 0 && <MaterialIcons name="priority-high" size={20} color="white" style={styles.badge} />}
              </View>
            </TouchableOpacity>
            <View style={styles.detailsContainer}>
              <Text style={styles.infoHeader}>{userBData.username}’s Info</Text>
              <View style={styles.data}>
                <View>
                  <Text style={styles.detail}>Pouch Type: <Text style={styles.detailValue}>{userBData.pouchType}</Text></Text>
                  <Text style={styles.detail}>Strength: <Text style={styles.detailValue}>{userBData.strength}</Text></Text>
                </View>
                <View>
                  <Text style={styles.detail}>Flavors: <Text style={styles.detailValue}>{userBData.flavors}</Text></Text>
                  <Text style={styles.detail}>Notes: <Text style={styles.detailValue}>{userBData.notes}</Text></Text>
                </View>
              </View>
            </View>
          </View>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (userAData.location.latitude + userBData.location.latitude + nicAssistLat) / 3,
              longitude: (userAData.location.longitude + userBData.location.longitude + nicAssistLng) / 3,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
          >
            <Marker key="userA" coordinate={{ latitude: userAData.location.latitude, longitude: userAData.location.longitude }} title={`${userAData.username}'s Location`} pinColor="blue" />
            <Marker key="userB" coordinate={{ latitude: userBData.location.latitude, longitude: userBData.location.longitude }} title={`${userBData.username}'s Location`} pinColor="#FF6347" />
            <Marker key="nicAssist" coordinate={{ latitude: nicAssistLat, longitude: nicAssistLng }} title="NicAssist Location" pinColor="green" />
          </MapView>
        </View>
      )}
      <TouchableOpacity style={styles.bottomButton} onPress={handleCancel}>
        <Text style={styles.buttonText}>{isUserA ? 'Cancel NicQuest' : 'Cancel NicAssist'}</Text>
      </TouchableOpacity>
      <CancelAlert visible={showAlert} onOk={handleAlertOk} userId={currentUserId} />
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={styles.modalContentContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity>
              <View style={styles.divider} />
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={item.senderId === currentUserId ? styles.sentMessage : styles.receivedMessage}>
                    <Text style={styles.messageText}>{item.text}</Text>
                    <Text style={styles.messageTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }}
                onLayout={() => {
                    setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                    }, 100); // delay ensures layout is complete
                }}
                />
              <View style={[styles.inputContainer, { marginBottom: keyboardVisible ? 0 : 20 }]}>
                <TextInput style={styles.messageInput} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." placeholderTextColor="#888" />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}><Text style={styles.sendButtonText}>Send</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dcdcdc', paddingHorizontal: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#60a8b8' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, marginBottom: 10 },
  usersContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userCard: { alignItems: 'center', justifyContent: 'center', width: '40%' },
  userPhoto: { width: 80, height: 80, borderRadius: 40, marginBottom: 6, backgroundColor: '#e0e0e0' },
  username: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  roleLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  vsContainer: { width: '20%', alignItems: 'center' },
  vsText: { fontSize: 45, color: '#60a8b8' },
  detailsContainer: { marginTop: 5, alignItems: 'center', width: '100%' },
  infoHeader: { fontSize: 16, fontWeight: '700', color: '#2b2b2b', marginBottom: 10, textTransform: 'capitalize' },
  data: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  detail: { fontSize: 14, color: '#555', marginVertical: 6 },
  detailValue: { fontWeight: '600', color: '#333' },
  bottomButton: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '80%', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#60a8b8', borderBottomWidth: 2, borderBottomColor: '#4d8a9b' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  map: { width: Dimensions.get('window').width - 40, height: 300, marginBottom: 20 },
  chatIcon: { alignSelf: 'center', marginVertical: 1 },
  iconContainer: { position: 'relative' },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: '#cc0808', borderRadius: '50%' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: { height: '75%', justifyContent: 'flex-end' },
  modalContent: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20 },
  closeButton: { alignSelf: 'center', paddingBottom: 10, },
  closeButtonText: { fontSize: 18, color: '#60a8b8', fontWeight: 'bold' },
  sentMessage: { backgroundColor: '#6AB8CC', padding: 10, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-end', maxWidth: '75%' },
  receivedMessage: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-start', maxWidth: '75%' },
  messageText: { fontSize: 16, color: '#333' },
  messageTime: { fontSize: 12, color: '#888', alignSelf: 'flex-end', marginTop: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', marginBottom: 20 },
  messageInput: { flex: 1, fontSize: 16, color: '#333', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f5f5f5', borderRadius: 20 },
  sendButton: { backgroundColor: '#60a8b8', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginLeft: 10 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  divider: {height: StyleSheet.hairlineWidth,backgroundColor: '#ccc',width: '100%',alignSelf: 'stretch',
},
});