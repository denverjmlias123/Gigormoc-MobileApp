import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Profile } from './auth';

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category_id: string | null;
  is_active: boolean;
  source?: string;
  created_at: string;
}

export interface Area {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface UserSkill {
  profile_id: string;
  skill_id: string;
  skill: Skill;
}

export interface PortfolioItem {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  file_paths: string[];
  created_at: string;
}

export interface CompletenessMissingItem {
  key:
    | 'photo'
    | 'display_name'
    | 'headline'
    | 'bio'
    | 'area'
    | 'skills'
    | 'work_availability'
    | 'client_type'
    | 'hiring_interests';
  label: string;
}

export interface ProfileCompleteness {
  profile_id: string;
  role: 'find_work' | 'hire';
  percent: number;
  complete: boolean;
  missing_items: CompletenessMissingItem[];
  has_portfolio_bonus: boolean;
}

export interface UpdateProfileDetailsParams {
  displayName: string;
  headline?: string;
  bio?: string;
  area?: string;
  preferredContact?: string;
  languages?: string[];
  phone?: string;
  workTypes?: string[];
  availability?: 'available_now' | 'part_time' | 'weekends' | 'not_taking_work' | '' | null;
  experienceYears?: 'lt_1' | '1_3' | '3_5' | '5_plus' | '' | null;
  startingRateNote?: string;
  clientType?: 'individual' | 'business' | 'organization' | 'other' | '' | null;
  businessName?: string;
  aboutHiring?: string;
}

export interface SaveHiringDetailsParams {
  clientType?: 'individual' | 'business' | 'organization' | 'other' | '' | null;
  businessName?: string;
  aboutHiring?: string;
  categoryIds?: string[];
  customCategoryNames?: string[];
}

export interface SaveHiringDetailsResult {
  profile_id: string;
  client_type: 'individual' | 'business' | 'organization' | 'other' | null;
  business_name: string;
  about_hiring: string;
  hiring_interests: Category[];
}

export interface PublicProfileData {
  profile: Profile;
  skills: Skill[];
  portfolioItems: PortfolioItem[];
  hiringInterests: Category[];
  gigsPostedCount: number;
  completeness?: ProfileCompleteness | null;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
export const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function validateImageFile(params: {
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}): { valid: boolean; ext: string; mimeType: string; error?: string } {
  const { mimeType, fileName, fileSize } = params;

  if (typeof fileSize === 'number' && fileSize > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      ext: 'jpg',
      mimeType: 'image/jpeg',
      error: 'Image is too large. Maximum allowed file size is 5 MB.',
    };
  }

  let ext = 'jpg';
  if (fileName && fileName.includes('.')) {
    ext = fileName.split('.').pop()!.toLowerCase();
  } else if (mimeType && mimeType.includes('/')) {
    ext = mimeType.split('/').pop()!.toLowerCase();
  }
  if (ext === 'jpeg') ext = 'jpg';

