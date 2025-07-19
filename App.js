import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Modal, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const Header = ({ user }) => {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={{ backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NicMeUp</Text>
        {user && (
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerUser}>{user.displayName || 'User'}</Text>
          </TouchableOpacity>
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        console.log('Auth state changed, user:', user?.uid);

        // Fetch or register push token
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
        console.log(`${user.displayName} Expo Push Token:`, token);

        // Update Firestore user data
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        await setDoc(userDocRef, {
          flavors: userDoc.exists() && userDoc.data().flavors ? userDoc.data().flavors : 'Random',
          nicQuestDistance: userDoc.exists() && userDoc.data().nicQuestDistance ? userDoc.data().nicQuestDistance : 400,
          notes: userDoc.exists() && userDoc.data().notes ? userDoc.data().notes : 'Notes for NicQuest',
          photoURL: userDoc.exists() && userDoc.data().photoURL ? userDoc.data().photoURL : null,
          pouchType: userDoc.exists() && userDoc.data().pouchType ? userDoc.data().pouchType : 'Random',
          strength: userDoc.exists() && userDoc.data().strength ? userDoc.data().strength : '3mg-6mg',
          expoPushToken: token,
        }, { merge: true });
        console.log('Firestore user document initialized or updated for UID:', user.uid);

        // Handle location permission
        if (!locationPermission) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          setLocationPermission(status);
          if (status === 'granted') {
            const location = !Device.isDevice
              ? { coords: { latitude: 39.7405, longitude: -104.9706, timestamp: new Date().toISOString() } }
              : await Location.getCurrentPositionAsync({});
            await setDoc(userDocRef, {
              location: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp || new Date().toISOString(),
              },
            }, { merge: true });
            console.log('Location updated in Firestore for UID:', user.uid);
          } else {
            Alert.alert(
              'Location Permission Needed',
              'NicMeUp requires location access to find nearby users for NicQuest. Please enable it in Settings under Privacy > Location Services.',
              [{ text: 'OK', onPress: () => console.log('User instructed to enable location') }]
            );
          }
        }
      }
    });
    return () => unsubscribe();
  }, [locationPermission]);

  useEffect(() => {
    // Handle initial notification on app launch (cold start) only
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
        isInitialMount.current = false; // Set to false after first run
      };
      checkInitialNotification();
    }
  }, []);

  useEffect(() => {
    // Set up notification handlers
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
    };
  }, []);

  const handleModalAction = (action) => {
    if (action === 'NicAssist') {
      console.log(`✅ NicAssist selected for user ${notification?.userId}`);
    } else if (action === 'Decline') {
      console.log(`❌ Decline NicQuest for user ${notification?.userId}`);
    }
    setIsModalVisible(false);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true, header: () => <Header user={user} /> }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" options={{ headerShown: false }}>
              {() => <TabNavigator user={{ displayName: user?.displayName, uid: user?.uid }} />}
            </Stack.Screen>
            <Stack.Screen name="NicQuestWaiting" component={NicQuestWaitingScreen} />
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