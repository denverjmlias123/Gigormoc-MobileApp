import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [area, setArea] = useState(profile?.area || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user) return;
    setError(null);

    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        display_name: displayName.trim(),
        area: area.trim(),
        bio: bio.trim(),
        avatar_path: avatarPath.trim() || null,
      });

      await refreshProfile();
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          },
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            }}
            style={styles.backBtn}
          >
            <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Edit Profile</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Maria Santos"
            placeholderTextColor={theme.colors.muted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Avatar Image URL</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={avatarPath}
            onChangeText={setAvatarPath}
            placeholder="https://... or storage public URL"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Barangay / Area in Ormoc</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Cogon, Ormoc City"
            placeholderTextColor={theme.colors.muted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Bio</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell clients about your expertise..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
