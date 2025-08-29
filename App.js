import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Modal, Image, ScrollView, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import LoginScreen from './screens/LoginScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import HomeScreen from './screens/Tabs/HomeScreen';
import SettingsScreen from './screens/Tabs/SettingsScreen';
import ProfileScreen from './screens/Tabs/ProfileScreen';
import NicQuestWaitingScreen from './screens/NicQuestWaitingScreen';
import NicAssistScreen from './screens/NicAssistScreen';
import InfoScreen from './screens/Tabs/InfoScreen';
import { useHasNavigated } from "./NavContext";
import { FontAwesome } from 'react-native-vector-icons';
import Logo5 from './assets/Logo5.png';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const Header = ({ user, navigation }) => {
  return (
    <SafeAreaView style={{ backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <Image source={Logo5} style={styles.headerTitle} resizeMode="contain" />
        {user && (
          <Text style={styles.headerUser}>{user.displayName || 'User'}</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const TabNavigator = ({ user }) => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: true,
      header: () => <Header user={user} />,
      tabBarShowLabel: true,
      tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dcdcdc' },
      tabBarActiveTintColor: '#60a8b8',
      tabBarInactiveTintColor: '#000000',
      tabBarActiveBackgroundColor: '#fff',
      tabBarInactiveBackgroundColor: '#fff',
      tabBarIcon: ({ focused, color }) => {
        const iconName = route.name === 'Home' ? 'home' :
                        route.name === 'Profile' ? 'account-circle' :
                        route.name === 'Info' ? 'info-outline' :
                        route.name === 'Settings' ? 'settings' : null;
        return iconName ? <MaterialIcons name={iconName} size={24} color={color} /> : null;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
    <Tab.Screen name="Settings" component={SettingsScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
    <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
    <Tab.Screen name="Info" component={InfoScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
  </Tab.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const isInitialMount = useRef(true);
  const navigationRef = useRef();
  const locationSubscription = useRef(null);
  const hasNavigated = useHasNavigated();
  const [needsToAcceptTerms, setNeedsToAcceptTerms] = useState(false);
  const [latestTerms, setLatestTerms] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false)

const CustomStarRating = ({ rating = 5, size = 20 }) => {
  const stars = [];
  const rounded = Math.round(rating * 2) / 2; // nearest 0.5

  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      // Full gold star
      stars.push(
        <FontAwesome key={i} name="star" size={size} color="#FFD700" />
      );
    } else if (i - 0.5 === rounded) {
      // Layered half gold + half grey
      stars.push(
        <View key={i} style={{ position: 'relative', width: size, height: size }}>
          <FontAwesome
            name="star"
            size={size}
            color="#cdcdcd" // base grey star
            style={{ position: 'absolute', left: 0 }}
          />
          <View
            style={{
              width: size / 2,
              overflow: 'hidden',
              position: 'absolute',
              left: 0,
              height: size,
            }}
          >
            <FontAwesome
              name="star"
              size={size}
              color="#FFD700" // gold star on left half
            />
          </View>
        </View>
      );
    } else {
      // Empty grey star
      stars.push(
        <FontAwesome key={i} name="star" size={size} color="#cdcdcd" />
      );
    }
  }

  return <View style={{ flexDirection: 'row', marginTop: 5 }}>{stars}</View>;
};
//-----------------------------TERMS & Conditions--------------------------
async function getLatestTerms() {
  const termsRef = doc(db, "appConfig", "terms");
  const termsSnap = await getDoc(termsRef);

  if (termsSnap.exists()) {
    return termsSnap.data(); // { version, text, lastUpdated }
  } else {
    console.error("No terms document found!");
    return null;
  }
}
// useEffect for terms/condition
useEffect(() => {
  const checkTerms = async () => {
    if (!user) return; // only check after login
    
    try {
      // 1. Load latest terms doc
      const termsRef = doc(db, "appConfig", "terms");
      const termsSnap = await getDoc(termsRef);
      if (!termsSnap.exists()) return;
      const termsData = termsSnap.data();
      setLatestTerms(termsData);

      // 2. Load user doc
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      // 3. Decide if they need to accept
      if (
        !userData?.termsAcceptedVersion ||
        userData.termsAcceptedVersion !== termsData.version
      ) {
        setNeedsToAcceptTerms(true);
      }
    } catch (err) {
      console.error("Error checking terms:", err);
    }
  };

  checkTerms();
}, [user]); // run when user logs in
//-------------------END OF TERMS AND CONDITIONS-----------------------

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    setUser(firebaseUser);
    if (!firebaseUser) return;

    // --- user setup (always run, even before terms) ---
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    await setDoc(userDocRef, {
      flavors: userDoc.exists() ? userDoc.data().flavors : 'Random',
      nicQuestDistance: userDoc.exists() ? userDoc.data().nicQuestDistance : 400,
      notes: userDoc.exists() ? userDoc.data().notes : 'Notes for NicMeUp',
      photoURL: userDoc.exists() ? userDoc.data().photoURL : null,
      pouchType: userDoc.exists() ? userDoc.data().pouchType : 'Random',
      strength: userDoc.exists() ? userDoc.data().strength : '3mg-6mg',
      expoPushToken: token,
    }, { merge: true });
  });

  return () => unsubscribe();
}, []);


  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      if (!auth.currentUser || locationPermission !== 'granted' || !Device.isDevice) return;

      if (locationSubscription.current) {
        locationSubscription.current.remove();
        console.log('🧹 Removed existing location watcher');
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        async (position) => {
          const { latitude, longitude } = position.coords;
          const update = {
            location: {
              latitude,
              longitude,
              timestamp: Date.now(),
            },
          };
          try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), update);
            console.log(`📍 Updated: ${latitude}, ${longitude}`);
          } catch (err) {
            console.error('🔥 Failed to update location:', err.message);
          }
        }
      );

      console.log('✅ Started live location tracking');
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
        console.log('🧹 Cleaned up live location tracking');
      }
    };
  }, [locationPermission, user]);

  useEffect(() => {
    if (isInitialMount.current) {
      const checkInitialNotification = async () => {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && response.notification) {
          const { data } = response.notification.request.content;
          if (data?.type === 'NicQuest' && data.userId !== auth.currentUser?.uid) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] Initial NicMeUp on launch for userId:`, data.userId, 'Notification Data:', data);
            setNotification(data);
            setIsModalVisible(true);
          }
        }
        isInitialMount.current = false;
      };
      checkInitialNotification();
    }
  }, []);

  useEffect(() => {
    const notificationHandler = Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const { data } = notification.request.content;
        if (data?.type === 'NicQuest' && data.userId !== auth.currentUser?.uid) {
          const timestamp = new Date().toISOString();
          if (Device.isDevice) {
            setNotification(data);
            setIsModalVisible(true);
          }
        }
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true };
      },
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { data } = response.notification.request.content;
      if (data?.type === 'NicQuest' && data.userId !== auth.currentUser?.uid) {
        setNotification(data);
        setIsModalVisible(true);
      }
    });

    return () => {
      if (notificationHandler && typeof notificationHandler.remove === 'function') {
        notificationHandler.remove();
      }
      if (responseSubscription && typeof responseSubscription.remove === 'function') {
        responseSubscription.remove();
      }
      if (locationSubscription.current) { // Fixed to use locationSubscription
        locationSubscription.current.remove();
        locationSubscription.current = null;
        console.log('🧹 Cleaned up location watcher on unmount');
      }
    };
  }, []);

const handleModalAction = async (action) => {
  console.log(`handleModalAction called with action: ${action} by ${auth.currentUser?.uid}`);

  if (action === 'NicAssist' && !hasNavigated.current) {
    try {
      // 1) load userA doc (the requester)
      const userADocRef = doc(db, 'users', notification.userId);
      const userADocSnap = await getDoc(userADocRef);
      const userAData = userADocSnap.exists() ? userADocSnap.data() : null;

      // already assisted?
      if (userAData?.NicMeUp?.nicQuestAssistedBy) {
        Alert.alert('NicMeUp Already Assisted!', 'This NicMeUp has already been assisted by another user.',
          [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
        );
        return;
      }

      // 2) Try get sessionId from notification payload first (best)
      let sessionId = notification?.sessionId || notification?.data?.sessionId;

      // 3) If not found, try from userA doc
      if (!sessionId) {
        sessionId = userAData?.NicMeUp?.sessionId;
      }

      // 4) Fallback: search nicSessions for an active session owned by userA
      if (!sessionId) {
        console.log('No sessionId in notification or userA doc — searching nicSessions for active session...');
        const sessionsQ = query(
          collection(db, 'nicSessions'),
          where('userAId', '==', notification.userId),
          where('active', '==', true)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        if (!sessionsSnap.empty) {
          // pick the most recent (first) doc
          const found = sessionsSnap.docs[0];
          sessionId = found.id || found.data()?.sessionId;
          console.log('Found fallback sessionId from nicSessions:', sessionId);
        }
      }

      if (!sessionId) {
        Alert.alert('NicMeUp Unavailable', 'This NicMeUp is no longer available.',
          [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
        );
        return;
      }

      // 5) Verify the session doc is active before proceeding
      const sessionRef = doc(db, 'nicSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists() || sessionSnap.data().active === false) {
        Alert.alert('NicMeUp Unavailable', 'This NicMeUp has been canceled or completed.',
          [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
        );
        return;
      }

      // 6) Ensure we have lat/lng (from notification or fallback)
      const nicAssistLat = notification.nicAssistLat ?? notification.data?.nicAssistLat;
      const nicAssistLng = notification.nicAssistLng ?? notification.data?.nicAssistLng;
      if (nicAssistLat == null || nicAssistLng == null) {
        console.error('❌ Could not retrieve nicAssistLat or nicAssistLng from notification');
        Alert.alert('Missing data', 'Unable to get location for this NicMeUp.',
          [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
        );
        return;
      }

      // 7) Claim the session: update userB and userA NicMeUp and set session.userBId
      const userBDocRef = doc(db, 'users', auth.currentUser.uid);
      const userBDataSnap = await getDoc(userBDocRef);
      const userBData = userBDataSnap.exists() ? userBDataSnap.data() : {};

      // Set nicAssistResponse and the sessionId on B
      await updateDoc(userBDocRef, {
        NicMeUp: {
          ...userBData?.NicMeUp,
          nicAssistResponse: notification.userId,
          sessionId: sessionId
        }
      }, { merge: true });

      // Update userA nicQuestAssistedBy (only if not already set)
      const userADataLatestSnap = await getDoc(userADocRef);
      const userADataLatest = userADataLatestSnap.exists() ? userADataLatestSnap.data() : {};
      if (!userADataLatest?.NicMeUp?.nicQuestAssistedBy) {
        await updateDoc(userADocRef, {
          NicMeUp: {
            ...userADataLatest?.NicMeUp,
            nicQuestAssistedBy: auth.currentUser.uid
          }
        }, { merge: true });
      }

      // Update session doc with userBId (note: for true atomicity use a transaction)
      await updateDoc(sessionRef, {
        userBId: auth.currentUser.uid,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date()
      });
      const finalSessionSnap = await getDoc(sessionRef);
      const finalSessionData = finalSessionSnap.exists() ? finalSessionSnap.data() : null;

      if (!finalSessionData || finalSessionData.active === false) {
        Alert.alert(
          'NicMeUp Unavailable',
          'This NicMeUp was canceled or completed while you were joining.',
          [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
        );
        return; // stop navigation
}
      console.log(`✅ NicAssist selected for user ${notification?.userId} (session ${sessionId})`);

      hasNavigated.current = true
      navigationRef.current?.navigate('NicAssist', {
        userAId: notification.userId,
        userBId: auth.currentUser.uid,
        sessionId,
        nicAssistLat,
        nicAssistLng,
        isGroup2: notification.isGroup2 || false,
      });

    } catch (error) {
      console.error('Error updating Firestore for NicAssist:', error);
      Alert.alert('Error', 'Could not join NicMeUp. Try again.',
        [{ text: 'OK', onPress: () => setIsModalVisible(false) }]
      );
    }
  } else if (action === 'Decline') {
    console.log(`❌ Decline NicMeUp for user ${notification?.userId}`);
  }

  setIsModalVisible(false);
};
useEffect(() => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const unsub = onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      setOnboardingComplete(!!snap.data().onboardingComplete);
    }
  });
  return unsub;
}, [user]);

return (
  <NavigationContainer ref={navigationRef}>
    {needsToAcceptTerms ? (
      // 🚧 Show only Terms if not yet accepted
      <View style={styles.termsModalContainer}>
        <View style={styles.termsModalContent}>
          <Text style={styles.termsModalTitle}>Terms & Conditions</Text>
          <ScrollView style={styles.scrollArea}>
            <Text style={styles.termsText}>{latestTerms?.text}</Text>
          </ScrollView>
          <View style={styles.termsButtonContainer}>
            <TouchableOpacity
              style={styles.termsButton}
              onPress={async () => {
                if (!user || !latestTerms) return;
                try {
                  const userRef = doc(db, "users", user.uid);
                  await updateDoc(userRef, {
                    termsAcceptedVersion: latestTerms.version,
                    termsAcceptedAt: serverTimestamp(),
                  });

                  // ✅ NOW ask for location
                  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

                  if (foregroundStatus === 'granted') {
                    const initialLoc = Device.isDevice
                      ? await Location.getCurrentPositionAsync({})
                      : { coords: { latitude: 39.74053877190388, longitude: -104.970766737421, timestamp: new Date().toISOString() } };

                    await setDoc(userRef, {
                      location: {
                        latitude: initialLoc.coords.latitude,
                        longitude: initialLoc.coords.longitude,
                        timestamp: initialLoc.timestamp || new Date().toISOString(),
                      }
                    }, { merge: true });

                    setLocationPermission('granted');
                  } else {
                    setLocationPermission('denied');
                    Alert.alert(
                      'Location Permission Needed',
                      'Please enable location in Settings under Privacy > Location Services.',
                      [{ text: 'OK' }]
                    );
                  }

                  setNeedsToAcceptTerms(false); // close modal
                } catch (err) {
                  console.error("Error saving terms acceptance:", err);
                  Alert.alert("Error", "Could not save your acceptance. Please try again.");
                }
              }}

            >
              <Text style={styles.termsButtonText}>Accept Terms & Conditions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ) : (
      <>
        {/* ✅ Your App Navigator */}
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            header: ({ navigation, route }) => <Header user={user} navigation={navigation} />,
          }}
        >
          {user ? (
            !onboardingComplete ? (
              <Stack.Screen 
                name="InfoScreen" 
                component={InfoScreen} 
                initialParams={{ fromOnboarding: true }}
                options={{ headerShown: false }} 
              />
            ) : (
              <>
                <Stack.Screen name="Tabs" options={{ headerShown: false }}>
                  {() => <TabNavigator user={{ displayName: user?.displayName, uid: user?.uid }} />}
                </Stack.Screen>
                <Stack.Screen
                  name="NicQuestWaiting"
                  component={NicQuestWaitingScreen}
                  options={{
                    header: ({ navigation, route }) => <Header user={user} navigation={navigation} />,
                    headerRight: () => null,
                  }}
                />
                <Stack.Screen
                  name="NicAssist"
                  component={NicAssistScreen}
                  options={{
                    header: ({ navigation, route }) => <Header user={user} navigation={navigation} />,
                  }}
                />
              </>
            )
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
            </>
          )}
        </Stack.Navigator>

        {/* ✅ NicAssist modal still available */}
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                NicMeUp from {notification?.displayName || "Friend"}
              </Text>
              {notification?.profilePhoto ? (
                <View style={styles.outerZynBorder}>
                  <View style={styles.innerWhiteBorder}>
                    <Image
                      source={{ uri: notification.profilePhoto }}
                      style={styles.profilePhoto}
                      resizeMode="cover"
                      onError={(e) =>
                        console.log("Image load error:", e.nativeEvent.error)
                      }
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.placeholderText}>
                    {(notification?.displayName &&
                      notification.displayName.charAt(0)) ||
                      "F"}
                  </Text>
                </View>
              )}
              <CustomStarRating rating={notification?.userRating ?? 5} size={20} />
              <Text style={styles.modalMessage}>Someone needs a pouch!</Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.buttonNicAssist}
                  onPress={() => handleModalAction("NicAssist")}
                >
                  <Text style={styles.buttonText}>Assist</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.buttonDecline}
                  onPress={() => handleModalAction("Decline")}
                >
                  <Text style={styles.buttonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    )}
  </NavigationContainer>
);

}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 15,
    paddingLeft: 10,
  },
  headerTitle: { width: 40, height: 40},
  headerUser: { fontSize: 16, color: '#000' },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  outerZynBorder: {
    padding: 6,
    borderRadius: 60,
    backgroundColor: '#cdcdcd',
  },
  innerWhiteBorder: {
    padding: 3,
    borderRadius: 54,
    backgroundColor: '#fff',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ccc',
  },
  profilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#60a8b8',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalMessage: { fontSize: 16, marginBottom: 20 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  buttonNicAssist: {
    backgroundColor: '#60a8b8',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  buttonDecline: {
    backgroundColor: '#cdcdcd',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  buttonText: { color: '#fff', fontSize: 16 },
  termsModalContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  termsModalContent: {
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 10,
  alignItems: 'center',
  width: '90%',
  },
  termsModalTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 10,
  },
  scrollArea: {
  maxHeight: 500,
  },
  termsText: {
  fontSize: 12,
  marginBottom: 20,
  },
  termsButtonContainer: {
  width: '100%',
  marginTop: 20,
  },
  termsButton: {
  padding: 15,
  backgroundColor: '#60a8b8',
  borderRadius: 8,
  alignItems: 'center',
  },
  termsButtonText: {
  color: 'white',
  textAlign: 'center',
  fontSize: 16,
  },
});