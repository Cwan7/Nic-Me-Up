import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import LoginScreen from './screens/LoginScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import HomeScreen from './screens/Tabs/HomeScreen';
import SettingsScreen from './screens/Tabs/SettingsScreen';
import ProfileScreen from './screens/Tabs/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register background notification handler
async function registerBackgroundHandler() {
  Notifications.registerTaskAsync('background-notification', async ({ data, experienceId }) => {
    console.log('Received background notification:', data);
    if (data?.type === 'pouchRequest') {
      console.log('Someone needs a pouch nearby:', data.userId);
      // Example: Show alert when app opens
      Alert.alert('Pouch Request', `User ${data.userId} needs a pouch nearby!`);
    }
    return Promise.resolve();
  });
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

const TabNavigator = ({ user }) => (
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

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        registerForPushNotificationsAsync();
        if (Platform.OS === 'ios') {
          registerBackgroundHandler();
        }
      }
    });
    return () => unsubscribe();
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

    // Always attempt to get the token, even if status is denied, to debug
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
    alignItems: 'flex-end',
    padding: 8,
    height: 50,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    paddingBottom: 20,
  },
  headerUser: {
    fontSize: 20,
    paddingBottom: 10,
    fontWeight: 'bold',
    color: '#60a8b8',
  },
});