import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import LoginScreen from './screens/LoginScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import HomeScreen from './screens/Tabs/HomeScreen';
import SettingsScreen from './screens/Tabs/SettingsScreen';
import ProfileScreen from './screens/Tabs/ProfileScreen';

// Define the background task
const BACKGROUND_NOTIFICATION_TASK = 'background-notification';
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error, executionInfo }) => {
  if (error) {
    console.error('Task error:', error);
    return;
  }
  console.log('✅ Background notification received:', data);
  if (data?.type === 'NicQuest') {}
});

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { data } = notification.request.content;
    if (data?.type === 'NicQuest') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Foreground NicQuest:`, data.userId);
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// Register background handler
async function registerBackgroundHandler() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Is task registered:', isRegistered);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('✅ Background task registered');
    } else {
      console.log('✅ Background task already registered');
    }
    return true;
  } catch (error) {
    console.error('Background task registration error:', error);
    return false;
  }
}

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

const TabNavigator = ({ user }) => {
  const Tab = createBottomTabNavigator();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <Header user={user} />,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#dcdcdc',
        },
        tabBarActiveTintColor: '#60a8b8',
        tabBarInactiveTintColor: '#000000',
        tabBarActiveBackgroundColor: '#fff',
        tabBarInactiveBackgroundColor: '#fff',
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Profile') {
            iconName = 'account-circle';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }
          if (iconName) {
            return <MaterialIcons name={iconName} size={24} color={color} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen name="Home">
        {(props) => <HomeScreen {...props} user={user} />}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {(props) => <SettingsScreen {...props} user={user} />}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);

  useEffect(() => {
    console.log('Setting up user and notifications');
    let backgroundTask;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed, user:', user?.uid);
      setUser(user);
      console.log('User set:', user?.displayName || 'No display name');

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
          console.log(`${user.displayName} Expo Push Token:`, token);

          await setDoc(userDocRef, {
            flavors: userDoc.exists() && userDoc.data().flavors ? userDoc.data().flavors : "Random",
            nicQuestDistance: userDoc.exists() && userDoc.data().nicQuestDistance ? userDoc.data().nicQuestDistance : 250,
            notes: userDoc.exists() && userDoc.data().notes ? userDoc.data().notes : "Notes for NicQuest",
            photoURL: userDoc.exists() && userDoc.data().photoURL ? userDoc.data().photoURL : null,
            pouchType: userDoc.exists() && userDoc.data().pouchType ? userDoc.data().pouchType : "Random",
            strength: userDoc.exists() && userDoc.data().strength ? userDoc.data().strength : "3mg-6mg",
            expoPushToken: token,
          }, { merge: true });
          console.log('Firestore user document initialized or updated for UID:', user.uid);
        } catch (error) {
          console.error('Error initializing Firestore document:', error);
        }
      }

      if (user && !locationPermission) {
        console.log('Requesting location permission');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Location permission status:', status);
        if (status === 'granted') {
          console.log('Location permission granted, fetching location');
          let location;
          if (!Device.isDevice) {
            // Hardcode location for simulator (near Cwan's location in Denver)
            location = {
              coords: {
                latitude: 39.7405,
                longitude: -104.9706,
                timestamp: new Date().toISOString(),
              },
            };
            console.log('Using hardcoded location for simulator:', location.coords);
          } else {
            location = await Location.getCurrentPositionAsync({});
            console.log('User location fetched:', location.coords);
          }
          const userDocRef = doc(db, 'users', user.uid);
          try {
            await setDoc(userDocRef, {
              location: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp || new Date().toISOString(), // Use location.timestamp or fallback
              },
            }, { merge: true });
            console.log('Location updated in Firestore for UID:', user.uid);
            setLocationPermission(status);
          } catch (error) {
            console.error('Error updating location in Firestore:', error);
          }
        } else {
          console.log('Location permission denied');
          Alert.alert(
            'Location Permission Needed',
            'NicMeUp requires location access to find nearby users for NicQuest. Please enable it in Settings under Privacy > Location Services.',
            [{ text: 'OK', onPress: () => console.log('User instructed to enable location') }]
          );
          setLocationPermission(status);
        }
      }

      if (user) {
        await registerForPushNotificationsAsync();
        if (Platform.OS === 'ios' && !backgroundTask) {
          backgroundTask = await registerBackgroundHandler();
          console.log('Background task registration result:', backgroundTask);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const hasHandledInitialNotification = useRef(false);

  useEffect(() => {
    async function checkInitialNotification() {
      if (hasHandledInitialNotification.current) return;

      const response = await Notifications.getLastNotificationResponseAsync();

      if (response) {
        const timestamp = new Date().toISOString();
        const { data } = response.notification.request.content;

        console.log(`[${timestamp}] Initial notification tapped (cold start):`, data);

        if (data?.type === 'NicQuest') {
          hasHandledInitialNotification.current = true;
          Alert.alert(
            `NicQuest from ${data.userId}`,
            'users profile photo here',
            [
              {
                text: 'NicAssist',
                onPress: () => console.log(`✅ NicAssist selected for user ${data.userId}`),
                style: 'default',
              },
              {
                text: 'Decline',
                onPress: () => console.log(`❌ Decline NicQuest for user ${data.userId}`),
                style: 'cancel',
              },
            ],
            { cancelable: true }
          );
        }
      }
    }

    if (user) {
      checkInitialNotification();
    }
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Notification tapped:`, response.notification.request.content.data);
      const { data } = response.notification.request.content;
      if (data?.type === 'NicQuest') {
        console.log(`[${timestamp}] Tapped NicQuest:`, data.userId);
        Alert.alert(
          `NicQuest from ${data.userId}`,
          'users profile photo here',
          [
            {
              text: 'NicAssist',
              onPress: () => console.log(`✅ NicAssist selected for user ${data.userId}`),
              style: 'default',
            },
            {
              text: 'Decline',
              onPress: () => console.log(`❌ Decline NicQuest for user ${data.userId}`),
              style: 'cancel',
            },
          ],
          { cancelable: true }
        );
      }
    });
    return () => subscription.remove();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) {
      Alert.alert('Notifications', 'Must use a physical device for push notifications.');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Existing permission status:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowProvisional: true,
        },
      });
      finalStatus = status;
      console.log('Requested permission status:', status);
    }

    if (finalStatus === 'granted') {
      try {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
        console.log(`${user?.displayName} Expo Push Token:`, token);
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { expoPushToken: token }, { merge: true });
          console.log('Push token updated in Firestore for UID:', user.uid);
        }
      } catch (error) {
        console.log('Error getting push token:', error.message || error);
      }
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notification Permission',
        'NicMeUp would like to send you notifications for updates and reminders. Please allow notifications to stay connected!',
        [
          { text: 'Deny', style: 'cancel' },
          { text: 'Allow', onPress: () => Notifications.requestPermissionsAsync() },
        ]
      );
      return;
    }
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          header: () => <Header user={user} />,
        }}
      >
        {user ? (
          <Stack.Screen
            name="Tabs"
            options={{ headerShown: false }}
          >
            {() => <TabNavigator user={user} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          </>
        )}
      </Stack.Navigator>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerUser: {
    fontSize: 16,
    color: '#4d8a9b',
  },
});