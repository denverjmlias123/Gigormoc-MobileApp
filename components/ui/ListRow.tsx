import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  last?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({ title, subtitle, icon, onPress, last = false }) => {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.chip }]}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[theme.type.small, { color: theme.colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.borderStrong} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
