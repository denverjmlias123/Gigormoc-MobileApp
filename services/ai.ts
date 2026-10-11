import { supabase } from '../lib/supabase';

export interface SuggestSkillsResponse {
  skills: string[];
}

export interface SuggestCategoriesResponse {
  categories: string[];
}

export interface SuggestGigCategoryItem {
  category_id: string;
  name: string;
  slug: string;
  reason: string;
}

export interface SuggestGigCategoryResponse {
  suggestions: SuggestGigCategoryItem[];
  proposed_new_category: string | null;
}

export interface DraftBioResponse {
  drafts: string[];
}

export interface PolishDescriptionResponse {
  polished_description: string;
}

export const aiService = {
  /**
   * Request AI skill suggestions based on free-form work description (Freelancer).
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
      let msg = error.message;
      try {
        if ((error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      throw new Error(msg || 'Could not fetch skill suggestions.');
    }

    return data?.skills || [];
  },

  /**
   * Request AI category suggestions based on what a client usually needs help with.
   * Calls Edge Function 'ai-assist' with task 'suggest_categories'.
   */
  async suggestCategories(helpDescription: string): Promise<string[]> {
    const trimmed = helpDescription.trim();
    if (!trimmed) {
      throw new Error('Please describe the help you usually need.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke<SuggestCategoriesResponse>('ai-assist', {
      body: {
        task: 'suggest_categories',
        help_description: trimmed,
      },
    });

    if (error) {
      let msg = error.message;
      try {
        if ((error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      throw new Error(msg || 'Could not fetch category suggestions.');
    }

    return data?.categories || [];
  },

  /**
   * Request AI category suggestions for a specific gig (matches active DB categories first,
   * and only proposes ONE general new category if none fit).
   * Calls Edge Function 'ai-assist' with task 'suggest_gig_category'.
   */
  async suggestGigCategory(params: {
    title: string;
    description?: string;
  }): Promise<SuggestGigCategoryResponse> {
    const cleanTitle = (params.title || '').trim();
    const cleanDesc = (params.description || '').trim();
    if (cleanTitle.length < 3 && cleanDesc.length < 3) {
      throw new Error('Please enter a gig title or description first.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke<SuggestGigCategoryResponse>('ai-assist', {
      body: {
        task: 'suggest_gig_category',
        title: cleanTitle.slice(0, 600),
        description: cleanDesc.slice(0, 600),
      },
    });

    if (error) {
      let msg = error.message;
      try {
        if ((error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      throw new Error(msg || 'Could not fetch AI category suggestions.');
    }

    return {
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
      proposed_new_category: data?.proposed_new_category || null,
    };
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
      let msg = error.message;
      try {
        if ((error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      throw new Error(msg || 'Could not draft bio.');
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
      let msg = error.message;
      try {
        if ((error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      throw new Error(msg || 'Could not polish gig description.');
    }

    return data?.polished_description || trimmed;
  },
};
