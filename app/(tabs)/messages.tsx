import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';

export default function MessagesScreen() {
  const theme = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Messages</Text>
      <Text style={[styles.empty, { color: theme.colors.muted }]}>No conversations yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  empty: {
    fontSize: 15,
  },
});
