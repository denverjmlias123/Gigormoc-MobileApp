import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { strings } from '../../constants/strings';
import { getPasswordChecks } from '../../utils/passwordPolicy';

interface Props {
  password: string;
  email?: string;
  displayName?: string;
}

const checkLabels = [
  ['length', strings.auth.passwordLengthRule],
  ['lowercase', strings.auth.passwordLowercaseRule],
  ['uppercase', strings.auth.passwordUppercaseRule],
  ['number', strings.auth.passwordNumberRule],
  ['special', strings.auth.passwordSpecialRule],
  ['noSpaces', strings.auth.passwordNoSpacesRule],
  ['notEmail', strings.auth.passwordNotEmailRule],
  ['notName', strings.auth.passwordNotNameRule],
] as const;

export function PasswordPolicyChecklist({ password, email, displayName }: Props) {
  const theme = useAppTheme();
  const checks = getPasswordChecks(password, email, displayName);
  const coreKeys = ['length', 'lowercase', 'uppercase', 'number', 'special'] as const;
  const score = coreKeys.filter((key) => checks[key]).length;
  const strength = score <= 2 ? strings.auth.passwordStrengthWeak : score < 5 ? strings.auth.passwordStrengthFair : strings.auth.passwordStrengthStrong;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={styles.strengthRow}>
        <Text style={[theme.type.caption, { color: theme.colors.muted }]}>{strings.auth.passwordStrengthLabel}</Text>
        <Text style={[theme.type.caption, { color: score < 5 ? theme.colors.warning : theme.colors.success }]}>{strength}</Text>
      </View>
      <View style={styles.grid}>
        {checkLabels.map(([key, label]) => (
          <View key={key} style={styles.rule}>
            <Text style={{ color: checks[key] ? theme.colors.success : theme.colors.muted }}>
              {checks[key] ? '✓' : '○'}
            </Text>
            <Text style={[theme.type.caption, { color: checks[key] ? theme.colors.text : theme.colors.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: -8, marginBottom: 12, gap: 8 },
  strengthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rule: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 6 },
});
