import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Modal, Image, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const Header = ({ user, navigation }) => {
  return (
    <SafeAreaView style={{ backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NicMeUp</Text>
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
                        route.name === 'Settings' ? 'settings' : null;
        return iconName ? <MaterialIcons name={iconName} size={24} color={color} /> : null;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
    <Tab.Screen name="Settings" component={SettingsScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
    <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ user: { displayName: user?.displayName, uid: user?.uid } }} />
  </Tab.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const isInitialMount = useRef(true);
  const hasNavigated = useRef(false);
  const navigationRef = useRef();
  const locationSubscription = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) return;

      const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      await setDoc(userDocRef, {
        flavors: userDoc.exists() ? userDoc.data().flavors : 'Random',
        nicQuestDistance: userDoc.exists() ? userDoc.data().nicQuestDistance : 400,
        notes: userDoc.exists() ? userDoc.data().notes : 'Notes for NicQuest',
        photoURL: userDoc.exists() ? userDoc.data().photoURL : null,
        pouchType: userDoc.exists() ? userDoc.data().pouchType : 'Random',
        strength: userDoc.exists() ? userDoc.data().strength : '3mg-6mg',
        expoPushToken: token,
      }, { merge: true });

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      const granted = foregroundStatus === 'granted' && backgroundStatus === 'granted';
      setLocationPermission(granted ? 'granted' : 'denied');

      if (granted) {
        const initialLoc = Device.isDevice
          ? await Location.getCurrentPositionAsync({})
          : { coords: { latitude: 39.7412777, longitude: -104.9705779, timestamp: new Date().toISOString() } };

        await setDoc(userDocRef, {
          location: {
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            timestamp: initialLoc.timestamp || new Date().toISOString(),
          }
        }, { merge: true });
      } else {
        Alert.alert(
          'Location Permission Needed',
          'Please enable location in Settings under Privacy > Location Services.',
          [{ text: 'OK' }]
        );
      }
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
            console.log(`[${timestamp}] Initial NicQuest on launch for userId:`, data.userId, 'Notification Data:', data);
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
          console.log(`[${timestamp}] Handling NicQuest on ${Device.isDevice ? 'Phone' : 'Simulator'} for userId:`, data.userId, 'Notification Data:', data);
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
  console.log('handleModalAction called with action:', action);
  if (action === 'NicAssist' && !hasNavigated.current) {
    const userADocRef = doc(db, 'users', notification.userId);
    const userADoc = await getDoc(userADocRef);
    const userAData = userADoc.data();
    console.log('UserA data:', userAData);

    if (userAData?.nicQuestAssistedBy) {
      Alert.alert('NicQuest Already Assisted!', 'This NicQuest has already been assisted by another user.');
    } else {
      try {
        const sessionId = userAData?.sessionId;
        if (!sessionId) {
          console.error('❌ Could not retrieve sessionId from userA');
          return;
        }

        const nicAssistLat = notification.nicAssistLat;
        const nicAssistLng = notification.nicAssistLng;
        if (!nicAssistLat || !nicAssistLng) {
          console.error('❌ Could not retrieve nicAssistLat or nicAssistLng from notification');
          return;
        }

        const userBDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userBDocRef, { nicAssistResponse: notification.userId }, { merge: true });
        await updateDoc(userADocRef, { nicQuestAssistedBy: auth.currentUser.uid }, { merge: true });
        console.log(`✅ NicAssist selected for user ${notification?.userId}`);
        hasNavigated.current = true;
        navigationRef.current?.navigate('NicAssist', {
          userAId: notification.userId,
          userBId: auth.currentUser.uid,
          sessionId,
          nicAssistLat,
          nicAssistLng,
          isGroup2: notification.isGroup2 || false, // Pass isGroup2 from notification
        });
      } catch (error) {
        console.error('Error updating Firestore for NicAssist:', error);
      }
    }
  } else if (action === 'Decline') {
    console.log(`❌ Decline NicQuest for user ${notification?.userId}`);
  }
  setIsModalVisible(false);
  if (action === 'NicAssist') hasNavigated.current = false;
};
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          header: ({ navigation, route }) => <Header user={user} navigation={navigation} />,
        }}
      >
        {user ? (
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
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          </>
        )}
      </Stack.Navigator>
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>NicQuest from {notification?.displayName || 'Friend'}</Text>
            {notification?.profilePhoto ? (
              <View style={styles.outerZynBorder}>
                <View style={styles.innerWhiteBorder}>
                  <Image
                    source={{ uri: notification.profilePhoto }}
                    style={styles.profilePhoto}
                    resizeMode="cover"
                    onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.placeholderText}>
                  {(notification?.displayName && notification.displayName.charAt(0)) || 'F'}
                </Text>
              </View>
            )}
            <Text style={styles.modalMessage}>Someone needs a pouch!</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.buttonNicAssist} onPress={() => handleModalAction('NicAssist')}>
                <Text style={styles.buttonText}>NicAssist</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonDecline} onPress={() => handleModalAction('Decline')}>
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dcdcdc',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerUser: { fontSize: 16, color: '#4d8a9b' },
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
});