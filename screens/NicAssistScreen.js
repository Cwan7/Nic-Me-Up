import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Dimensions, Modal, FlatList, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp, collection, addDoc, setDoc, arrayUnion, increment, query, where, getDocs } from 'firebase/firestore';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { getDistance } from 'geolib';
import { AirbnbRating } from 'react-native-ratings';


const CancelAlert = ({ visible, onOk }) => {
  useEffect(() => {
    if (visible) {
      console.log("🚨 Alert shown once");
      Alert.alert(
        "NicQuest Canceled",
        "The NicQuest session has been canceled.",
        [
          {
            text: "OK",
            onPress: () => {
              onOk(); 
            },
          },
        ]
      );
    }
  }, [visible]);
  return null;
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
  const { userAId, userBId, sessionId, nicAssistLat: initialNicAssistLat, nicAssistLng: initialNicAssistLng, isGroup2, userAPhoto, userBPhoto } = route.params || {};
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
  const isMountedRef = useRef(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const currentUserId = auth.currentUser?.uid;
  const [userALocation, setUserALocation] = useState(null);
  const [userBLocation, setUserBLocation] = useState(null);
  const hasLoggedActivityRef = useRef(false);
  const isCheckingRef = useRef(false);
  const [nicAssistLat, setNicAssistLat] = useState(initialNicAssistLat);
  const [nicAssistLng, setNicAssistLng] = useState(initialNicAssistLng);
  const [alertShown, setAlertShown] = useState(false);
  const heartbeatIntervalRef = useRef(null);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const proximityTimerRef = useRef(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0)
  const targetUserId = isUserA ? userBId : userAId;
  const [showCancelAlert, setShowCancelAlert] = useState(false)
  const [userAProfile, setUserAProfile] = useState(null);
  const [userBProfile, setUserBProfile] = useState(null);

  const userADocRef = doc(db, 'users', userAId);
  const userADoc = useRef(null);

//UseEffect for fetching profileURL's faster
useEffect(() => {
  const loadProfiles = async () => {
    if (!userAPhoto) {
      const userADoc = await getDoc(doc(db, 'users', userAId));
      setUserAProfile(userADoc.data());
    } else {
      setUserAProfile({ photoURL: userAPhoto });
    }

    if (!userBPhoto) {
      const userBDoc = await getDoc(doc(db, 'users', userBId));
      setUserBProfile(userBDoc.data());
    } else {
      setUserBProfile({ photoURL: userBPhoto });
    }
  };

  loadProfiles();
}, [userAId, userBId, userAPhoto, userBPhoto]);
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

const startHeartbeat = (sessionId, userRole) => {
  const sessionRef = doc(db, 'nicSessions', sessionId);
  return heartbeatIntervalRef.current = setInterval(() => {
    updateDoc(sessionRef, {
      [userRole === 'userA' ? 'userAActiveAt' : 'userBActiveAt']: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("🆕 Heartbeat interval set for", currentUserId);
  }, 10000); 
};

async function submitRating(targetUserId, rating) {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        ratings: {
          sum: rating,
          count: 1,
          average: rating
        }
      }, { merge: true });
      return;
    }
    if (!snap.data().ratings) {
      await updateDoc(userRef, {
        ratings: {
          sum: rating,
          count: 1,
          average: rating
        }
      });
      return;
    }
    await updateDoc(userRef, {
      'ratings.sum': increment(rating),
      'ratings.count': increment(1)
    });

    // Get updated data to recalculate average
    const updatedSnap = await getDoc(userRef);
    const updatedRatings = updatedSnap.data().ratings || { sum: 0, count: 1 };
    const avg = (updatedRatings.sum / updatedRatings.count).toFixed(2);

    await updateDoc(userRef, {
      'ratings.average': Number(avg)
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
  }
}


const handleCompletion = async () => {
  console.log(`✅ Completed Button pressed ${currentUserId}`);
  try {
    const sessionRef = doc(db, 'nicSessions', sessionIdRef.current);

    // Mark session completed
    await updateDoc(sessionRef, {
      status: 'completed',
      completedBy: currentUserId,
      completedAt: serverTimestamp(),
      active: false
    });

    // Cleanup NicMeUp fields for both users
    const userARef = doc(db, 'users', userAId);
    const userBRef = doc(db, 'users', userBId);

    const nicMeUpDefaults = {
      'NicMeUp.nicAssistResponse': null,
      'NicMeUp.nicQuestAssistedBy': null,
      'NicMeUp.sessionId': '',
    };

    await Promise.all([
      updateDoc(userARef, nicMeUpDefaults),
      updateDoc(userBRef, nicMeUpDefaults)
    ]);

    // Local cleanup
    if (unsubscribeLocationA.current) unsubscribeLocationA.current();
    if (unsubscribeLocationB.current) unsubscribeLocationB.current();
    if (unsubscribeSession.current) unsubscribeSession.current();
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setShowRatingModal(true);
  } catch (error) {
    console.error('Error completing session:', error);
  }
};


useEffect(() => {
  if (!sessionId || !userAId || !userBId || !currentUserId) return;

  const userRole = currentUserId === userAId ? "userA" : "userB";
  const intervalId = startHeartbeat(sessionId, userRole);
  heartbeatIntervalRef.current = intervalId;

  const sessionRef = doc(db, "nicSessions", sessionId);
  const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.log("⚠️ Session deleted");
      clearInterval(intervalId);
      heartbeatIntervalRef.current = null;
      setShowCancelAlert(true); // fallback if doc is gone
      return;
    }

    const data = snapshot.data();

    if (data.active === false) {
      console.log("🛑 Session inactive — stopping heartbeat");
      clearInterval(intervalId);
      heartbeatIntervalRef.current = null;

      if (data.status === "completed") {
        console.log("✅ Session completed — no cancel alert");
        // you could set another state here like setShowCompletionPrompt(false)
      } else if (data.canceledBy && data.canceledBy !== currentUserId) {
        console.log(`🚨 Session canceled by ${data.canceledBy}`);
        setShowCancelAlert(true); // show alert only if someone else or Cloud canceled
      } else {
        console.log("👋 Session ended by current user — no alert");
      }
    }
  });

  return () => {
    clearInterval(intervalId);
    heartbeatIntervalRef.current = null;
    unsubscribe();
    console.log("🧹 Cleaned up heartbeat + session listener");
  };
}, [sessionId, userAId, userBId, currentUserId]);



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
  if (!isMountedRef.current) return;
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
    console.log("⛔ Proximity check skipped:")
    return;
  }

  isCheckingRef.current = true;
  const latA = userALocation.latitude;
  const lngA = userALocation.longitude;
  const latB = userBLocation.latitude;
  const lngB = userBLocation.longitude;

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

  // === New 5-second completion prompt logic ===
  if (distance <= 3) {
    if (!proximityTimerRef.current) {
      console.log("⏳ Within 3m — starting 5s completion timer...");
      proximityTimerRef.current = setTimeout(() => {
        setShowCompletionPrompt(true); 
        console.log("✅ 1s hold met — showing completion prompt");
      }, 1000);
    }
  } 

  // === Existing logging logic ===
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
  }
  isCheckingRef.current = false;
}, [userAId, userBId, sessionId, userALocation, userBLocation, currentUserId, showCompletionPrompt]);

