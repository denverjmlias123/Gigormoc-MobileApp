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

export interface PublicProfileData {
  profile: Profile;
  skills: Skill[];
  portfolioItems: PortfolioItem[];
}

export const profileService = {
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

  async addProfileSkills(skillIds: string[], customNames: string[]): Promise<Skill[]> {
    const { data, error } = await supabase.rpc('add_profile_skills', {
      p_skill_ids: skillIds,
      p_custom_names: customNames,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.skill_id,
      name: row.name,
      category_id: null,
      is_active: row.is_active,
      source: row.source,
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
    return list;
  },

  async addUserSkill(profileId: string, skillId: string): Promise<void> {
    const { error } = await supabase
      .from('profile_skills')
      .insert({
        profile_id: profileId,
        skill_id: skillId,
      });

    if (error) throw error;
  },

  async removeUserSkill(profileId: string, skillId: string): Promise<void> {
    const { error } = await supabase
      .from('profile_skills')
      .delete()
      .eq('profile_id', profileId)
      .eq('skill_id', skillId);

    if (error) throw error;
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

  async uploadAvatar(userId: string, fileData: Blob | ArrayBuffer | Uint8Array, fileExt: string = 'jpg'): Promise<string> {
    const path = `${userId}/avatar_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, fileData, {
        upsert: true,
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const publicUrl = publicUrlData.publicUrl;

    // Save avatar_path to profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_path: publicUrl })
      .eq('id', userId);

    if (profileError) throw profileError;

    return publicUrl;
  },

  async uploadPortfolioImage(userId: string, fileData: Blob | ArrayBuffer | Uint8Array, fileExt: string = 'jpg'): Promise<string> {
    const path = `${userId}/item_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('portfolio')
      .upload(path, fileData, {
        upsert: true,
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('portfolio')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  },

  async getPublicProfile(profileId: string): Promise<PublicProfileData | null> {
    // Read only from public.profiles - NEVER touches profile_private
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, bio, avatar_path, area, active_mode, mode_changed_at, onboarding_complete, freelancer_rating_avg, freelancer_rating_count, client_rating_avg, client_rating_count, freelancer_completed_gigs, client_completed_gigs, rating_avg, rating_count, completed_gigs, status, created_at')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError || !profileData) return null;

    const [skills, portfolioItems] = await Promise.all([
      profileService.getUserSkills(profileId).catch(() => []),
      profileService.getPortfolioItems(profileId).catch(() => []),
    ]);

    return {
      profile: profileData as Profile,
      skills,
      portfolioItems,
    };
  },
};
