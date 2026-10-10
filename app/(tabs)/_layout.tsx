import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0d6efd' }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <FontAwesome name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="gigs"
        options={{ title: 'Gigs', tabBarIcon: ({ color, size }) => <FontAwesome name="briefcase" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: ({ color, size }) => <FontAwesome name="clock-o" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <FontAwesome name="envelope" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <FontAwesome name="user" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