  const normalizedMime = (mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`).toLowerCase();

  if (!ALLOWED_IMAGE_EXTS.has(ext) || !ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
    return {
      valid: false,
      ext,
      mimeType: normalizedMime,
      error: 'Unsupported file format. Please choose a JPEG, PNG, or WebP image.',
    };
  }

  return {
    valid: true,
    ext,
    mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
  };
}

export function extractStorageObjectPath(
  bucket: 'avatars' | 'portfolio',
  urlOrPath: string | null | undefined
): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0]);
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }
  return null;
}

export function buildAvatarStoragePath(userId: string, timestamp: number = Date.now(), ext: string = 'jpg'): string {
  const cleanExt = ext === 'jpeg' ? 'jpg' : ext.toLowerCase();
  return `${userId}/avatar-${timestamp}.${cleanExt}`;
}

export function validateSkillName(rawName: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = (rawName || '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 2 || normalized.length > 40) {
    return {
      valid: false,
      normalized,
      error: 'Skill name must be between 2 and 40 characters.',
    };
  }
  if (normalized.includes('@')) {
    return {
      valid: false,
      normalized,
      error: 'Skill name cannot contain an email address.',
    };
  }
  if (/(https?:\/\/|www\.|\.[a-z]{2,4}\/|\.(com|net|org|ph|io)\b)/i.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Skill name cannot contain a website or URL.',
    };
  }
  if (normalized.replace(/[^0-9]/g, '').length >= 7) {
    return {
      valid: false,
      normalized,
      error: 'Skill name cannot contain a phone number.',
    };
  }
  if (!/[A-Za-z]/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Skill name must include letters.',
    };
  }
  if (!/^[A-Za-z0-9 &+\-./]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Skill name may only contain letters, numbers, spaces, and & - + . /.',
    };
  }
  if (
    /\b(fuck|shit|bitch|asshole|puta|putangina|gago|tarantado|ulol|bobo|scam|scammer|porn|sex|shabu)\b/i.test(
      normalized
    )
  ) {
    return {
      valid: false,
      normalized,
      error: 'Skill name contains inappropriate language.',
    };
  }
  return { valid: true, normalized };
}

export const profileService = {
  validateImageFile,
  extractStorageObjectPath,
  buildAvatarStoragePath,
  validateSkillName,

  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as Category[];
  },

  async getSkills(categoryId?: string): Promise<Skill[]> {
    let query = supabase
      .from('skills')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Skill[];
  },

  async getAreas(): Promise<Area[]> {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as Area[];
  },

  async getProfileCompleteness(profileId: string): Promise<ProfileCompleteness> {
    const { data, error } = await supabase.rpc('get_profile_completeness', {
      p_profile_id: profileId,
    });

    if (error) throw error;
    return data as ProfileCompleteness;
  },

  async getOwnPrivatePhone(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profile_private')
      .select('phone')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.phone || '';
  },

  async updateProfileDetails(params: UpdateProfileDetailsParams): Promise<Profile> {
    const { data, error } = await supabase.rpc('update_profile_details', {
      p_display_name: params.displayName,
      p_headline: params.headline ?? null,
      p_bio: params.bio ?? null,
      p_area: params.area ?? null,
      p_preferred_contact: params.preferredContact ?? null,
      p_languages: params.languages ?? null,
      p_phone: params.phone ?? null,
      p_work_types: params.workTypes ?? null,
      p_availability: params.availability ?? null,
      p_experience_years: params.experienceYears ?? null,
      p_starting_rate_note: params.startingRateNote ?? null,
      p_client_type: params.clientType ?? null,
      p_business_name: params.businessName ?? null,
      p_about_hiring: params.aboutHiring ?? null,
    });

    if (error) throw error;
    return data as Profile;
  },

  async addProfileSkills(skillIds: string[], customNames: string[]): Promise<Skill[]> {
    const { data, error } = await supabase.rpc('add_profile_skills', {
      p_skill_ids: skillIds,
      p_custom_names: customNames,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.out_skill_id || row.skill_id,
      name: row.out_skill_name || row.skill_name || row.name,
      category_id: null,
      is_active: row.out_is_active ?? row.is_active,
      source: row.out_source || row.source,
      created_at: new Date().toISOString(),
    }));
  },

  async getUserSkills(profileId: string): Promise<Skill[]> {
    const { data, error } = await supabase
      .from('profile_skills')
      .select(`
        skill_id,
        skills (
          id,
          name,
          category_id,
          is_active,
          source,
          created_at
        )
      `)
      .eq('profile_id', profileId);

    if (error) throw error;

    const list: Skill[] = [];
    (data || []).forEach((row: any) => {
      if (row.skills) {
        list.push(row.skills as Skill);
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  },

  async addUserSkill(_profileId: string, skillId: string): Promise<void> {
    await profileService.addProfileSkills([skillId], []);
  },

  async removeUserSkill(_profileId: string, skillId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_profile_skill', {
      p_skill_id: skillId,
    });

    if (error) throw error;
  },

  async getUserHiringInterests(profileId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('profile_hiring_interests')
      .select(`
        category_id,
        categories (
          id,
          name,
          slug,
          is_active,
          created_at
        )
      `)
      .eq('profile_id', profileId);

    if (error) throw error;

    const list: Category[] = [];
    (data || []).forEach((row: any) => {
      if (row.categories) {
        list.push(row.categories as Category);
      }
    });
    return list;
  },

  async saveHiringDetails(params: SaveHiringDetailsParams): Promise<SaveHiringDetailsResult> {
    const { data, error } = await supabase.rpc('save_hiring_details', {
      p_client_type: params.clientType ?? null,
      p_business_name: params.businessName ?? null,
      p_about_hiring: params.aboutHiring ?? null,
      p_category_ids: params.categoryIds ?? null,
      p_custom_category_names: params.customCategoryNames ?? null,
    });

    if (error) throw error;
    return data as SaveHiringDetailsResult;
  },

  async getClientPostedGigsCount(profileId: string): Promise<number> {
    const { count, error } = await supabase
      .from('gigs')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', profileId)
      .neq('status', 'draft');

    if (error) return 0;
    return count || 0;
  },

  async getPortfolioItems(profileId: string): Promise<PortfolioItem[]> {
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PortfolioItem[];
  },

  async addPortfolioItem(params: {
    profileId: string;
    title: string;
    description?: string;
    filePaths?: string[];
  }): Promise<PortfolioItem> {
    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({
        profile_id: params.profileId,
        title: params.title,
        description: params.description || '',
        file_paths: params.filePaths || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data as PortfolioItem;
  },

  async deletePortfolioItem(id: string, profileId: string): Promise<void> {
    const { error } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId);

    if (error) throw error;
  },

  async uploadAvatar(
    userId: string,
    fileData: Blob | ArrayBuffer | Uint8Array,
    fileExt: string = 'jpg',
    mimeType?: string
  ): Promise<string> {
    const byteLength =
      fileData instanceof Blob
        ? fileData.size
        : fileData instanceof ArrayBuffer
        ? fileData.byteLength
        : fileData.byteLength;

    const validation = validateImageFile({
      mimeType: mimeType || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      fileName: `avatar.${fileExt}`,
      fileSize: byteLength,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const path = buildAvatarStoragePath(userId, Date.now(), validation.ext);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, fileData, {
        upsert: false,
        contentType: validation.mimeType,
      });

    // A failed upload never changes the profile
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const publicUrl = publicUrlData.publicUrl;

    // Update profile avatar_path via RPC (returns previous_avatar_path)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_profile_avatar', {
      p_avatar_path: publicUrl,
    });

    if (rpcError) {
      // Clean up newly uploaded object if DB update failed
      await supabase.storage.from('avatars').remove([path]).catch(() => {});
      throw rpcError;
    }

    // Delete previous avatar object from storage if one existed
    const prevPath = extractStorageObjectPath('avatars', rpcResult?.previous_avatar_path);
    if (prevPath && prevPath !== path && prevPath.startsWith(`${userId}/`)) {
      await supabase.storage.from('avatars').remove([prevPath]).catch(() => {});
    }

    return publicUrl;
  },

  async removeAvatar(userId: string): Promise<void> {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_profile_avatar', {
      p_avatar_path: null,
    });

    if (rpcError) throw rpcError;

    const prevPath = extractStorageObjectPath('avatars', rpcResult?.previous_avatar_path);
    if (prevPath && prevPath.startsWith(`${userId}/`)) {
      await supabase.storage.from('avatars').remove([prevPath]).catch(() => {});
    }
  },

  async pickAndUploadAvatar(userId: string, source: 'library' | 'camera'): Promise<string | null> {
    if (source === 'camera') {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          throw new Error('Camera permission is required to take a profile photo.');
        }
      }
    } else if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Photo library permission is required to choose a profile photo.');
      }
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const check = validateImageFile({
      mimeType: asset.mimeType,
      fileName: asset.fileName || asset.uri,
      fileSize: asset.fileSize,
    });

    if (!check.valid) {
      throw new Error(check.error);
    }

    const response = await fetch(asset.uri);
    const blob = await response.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('Image is too large. Maximum allowed file size is 5 MB.');
    }

    return await profileService.uploadAvatar(userId, blob, check.ext, check.mimeType);
  },

  async uploadPortfolioImage(
    userId: string,
    fileData: Blob | ArrayBuffer | Uint8Array,
    fileExt: string = 'jpg',
    mimeType?: string
  ): Promise<string> {
    const byteLength =
      fileData instanceof Blob
        ? fileData.size
        : fileData instanceof ArrayBuffer
        ? fileData.byteLength
        : fileData.byteLength;

    const validation = validateImageFile({
      mimeType: mimeType || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      fileName: `item.${fileExt}`,
      fileSize: byteLength,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const path = `${userId}/item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${validation.ext}`;
    const { error: uploadError } = await supabase.storage
      .from('portfolio')
      .upload(path, fileData, {
        upsert: false,
        contentType: validation.mimeType,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('portfolio')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  },

  async pickAndUploadPortfolioImages(userId: string, maxSelection: number = 3): Promise<string[]> {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Photo library permission is required to upload portfolio images.');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maxSelection,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const uploadedUrls: string[] = [];
    for (const asset of result.assets.slice(0, maxSelection)) {
      const check = validateImageFile({
        mimeType: asset.mimeType,
        fileName: asset.fileName || asset.uri,
        fileSize: asset.fileSize,
      });

      if (!check.valid) {
        throw new Error(check.error);
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error('One of the selected images exceeds the 5 MB limit.');
      }

      const url = await profileService.uploadPortfolioImage(userId, blob, check.ext, check.mimeType);
      uploadedUrls.push(url);
    }

    return uploadedUrls;
  },

  async getPublicProfile(profileId: string): Promise<PublicProfileData | null> {
    // Read only from public.profiles - NEVER touches profile_private (dob or phone)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, display_name, headline, bio, avatar_path, area, preferred_contact, languages, work_types, availability, experience_years, starting_rate_note, client_type, business_name, about_hiring, active_mode, mode_changed_at, onboarding_complete, freelancer_rating_avg, freelancer_rating_count, client_rating_avg, client_rating_count, freelancer_completed_gigs, client_completed_gigs, rating_avg, rating_count, completed_gigs, status, created_at'
      )
      .eq('id', profileId)
      .maybeSingle();

    if (profileError || !profileData) return null;

    const isHire = profileData.active_mode === 'hire';

    const [skills, portfolioItems, hiringInterests, gigsPostedCount, completeness] =
      await Promise.all([
        isHire ? Promise.resolve([]) : profileService.getUserSkills(profileId).catch(() => []),
        isHire ? Promise.resolve([]) : profileService.getPortfolioItems(profileId).catch(() => []),
        profileService.getUserHiringInterests(profileId).catch(() => []),
        profileService.getClientPostedGigsCount(profileId).catch(() => 0),
        profileService.getProfileCompleteness(profileId).catch(() => null),
      ]);

    return {
      profile: profileData as Profile,
      skills,
      portfolioItems,
      hiringInterests,
      gigsPostedCount,
      completeness,
    };
  },
};