useEffect(() => {
  if (!isMountedRef.current) return; // skip if unmounted
  if (userALocation?.latitude && userBLocation?.latitude) {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) checkProximityAndUpdate();
    }, 500);
    return () => clearTimeout(timeoutId);
  }
}, [checkProximityAndUpdate, userALocation, userBLocation]);

useEffect(() => {
  isMountedRef.current = true;

  return () => {
    isMountedRef.current = false;
    // Clear any pending 5-second proximity timers
    if (proximityTimerRef.current) {
      clearTimeout(proximityTimerRef.current);
      proximityTimerRef.current = null;
    }
  };
}, []);
useEffect(() => {
  if (!userAId || !userBId || !currentUserId) return;

  let firstLoad = true;

  const init = async () => {
    try {
      if (currentUserId !== userAId && currentUserId !== userBId) return;

      // Fetch userA & userB data
      const [userADoc, userBDoc] = await Promise.all([
        getDoc(doc(db, 'users', userAId)),
        getDoc(doc(db, 'users', userBId))
      ]);
      if (!userADoc.exists() || !userBDoc.exists()) return;

      const userAData = userADoc.data();
      const userBData = userBDoc.data();

      setUserAData(userAData);
      setUserBData(userBData);
      // Chat setup
      const chatId = [userAId, userBId].sort().join('_');
      const chatDocRef = doc(db, 'chats', chatId);

      const createChatIfNotExists = async (attempt = 0) => {
        if (attempt > 3) return;

        try {
          const chatDoc = await getDoc(chatDocRef);
          if (!chatDoc.exists()) {
            await setDoc(chatDocRef, {
              participants: [userAId, userBId],
              unreadCount: { [userAId]: 0, [userBId]: 0 },
              lastMessage: null
            }, { merge: true });
          }
          const verifiedDoc = await getDoc(chatDocRef);
          if (!verifiedDoc.exists() || !verifiedDoc.data().participants.includes(currentUserId)) {
            await new Promise(r => setTimeout(r, 2000));
            await createChatIfNotExists(attempt + 1);
          }
        } catch {
          await new Promise(r => setTimeout(r, 2000));
          await createChatIfNotExists(attempt + 1);
        }
      };

      await createChatIfNotExists();

      // Attach chat listeners
      const attachChatListeners = async (attempt = 0) => {
        if (attempt > 3) return;

        try {
          const chatSnap = await getDoc(chatDocRef);
          if (!chatSnap.exists() || !chatSnap.data().participants.includes(currentUserId)) {
            await new Promise(r => setTimeout(r, 2000));
            return attachChatListeners(attempt + 1);
          }

          unsubscribeMessages.current = onSnapshot(
            collection(db, 'chats', chatId, 'messages'),
            (snapshot) => {
              const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              const sortedMessages = msgList.sort((a, b) => a.timestamp - b.timestamp);
              setMessages(sortedMessages);
              if (
                sortedMessages.length > 0 &&
                sortedMessages[sortedMessages.length - 1].senderId !== currentUserId &&
                !modalVisible
              ) {
                const newCount = unreadCount + 1;
                updateDoc(chatDocRef, {
                  [`unreadCount.${currentUserId}`]: newCount,
                  lastMessage: sortedMessages[sortedMessages.length - 1].text
                }, { merge: true });
              }
            },
            (error) => console.error('Message listen error:', error)
          );

          unsubscribeChat.current = onSnapshot(chatDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              setUnreadCount(data.unreadCount?.[currentUserId] || 0);
              if (firstLoad && data.unreadCount?.[currentUserId] > 0) {
                updateDoc(chatDocRef, { [`unreadCount.${currentUserId}`]: 0 }, { merge: true });
                firstLoad = false;
              }
            }
          });
        } catch {
          await new Promise(r => setTimeout(r, 2000));
          await attachChatListeners(attempt + 1);
        }
      };

      await attachChatListeners();

      // Location listeners
      unsubscribeLocationA.current = onSnapshot(doc(db, 'users', userAId), (docSnapshot) => {
        const data = docSnapshot.data();
        if (data?.location) {
          setUserALocation(data.location);
          console.log(`📍 userA Location updated: ${data.location.latitude}, ${data.location.longitude}`);
        }
      });

      unsubscribeLocationB.current = onSnapshot(doc(db, 'users', userBId), (docSnapshot) => {
        const data = docSnapshot.data();
        if (data?.location) {
          setUserBLocation(data.location);
          console.log(`📍 userB Location updated: ${data.location.latitude}, ${data.location.longitude}`);
        }
      });

    } catch (err) {
      console.error('❌ Error in NicAssistScreen useEffect:', err.message, err.stack);
    }
  };

  init();

  return () => {
    if (unsubscribeMessages.current) unsubscribeMessages.current();
    if (unsubscribeChat.current) unsubscribeChat.current();
    if (unsubscribeLocationA.current) unsubscribeLocationA.current();
    if (unsubscribeLocationB.current) unsubscribeLocationB.current();
    hasNavigatedRef.current = false;
  };
}, [userAId, userBId, sessionId, currentUserId]);


