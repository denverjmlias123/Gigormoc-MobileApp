import { supabase } from '../lib/supabase';

export interface SuggestSkillsResponse {
  skills: string[];
}

export interface DraftBioResponse {
  drafts: string[];
}

export interface PolishDescriptionResponse {
  polished_description: string;
}

export const aiService = {
  /**
   * Request AI skill suggestions based on free-form work description.
   * Calls Edge Function 'ai-assist' with task 'suggest_skills'.
   */
  async suggestSkills(workDescription: string): Promise<string[]> {
    const trimmed = workDescription.trim();
    if (!trimmed) {
      throw new Error('Please describe the work you do.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke<SuggestSkillsResponse>('ai-assist', {
      body: {
        task: 'suggest_skills',
        work_description: trimmed,
      },
    });

    if (error) {
      throw new Error(error.message || 'Could not fetch skill suggestions.');
    }

    return data?.skills || [];
  },

  /**
   * Request AI bio drafts based on user's mode, skills, location, and rough notes.
   * Calls Edge Function 'ai-assist' with task 'draft_bio'.
   */
  async draftBio(params: {
    mode?: string;
    skills?: string[];
    area?: string;
    roughBio?: string;
  }): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke<DraftBioResponse>('ai-assist', {
      body: {
        task: 'draft_bio',
        mode: params.mode || 'find_work',
        skills: params.skills || [],
        area: params.area || '',
        rough_bio: params.roughBio || '',
      },
    });

    if (error) {
      throw new Error(error.message || 'Could not draft bio.');
    }

    return data?.drafts || [];
  },

  /**
   * Polish gig description for post screen.
   */
  async polishGigDescription(description: string): Promise<string> {
    const trimmed = description.trim();
    if (!trimmed) {
      throw new Error('Description is required.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke<PolishDescriptionResponse>('ai-assist', {
      body: {
        task: 'polish_gig_description',
        description: trimmed,
      },
    });

    if (error) {
      throw new Error(error.message || 'Could not polish gig description.');
    }

    return data?.polished_description || trimmed;
  },
};
