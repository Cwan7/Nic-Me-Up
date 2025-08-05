import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Dimensions, Modal, FlatList, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, addDoc, setDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { getDistance } from 'geolib';

const CancelAlert = ({ visible, onOk, userId }) => {
  const [isVisible, setIsVisible] = useState(visible);
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  if (!isVisible) return null;
  return Alert.alert(
    'NicQuest Canceled',
    'The NicQuest session has been canceled.',
    [{ text: 'OK', onPress: () => { setIsVisible(false); onOk(); }, style: 'default' }]
  );
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isValidLocation = (loc) =>
  loc &&
  typeof loc.latitude === 'number' &&
  typeof loc.longitude === 'number' &&
  !isNaN(loc.latitude) &&
  !isNaN(loc.longitude);

export default function NicAssistScreen() {
  const route = useRoute();
  const { userAId, userBId, sessionId, nicAssistLat: initialNicAssistLat, nicAssistLng: initialNicAssistLng, isGroup2 } = route.params || {};
  const navigation = useNavigation();
  const sessionIdRef = useRef(sessionId);
  const [userAData, setUserAData] = useState(null);
  const [userBData, setUserBData] = useState(null);
  const isUserA = auth.currentUser?.uid === userAId;
  const unsubscribeSession = useRef(null);
  const unsubscribeMessages = useRef(null);
  const unsubscribeChat = useRef(null);
  const unsubscribeLocationA = useRef(null);
  const unsubscribeLocationB = useRef(null);
  const hasNavigatedRef = useRef(false);
  const [showAlert, setShowAlert] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const currentUserId = auth.currentUser?.uid;
  const [userALocation, setUserALocation] = useState(null); // Changed to null
  const [userBLocation, setUserBLocation] = useState(null); // Changed to null
  const hasLoggedActivityRef = useRef(false);
  const isCheckingRef = useRef(false);
  const [nicAssistLat, setNicAssistLat] = useState(initialNicAssistLat);
  const [nicAssistLng, setNicAssistLng] = useState(initialNicAssistLng);
  const lastActiveIntervalRef = useRef(null);

  // Calculate questDistance from UserA data
  const userADocRef = doc(db, 'users', userAId);
  const userADoc = useRef(null);
  useEffect(() => {
    const fetchUserAData = async () => {
      userADoc.current = await getDoc(userADocRef);
      if (userADoc.current.exists()) {
        setUserAData(userADoc.current.data());
      }
    };
    fetchUserAData();
  }, [userAId]);
  const questDistance = (userAData?.nicQuestDistance || 250) * 0.3048;

  // Update nicAssistLat and nicAssistLng based on group
  useEffect(() => {
    if (isGroup2 && userBLocation?.latitude && userBLocation?.longitude) {
      setNicAssistLat(userBLocation.latitude);
      setNicAssistLng(userBLocation.longitude);
    } else if (!isGroup2 && userBData?.NicAssists?.length > 0) {
      const activeAssist = userBData.NicAssists.find(assist => assist.Active && calculateDistance(userALocation?.latitude || initialNicAssistLat, userALocation?.longitude || initialNicAssistLng, assist.NicAssistLat, assist.NicAssistLng) <= questDistance);
      if (activeAssist) {
        setNicAssistLat(activeAssist.NicAssistLat);
        setNicAssistLng(activeAssist.NicAssistLng);
      }
    }
  }, [isGroup2, userBLocation, userBData, userALocation, questDistance, initialNicAssistLat, initialNicAssistLng]);

  const PROXIMITY_THRESHOLD = 3;

  const checkProximityAndUpdate = useCallback(async () => {
    console.log("🛠️ userALocation before proximity check:", userALocation);
    console.log("🛠️ userBLocation before proximity check:", userBLocation);
    if (
      !userAId ||
      !userBId ||
      !sessionId ||
      !isValidLocation(userALocation) ||
      !isValidLocation(userBLocation) ||
      hasLoggedActivityRef.current ||
      isCheckingRef.current ||
      userAId === userBId
    ) {
      console.log("⛔ Proximity check skipped:", {
        userAId, userBId, sessionId, userALocation, userBLocation,
        hasLoggedActivityRef: hasLoggedActivityRef.current,
        isCheckingRef: isCheckingRef.current,
        userAIdEqualsUserBId: userAId === userBId
      });
      return;
    }

    isCheckingRef.current = true;
    const latA = userALocation.latitude;
    const lngA = userALocation.longitude;
    const latB = userBLocation.latitude;
    const lngB = userBLocation.longitude;

    // Check if locations are identical
    if (latA === latB && lngA === lngB) {
      console.log("❌ Skipping proximity logging — locations are identical");
      isCheckingRef.current = false;
      return;
    }

    const distance = getDistance(
      { latitude: parseFloat(latA), longitude: parseFloat(lngA) },
      { latitude: parseFloat(latB), longitude: parseFloat(lngB) }
    );
    console.log(`📏 Calculated distance: ${distance.toFixed(2)} meters between ${userAId} and ${userBId}`);
    console.log('🔍 Comparing locations:', { userA: userALocation, userB: userBLocation });

    if (distance <= PROXIMITY_THRESHOLD) {
      console.log(`📏 Users are within ${PROXIMITY_THRESHOLD} meters!`);
      hasLoggedActivityRef.current = true;

      const activityEntry = { userAId, userBId, sessionId, timestamp: Date.now() };

      const recentActivitiesRef = doc(db, 'recentActivities', 'allActivities');
      const currentUserRef = doc(db, 'users', currentUserId);

      try {
        const recentSnap = await getDoc(recentActivitiesRef);
        const existing = recentSnap.exists() ? recentSnap.data().activities || [] : [];
        const recentHasSession = existing.some((a) => a.sessionId === sessionId);

        if (!recentHasSession) {
          await updateDoc(recentActivitiesRef, { activities: [activityEntry, ...existing] });
          console.log(`✅ Logged recent activity to Firestore with threshold ${PROXIMITY_THRESHOLD} meters`);
        } else {
          console.log('⚠️ Session already in recentActivities, skipping');
        }

        const currentUserSnap = await getDoc(currentUserRef);
        const currentUserActivities = currentUserSnap.exists() ? currentUserSnap.data().yourActivity || [] : [];
        const currentUserHasSession = currentUserActivities.some((a) => a.sessionId === sessionId);

        if (!currentUserHasSession) {
          await updateDoc(currentUserRef, { yourActivity: arrayUnion(activityEntry) });
          console.log(`✅ Added activity to ${currentUserId}`);
        } else {
          console.log(`⚠️ Session already exists for ${currentUserId}, skipping`);
        }
      } catch (err) {
        console.error('🔥 Proximity log error:', err);
      }
    } else {
      console.log(`⚠️ Users are beyond ${PROXIMITY_THRESHOLD} meters, no action taken`);
    }
    isCheckingRef.current = false;
  }, [userAId, userBId, sessionId, userALocation, userBLocation, currentUserId]);

  useEffect(() => {
    if (userALocation?.latitude && userBLocation?.latitude) {
      const timeoutId = setTimeout(() => checkProximityAndUpdate(), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [checkProximityAndUpdate, userALocation, userBLocation]);

  useEffect(() => {
    if (!sessionIdRef.current || !userAId || !userBId || !currentUserId) {
      return;
    }

    let firstLoad = true;

    const init = async () => {
      try {
        if (currentUserId !== userAId && currentUserId !== userBId) return;
        if (!userAId || !userBId) return;
        const userADoc = await getDoc(doc(db, 'users', userAId));
        const userBDoc = await getDoc(doc(db, 'users', userBId));
        if (!userADoc.exists() || !userBDoc.exists()) return;
        setUserAData(userADoc.data());
        setUserBData(userBDoc.data());

        const userADocRef = doc(db, 'users', userAId);
        const userBDocRef = doc(db, 'users', userBId);
        await updateDoc(userADocRef, { sessionId: sessionIdRef.current, lastActive: Date.now() }, { merge: true });
        await updateDoc(userBDocRef, { sessionId: sessionIdRef.current, lastActive: Date.now() }, { merge: true });

        const updateLastActive = async () => {
          if (!lastActiveIntervalRef.current) return;
          const currentUserRef = doc(db, 'users', currentUserId);
          await updateDoc(currentUserRef, { lastActive: Date.now() }, { merge: true });
          console.log(`⏰ Updated lastActive for ${currentUserId} at ${new Date(Date.now()).toISOString()} from NAS`);
        };
        lastActiveIntervalRef.current = setInterval(updateLastActive, 10000);

        unsubscribeSession.current = onSnapshot(doc(db, 'users', currentUserId), (docSnapshot) => {
          if (docSnapshot.exists() && !hasNavigatedRef.current) {
            const data = docSnapshot.data();
            if (data.showAlert && data.sessionId === sessionIdRef.current) {
              setShowAlert(true);
            }
          }
        }, (error) => console.error('Session status listener error for user:', currentUserId, error));

        const chatId = [userAId, userBId].sort().join('_');
        const chatDocRef = doc(db, 'chats', chatId);

        const createAndVerifyChat = async (attempt = 0) => {
          if (attempt > 3) return;
          try {
            let chatDoc;
            try { chatDoc = await getDoc(chatDocRef); } catch (getDocError) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await createAndVerifyChat(attempt + 1);
              return;
            }
            if (!chatDoc.exists()) {
              await setDoc(chatDocRef, { participants: [userAId, userBId], unreadCount: { [userBId]: 0, [userAId]: 0 }, lastMessage: null }, { merge: true });
              let retries = 0;
              while (retries < 5) {
                const latestChatDoc = await getDoc(chatDocRef);
                const participants = latestChatDoc.data()?.participants || [];
                if (participants.includes(currentUserId)) break;
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
              }
            }
            const verifiedChatDoc = await getDoc(chatDocRef);
            if (!verifiedChatDoc.exists() || !verifiedChatDoc.data().participants.includes(currentUserId)) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await createAndVerifyChat(attempt + 1);
              return;
            }
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await createAndVerifyChat(attempt + 1);
          }
        };
        await createAndVerifyChat();

        const attachListeners = async (attempt = 0) => {
          if (attempt > 3) return;
          try {
            const docSnap = await getDoc(chatDocRef);
            if (docSnap.exists() && docSnap.data().participants.includes(currentUserId)) {
              unsubscribeMessages.current = onSnapshot(collection(db, 'chats', chatId, 'messages'), (snapshot) => {
                const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const sortedMessages = msgList.sort((a, b) => a.timestamp - b.timestamp);
                setMessages(sortedMessages);
                if (sortedMessages.length > 0 && sortedMessages[sortedMessages.length - 1].senderId !== currentUserId && !modalVisible) {
                  const newCount = unreadCount + 1;
                  updateDoc(chatDocRef, { [`unreadCount.${currentUserId}`]: newCount, lastMessage: sortedMessages[sortedMessages.length - 1].text }, { merge: true });
                }
              }, (error) => console.error('Message listen error for user:', currentUserId, error));

              unsubscribeChat.current = onSnapshot(chatDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                  const data = docSnapshot.data();
                  setUnreadCount(data.unreadCount?.[currentUserId] || 0);
                  if (firstLoad && data.unreadCount?.[currentUserId] > 0) {
                    updateDoc(chatDocRef, { [`unreadCount.${currentUserId}`]: 0 }, { merge: true });
                    firstLoad = false;
                  }
                }
              }, (error) => console.error('Chat doc listen error for user:', currentUserId, error));
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await attachListeners(attempt + 1);
            }
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await attachListeners(attempt + 1);
          }
        };
        await attachListeners();

        unsubscribeLocationA.current = onSnapshot(doc(db, 'users', userAId), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.location) {
              setUserALocation(data.location);
              console.log(`📍 userA Location updated: ${data.location.latitude}, ${data.location.longitude}`);
            }
          }
        }, (error) => console.error('Location A listener error:', error));

        unsubscribeLocationB.current = onSnapshot(doc(db, 'users', userBId), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.location) {
              setUserBLocation(data.location);
              console.log(`📍 userB Location updated: ${data.location.latitude}, ${data.location.longitude}`);
            }
          }
        }, (error) => console.error('Location B listener error:', error));

      } catch (err) {
        console.error('Error in NicAssistScreen initialization for user:', currentUserId, err.message, err.stack);
      }
    };

    init();

    return () => {
      if (unsubscribeSession.current) unsubscribeSession.current();
      if (unsubscribeMessages.current) unsubscribeMessages.current();
      if (unsubscribeChat.current) unsubscribeChat.current();
      if (unsubscribeLocationA.current) unsubscribeLocationA.current();
      if (unsubscribeLocationB.current) unsubscribeLocationB.current();
      hasNavigatedRef.current = false;
      setShowAlert(false);
      if (lastActiveIntervalRef.current) {
        clearInterval(lastActiveIntervalRef.current);
        lastActiveIntervalRef.current = null;
        console.log(`🧹 Cleared lastActiveInterval for ${currentUserId}`);
      }
    };
  }, [userAId, userBId, sessionId, initialNicAssistLat, initialNicAssistLng]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (unsubscribeSession.current) unsubscribeSession.current();
        if (unsubscribeMessages.current) unsubscribeMessages.current();
        if (unsubscribeChat.current) unsubscribeChat.current();
        if (unsubscribeLocationA.current) unsubscribeLocationA.current();
        if (unsubscribeLocationB.current) unsubscribeLocationB.current();
        hasNavigatedRef.current = false;
        setShowAlert(false);
        if (lastActiveIntervalRef.current) {
          clearInterval(lastActiveIntervalRef.current);
          lastActiveIntervalRef.current = null;
          console.log(`🧹 Cleared lastActiveInterval in useFocusEffect for ${currentUserId}`);
        }
      };
    }, [])
  );

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
      await updateDoc(chatDocRef, { lastMessage: newMessage }, { merge: true });
      setNewMessage('');
    }
  };

  const handleCancel = async () => {
    try {
      const userADocRef = doc(db, 'users', userAId);
      const userBDocRef = doc(db, 'users', userBId);

      if (unsubscribeLocationA.current) unsubscribeLocationA.current();
      if (unsubscribeLocationB.current) unsubscribeLocationB.current();
      if (unsubscribeSession.current) unsubscribeSession.current();
      if (lastActiveIntervalRef.current) {
        clearInterval(lastActiveIntervalRef.current);
        lastActiveIntervalRef.current = null;
        console.log(`🧹 Cleared lastActiveInterval for ${currentUserId} on cancel`);
      }

      if (isUserA) {
        await updateDoc(userADocRef, {
          lastActive: null,
          nicQuestAssistedBy: null,
          showAlert: false,
          sessionId: "",
        }, { merge: true });
        await updateDoc(userBDocRef, {
          nicAssistResponse: null,
          showAlert: true,
          sessionId: sessionIdRef.current
        }, { merge: true });
      } else {
        await updateDoc(userBDocRef, {
          lastActive: null,
          nicAssistResponse: null,
          showAlert: false,
          sessionId: "",
        }, { merge: true });
        await updateDoc(userADocRef, {
          nicQuestAssistedBy: null,
          showAlert: true,
          sessionId: sessionIdRef.current
        }, { merge: true });
      }
      navigation.navigate('Tabs', { screen: 'Home' });
    } catch (error) {
      console.error('Error cancelling:', error);
    }
  };

  const handleAlertOk = async () => {
    await updateDoc(doc(db, 'users', currentUserId), { lastActive: null, showAlert: false, sessionId: "" }, { merge: true });
    setModalVisible(false);
    navigation.navigate('Tabs', { screen: 'Home' });
    hasNavigatedRef.current = true;
  };

  useEffect(() => {
    if (modalVisible && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      const chatId = [userAId, userBId].sort().join('_');
      updateDoc(doc(db, 'chats', chatId), { [`unreadCount.${currentUserId}`]: 0 }, { merge: true });
    }
  }, [modalVisible, userAId, userBId, currentUserId, messages.length]);

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
                {userAData.photoURL ? (
                  <Image source={{ uri: userAData.photoURL }} style={styles.userPhoto} />
                ) : (
                  <View style={[styles.userPhoto, { backgroundColor: '#60a8b8' }]}>
                    <Text style={styles.userPhotoText}>
                      {userAData.username ? userAData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <Text style={styles.roleLabel}>{isUserA ? 'You' : 'NicQuest'}</Text>
                <Text style={styles.username}>{userAData.username || 'Unknown'}</Text>
              </View>
              <View style={styles.vsContainer}><Text style={styles.vsText}>→</Text></View>
              <View style={styles.userCard}>
                {userBData.photoURL ? (
                  <Image source={{ uri: userBData.photoURL }} style={styles.userPhoto} />
                ) : (
                  <View style={[styles.userPhoto, { backgroundColor: '#60a8b8' }]}>
                    <Text style={styles.userPhotoText}>
                      {userBData.username ? userBData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <Text style={styles.roleLabel}>{isUserA ? 'NicAssist' : 'You'}</Text>
                <Text style={styles.username}>{userBData.username || 'Unknown'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.chatIcon} onPress={() => setModalVisible(true)}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="chat" size={40} color="#60a8b8" />
                {unreadCount > 0 && <MaterialIcons name="priority-high" size={20} color="white" style={styles.badge} />}
              </View>
            </TouchableOpacity>
            <View style={styles.detailsContainer}>
              <Text style={styles.infoHeader}>{userBData.username || 'User'}’s Info</Text>
              <View style={styles.data}>
                <View>
                  <Text style={styles.detail}>Pouch Type: <Text style={styles.detailValue}>{userBData.pouchType || 'N/A'}</Text></Text>
                  <Text style={styles.detail}>Strength: <Text style={styles.detailValue}>{userBData.strength || 'N/A'}</Text></Text>
                </View>
                <View>
                  <Text style={styles.detail}>Flavors: <Text style={styles.detailValue}>{userBData.flavors || 'N/A'}</Text></Text>
                  <Text style={styles.detail}>Notes: <Text style={styles.detailValue}>{userBData.notes || 'N/A'}</Text></Text>
                </View>
              </View>
            </View>
          </View>
          {isValidLocation(userALocation) && isValidLocation(userBLocation) && (
            <MapView
            style={styles.map}
            initialRegion={{
              latitude: (userALocation.latitude + userBLocation.latitude + nicAssistLat) / 3,
              longitude: (userALocation.longitude + userBLocation.longitude + nicAssistLng) / 3,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
          >
            {userALocation.latitude && userALocation.longitude && (
              <Marker
                key="userA"
                coordinate={userALocation}
                title={`${userAData?.username || 'User A'}'s Location`}
              >
                {userAData?.photoURL ? (
                  <Image
                    source={{ uri: userAData.photoURL }}
                    style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}
                  />
                ) : (
                  <View
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#60a8b8', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
                      {userAData?.username ? userAData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
              </Marker>
            )}
            {userBLocation.latitude && userBLocation.longitude && (
              <Marker
                key="userB"
                coordinate={userBLocation}
                title={`${userBData?.username || 'User B'}'s Location`}
              >
                {userBData?.photoURL ? (
                  <Image
                    source={{ uri: userBData.photoURL }}
                    style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}
                  />
                ) : (
                  <View
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#60a8b8', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
                      {userBData?.username ? userBData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
              </Marker>
            )}
            <Marker
              key="nicAssist"
              coordinate={{ latitude: nicAssistLat, longitude: nicAssistLng }}
              title="NicAssist Location"
              pinColor="#60a8b8"
            />
          </MapView>
          )}
          
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
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
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
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100)}
              />
              <View style={[styles.inputContainer, { marginBottom: keyboardVisible ? 0 : 20 }]}>
                <TextInput
                  style={styles.messageInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  placeholderTextColor="#888"
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
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
  userPhoto: { width: 80, height: 80, borderRadius: 40, marginBottom: 6, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  userPhotoText: { color: 'white', fontWeight: 'bold', fontSize: 24 },
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
  closeButton: { alignSelf: 'center', paddingBottom: 10 },
  closeButtonText: { fontSize: 18, color: '#60a8b8', fontWeight: 'bold' },
  sentMessage: { backgroundColor: '#6AB8CC', padding: 10, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-end', maxWidth: '75%' },
  receivedMessage: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-start', maxWidth: '75%' },
  messageText: { fontSize: 16, color: '#333' },
  messageTime: { fontSize: 12, color: '#888', alignSelf: 'flex-end', marginTop: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', marginBottom: 20 },
  messageInput: { flex: 1, fontSize: 16, color: '#333', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f5f5f5', borderRadius: 20 },
  sendButton: { backgroundColor: '#60a8b8', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginLeft: 10 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ccc', width: '100%', alignSelf: 'stretch' },
});