import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { Avatar } from '../ui/Avatar';
import { strings } from '../../constants/strings';

interface PhotoUploadCardProps {
  displayName: string;
  avatarPath?: string | null;
  photoBusy: boolean;
  onPickLibrary: () => void;
  onPickCamera: () => void;
  onRemovePhoto: () => void;
}

export const PhotoUploadCard: React.FC<PhotoUploadCardProps> = ({
  displayName,
  avatarPath,
  photoBusy,
  onPickLibrary,
  onPickCamera,
  onRemovePhoto,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.photoCard,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {strings.profile.photoSectionTitle}
      </Text>
      <View style={styles.photoRow}>
        <Avatar
          name={displayName}
          imageUri={avatarPath}
          size={72}
          editable
          onPress={onPickLibrary}
        />
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={[styles.photoBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onPickLibrary}
            disabled={photoBusy}
          >
            <Ionicons name="images-outline" size={16} color="#ffffff" />
            <Text style={styles.photoBtnText}>{strings.profile.chooseFromLibraryBtn}</Text>
          </TouchableOpacity>

          {Platform.OS !== 'web' ? (
            <TouchableOpacity
              style={[styles.photoBtnOutline, { borderColor: theme.colors.border }]}
              onPress={onPickCamera}
              disabled={photoBusy}
            >
              <Ionicons name="camera-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.photoBtnOutlineText, { color: theme.colors.text }]}>
                {strings.profile.takePhotoBtn}
              </Text>
            </TouchableOpacity>
          ) : null}

          {avatarPath ? (
            <TouchableOpacity
              style={[styles.photoBtnOutline, { borderColor: theme.colors.danger }]}
              onPress={onRemovePhoto}
              disabled={photoBusy}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.dangerText} />
              <Text style={[styles.photoBtnOutlineText, { color: theme.colors.dangerText }]}>
                {strings.profile.removePhotoBtn}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {photoBusy ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 10 }} />
      ) : null}
      <Text style={[styles.helperText, { color: theme.colors.muted, marginTop: 8 }]}>
        Square crop, JPEG/PNG/WebP up to 5 MB.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  photoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  photoBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  photoBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  photoBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
});