useFocusEffect(
  useCallback(() => {
    return () => {
      
      if (unsubscribeMessages.current) unsubscribeMessages.current();
      if (unsubscribeChat.current) unsubscribeChat.current();
      if (unsubscribeLocationA.current) unsubscribeLocationA.current();
      if (unsubscribeLocationB.current) unsubscribeLocationB.current();
      hasNavigatedRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        console.log(`🧹 Cleared heartbeat interval in useFocusEffect for ${currentUserId}`);
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
  console.log(`❌ Canceled ${currentUserId}`);
  try {
    const userADocRef = doc(db, 'users', userAId);
    const userBDocRef = doc(db, 'users', userBId);
    const sessionRef = doc(db, 'nicSessions', sessionIdRef.current);

    // Clean up listeners
    if (unsubscribeLocationA.current) {
      unsubscribeLocationA.current();
      console.log(`🧹 Unsubscribed location listener for userA (${userAId}) on cancel`);
    }
    if (unsubscribeLocationB.current) {
      unsubscribeLocationB.current();
      console.log(`🧹 Unsubscribed location listener for userB (${userBId}) on cancel`);
    }
    if (unsubscribeSession.current) {
      unsubscribeSession.current();
      console.log(`🧹 Unsubscribed session listener on cancel`);
    }
    if (heartbeatIntervalRef.current) {
      console.log("🕒 heartbeatIntervalRef before cancel:", heartbeatIntervalRef.current);
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log(`🧹 Cleared heartbeat interval for ${currentUserId} on cancel`);
    }


    // Fetch latest user data
    const userAData = (await getDoc(userADocRef)).data();
    const userBData = (await getDoc(userBDocRef)).data();

    if (isUserA) {
      // User A cancels
      await updateDoc(userADocRef, {
        NicMeUp: {
          ...userAData?.NicMeUp || {},
          nicQuestAssistedBy: null,
          sessionId: ""
        }
      }, { merge: true });

      await updateDoc(userBDocRef, {
        NicMeUp: {
          ...userBData?.NicMeUp || {},
          nicAssistResponse: null,
          sessionId: sessionIdRef.current
        }
      }, { merge: true });

    } else {
      // User B cancels
      await updateDoc(userBDocRef, {
        NicMeUp: {
          ...userBData?.NicMeUp || {},
          nicAssistResponse: null,
          sessionId: ""
        }
      }, { merge: true });

      await updateDoc(userADocRef, {
        NicMeUp: {
          ...userAData?.NicMeUp || {},
          nicQuestAssistedBy: null,
          sessionId: sessionIdRef.current
        }
      }, { merge: true });
    }

    // Mark the session inactive
    await updateDoc(sessionRef, {
      active: false,
      canceledAt: new Date(),
      canceledBy: currentUserId
    });

    navigation.navigate('Tabs', { screen: 'Home' });

  } catch (error) {
    console.error('❌ Error cancelling NicQuest session:', error);
  }
};


const handleAlertOk = async () => {
  try {
    console.log(`🟦 Alert OK ${currentUserId}`);

    const currentUserRef = doc(db, 'users', currentUserId);
    const currentUserDoc = await getDoc(currentUserRef);
    const currentUserData = currentUserDoc.data();

    // Cleanup NicMeUp fields
    await updateDoc(currentUserRef, {
      NicMeUp: {
        ...currentUserData?.NicMeUp || {},
        sessionId: "",
        nicAssistResponse: null,
        nicQuestAssistedBy: null,
      }
    }, { merge: true });

    setModalVisible(false);
    setAlertShown(false); // Reset alertShown after OK
    navigation.navigate('Tabs', { screen: 'Home' });
    hasNavigatedRef.current = true;

  } catch (error) {
    console.error('❌ handleAlertOk error:', error);
  }
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
                {userAProfile?.photoURL ? (
                  <Image source={{ uri: userAProfile.photoURL }} style={styles.userPhoto} />
                ) : (
                  <View style={[styles.userPhoto, { backgroundColor: '#60a8b8' }]}>
                    <Text style={styles.userPhotoText}>
                      {userAData?.username ? userAData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <Text style={styles.roleLabel}>{isUserA ? 'You' : 'NicQuest'}</Text>
                <Text style={styles.username}>{userAData?.username || 'Unknown'}</Text>
              </View>

              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>→</Text>
              </View>

              <View style={styles.userCard}>
                {userBProfile?.photoURL ? (
                  <Image source={{ uri: userBProfile.photoURL }} style={styles.userPhoto} />
                ) : (
                  <View style={[styles.userPhoto, { backgroundColor: '#60a8b8' }]}>
                    <Text style={styles.userPhotoText}>
                      {userBData?.username ? userBData.username[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <Text style={styles.roleLabel}>{isUserA ? 'NicAssist' : 'You'}</Text>
                <Text style={styles.username}>{userBData?.username || 'Unknown'}</Text>
              </View>

            </View>
            <TouchableOpacity style={styles.chatIcon} onPress={() => setModalVisible(true)}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="chat" size={40} color="#60a8b8" />
                {unreadCount > 0 && <MaterialIcons name="priority-high" size={20} color="white" style={styles.badge} />}
              </View>
            </TouchableOpacity>
            <View style={styles.detailsContainer}>
              {showCompletionPrompt ? (
                <>
                  <Text style={styles.completedHeader}>
                    {currentUserId === userAId ? 'NicQuest Completed?' : 'NicAssist Completed?'}
                  </Text>
                  <TouchableOpacity
                    style={styles.completedButton}
                    onPress={handleCompletion}
                  >
                    <Text style={styles.completedText}>Yes</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
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
                </>
              )}
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
      <CancelAlert visible={showCancelAlert} onOk={handleAlertOk} userId={currentUserId} />
      {/* Ratings Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.ratingModalContainer}>
          <View style={styles.ratingModalContent}>
            <Text style={styles.ratingModalTitle}>
              {currentUserId === userAId ? 'How was your NicQuest?' : 'How was your NicAssist?'}
            </Text>

            {(!isUserA ? userAData?.photoURL : userBData?.photoURL) ? (
              <View style={styles.ratingOuterZynBorder}>
                <View style={styles.ratingInnerWhiteBorder}>
                  <Image
                    source={{ uri: !isUserA ? userAData.photoURL : userBData.photoURL }}
                    style={styles.ratingProfilePhoto}
                    resizeMode="cover"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.ratingProfilePlaceholder}>
                <Text style={styles.ratingPlaceholderText}>
                  {(!isUserA ? userAData?.username : userBData?.username)?.[0]?.toUpperCase() || 'N'}
                </Text>
              </View>
            )}

            <View style={{ marginVertical: 20, width: '100%', alignItems: 'center' }}>
              <AirbnbRating
                count={5}
                defaultRating={0}
                size={30}
                showRating={false}
                onFinishRating={(rating) => setRating(rating)}
              />
            </View>  

            <View style={styles.ratingButtonContainer}>
              <TouchableOpacity
                style={styles.ratingButtonDecline}
                onPress={() => {
                  setShowRatingModal(false);
                  navigation.navigate('Tabs', { screen: 'Home' });
                }}
              >
                <Text style={styles.ratingButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ratingButtonNicAssist}
                onPress={async () => {
                  try {
                    await submitRating(targetUserId, rating);
                  } catch (error) {
                    console.error('Error submitting rating:', error);
                  }

                  setShowRatingModal(false);
                  navigation.navigate('Tabs', { screen: 'Home' });
                }}
              >
                <Text style={styles.ratingButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  completedButton: { marginTop: 12, alignSelf: 'center', width: '80%', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#76BD6F', borderBottomWidth: 2, borderBottomColor: '#1C5916' },
  completedText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  completedHeader: { fontSize: 16, fontWeight: '700', color: '#2b2b2b', marginBottom: 10, },
  ratingModalContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},
ratingModalContent: {
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 10,
  alignItems: 'center',
  width: '80%',
},
ratingOuterZynBorder: {
  padding: 6,
  borderRadius: 60,
  backgroundColor: '#cdcdcd',
},
ratingInnerWhiteBorder: {
  padding: 3,
  borderRadius: 54,
  backgroundColor: '#fff',
},
ratingProfilePhoto: {
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: '#ccc',
},
ratingProfilePlaceholder: {
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: '#eee',
  justifyContent: 'center',
  alignItems: 'center',
},
ratingPlaceholderText: {
  fontSize: 40,
  fontWeight: 'bold',
  color: '#60a8b8',
},
ratingModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
ratingButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
ratingButtonNicAssist: {
  backgroundColor: '#60a8b8',
  alignItems: 'center',
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 4,
  marginHorizontal: 5,
},
ratingButtonDecline: {
  backgroundColor: '#cdcdcd',
  alignItems: 'center',
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 4,
  marginHorizontal: 5,
},
ratingButtonText: { color: '#fff', fontSize: 16 },

});