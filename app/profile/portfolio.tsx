import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, PortfolioItem } from '../../services/profile';

export default function PortfolioScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.getPortfolioItems(user.id);
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load portfolio items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, [user]);

  const handlePickPhotos = async () => {
    if (!user || uploadingPhotos) return;
    const remaining = 3 - uploadedUrls.length;
    if (remaining <= 0) {
      setError('You can attach up to 3 photos per portfolio item.');
      return;
    }
    setError(null);
    setUploadingPhotos(true);
    try {
      const urls = await profileService.pickAndUploadPortfolioImages(user.id, remaining);
      if (urls.length > 0) {
        setUploadedUrls((prev) => [...prev, ...urls].slice(0, 3));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not upload portfolio photo.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemoveUploadedPhoto = (urlToRemove: string) => {
    setUploadedUrls((prev) => prev.filter((u) => u !== urlToRemove));
  };

  const handleAddItem = async () => {
    if (!user || submitting) return;
    setError(null);

    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const newItem = await profileService.addPortfolioItem({
        profileId: user.id,
        title: title.trim(),
        description: description.trim(),
        filePaths: uploadedUrls,
      });

      setItems((prev) => [newItem, ...prev]);
      setTitle('');
      setDescription('');
      setUploadedUrls([]);
      setShowAddForm(false);
    } catch (err: any) {
      setError(err?.message || 'Could not add portfolio item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    Alert.alert('Remove Item', 'Are you sure you want to remove this item from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await profileService.deletePortfolioItem(id, user.id);
            setItems((prev) => prev.filter((item) => item.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete item.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Portfolio</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={styles.toggleBtnText}>{showAddForm ? 'Cancel' : '+ Add Item'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showAddForm && (
          <View
            style={[
              styles.formCard,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <Text style={[styles.formTitle, { color: theme.colors.text }]}>New Portfolio Item</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Project Title *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Logo Design for Ormoc Cafe"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Explain the work done, tools used, or results..."
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Photos (up to 3 images, JPEG/PNG/WebP, max 5 MB)
              </Text>
              {uploadedUrls.length > 0 ? (
                <View style={styles.previewGrid}>
                  {uploadedUrls.map((url) => (
                    <View key={url} style={styles.previewWrap}>
                      <Image source={{ uri: url }} style={styles.previewImg} />
                      <TouchableOpacity
                        style={[styles.removePhotoBadge, { backgroundColor: theme.colors.danger }]}
                        onPress={() => handleRemoveUploadedPhoto(url)}
                      >
                        <Ionicons name="close" size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              {uploadedUrls.length < 3 ? (
                <TouchableOpacity
                  style={[styles.pickPhotoBtn, { borderColor: theme.colors.border }]}
                  onPress={handlePickPhotos}
                  disabled={uploadingPhotos}
                >
                  {uploadingPhotos ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>
                        Choose from photos/files ({uploadedUrls.length}/3)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary },
                (submitting || uploadingPhotos) && { opacity: 0.7 },
              ]}
              onPress={handleAddItem}
              disabled={submitting || uploadingPhotos}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Publish to Portfolio</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No portfolio items yet
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.colors.muted }]}>
              Showcase past client work, projects, or credentials to stand out to clients in Ormoc.
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, { color: theme.colors.text }]}>{item.title}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color={theme.colors.dangerText} />
                    ) : (
                      <Text style={{ color: theme.colors.dangerText, fontSize: 13, fontWeight: '600' }}>
                        Delete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {item.description ? (
                  <Text style={[styles.itemDesc, { color: theme.colors.muted }]}>
                    {item.description}
                  </Text>
                ) : null}
                {item.file_paths && item.file_paths.length > 0 ? (
                  <View style={styles.imagesRow}>
                    {item.file_paths.map((f, idx) => (
                      <Image key={idx} source={{ uri: f }} style={styles.itemThumb} />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 16,
  },
  backBtn: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 70,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  previewWrap: {
    position: 'relative',
    width: 76,
    height: 76,
  },
  previewImg: {
    width: 76,
    height: 76,
    borderRadius: 10,
  },
  removePhotoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  itemThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
  },
});
