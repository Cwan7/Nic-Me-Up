import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
    return true; // Indicate success
  } catch (error) {
    console.error('Background task registration error:', error);
    return false; // Indicate failure
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
  const Tab = createBottomTabNavigator(); // Define Tab here
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const Stack = createStackNavigator(); 

export default function App() {
  const [user, setUser] = useState(null);

useEffect(() => {
  console.log('Setting up user and notifications');
  let backgroundTask;
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed, user:', user?.uid);
    setUser(user);
    console.log('User set:', user?.displayName || 'No display name');
    if (user) {
      await registerForPushNotificationsAsync();
      if (Platform.OS === 'ios' && !backgroundTask) {
        backgroundTask = await registerBackgroundHandler();
        console.log('Background task registration result:', backgroundTask);
      }
    }
  });
  return () => unsubscribe(); // Only unsubscribe auth, keep task registered
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
        hasHandledInitialNotification.current = true; // ✅ prevent re-trigger
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

    try {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra?.eas?.projectId })).data;
      console.log('Expo Push Token:', token);
    } catch (error) {
      console.log('Error getting push token:', error.message || error);
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dcdcdc',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerUser: {
    fontSize: 16,
  },
});