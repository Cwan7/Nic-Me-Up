import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoginScreen from './screens/LoginScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import HomeScreen from './screens/Tabs/HomeScreen';
import NicQuestScreen from './screens/Tabs/NicQuestScreen';
import ProfileScreen from './screens/Tabs/ProfileScreen';

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
      tabBarStyle: {
        backgroundColor: '#fff', // White
        borderTopWidth: 1,
        borderTopColor: '#dcdcdc', // Light gray
      },
      tabBarActiveTintColor: '#60a8b8', // Teal
      tabBarInactiveTintColor: '#000000', // Black
      tabBarActiveBackgroundColor: '#fff', // White
      tabBarInactiveBackgroundColor: '#fff', // White
      tabBarIcon: ({ focused, color }) => {
        let iconName;
        if (route.name === 'Home') {
          iconName = 'home';
        } else if (route.name === 'Profile') {
          iconName = 'account-circle';
        }
        if (iconName) {
          return <MaterialIcons name={iconName} size={24} color={color} />;
        }
        return null; 
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="NicQuest" component={NicQuestScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

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
    height: 50, // Reduced height
    backgroundColor: '#fff', // White
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000', // Black
    paddingBottom: 20,
  },
  headerUser: {
    fontSize: 20,
    paddingBottom: 10,
    fontWeight: 'bold',
    color: '#60a8b8', // Black
  },
});