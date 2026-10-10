import { supabase } from '../lib/supabase';
import { GigSummary } from '../components/ui/GigCard';

export interface GigDetail extends GigSummary {
  description: string;
  requirements: string;
  category_id: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    display_name: string;
    avatar_path: string | null;
    area: string | null;
    client_rating_avg: number;
    client_rating_count: number;
    client_completed_gigs: number;
  };
}

export interface CreateGigParams {
  title: string;
  description: string;
  requirements: string;
  category_id: string;
  price_min: number; // in centavos
  price_max: number; // in centavos
  work_type: 'remote' | 'face_to_face' | 'hybrid';
  area?: string;
  application_deadline: string;
  deadline: string;
}

export interface GetGigsFilter {
  categoryId?: string;
  workType?: 'remote' | 'face_to_face' | 'hybrid';
  searchQuery?: string;
}

export const gigsService = {
  async getGigs(filter?: GetGigsFilter): Promise<GigSummary[]> {
    let query = supabase
      .from('gigs')
      .select(`
        id,
        title,
        price_min,
        price_max,
        work_type,
        area,
        application_deadline,
        deadline,
        status,
        category:categories(name),
        client:profiles(display_name, client_rating_avg, client_rating_count)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }

    if (filter?.workType) {
      query = query.eq('work_type', filter.workType);
    }

    if (filter?.searchQuery && filter.searchQuery.trim()) {
      query = query.ilike('title', `%${filter.searchQuery.trim()}%`);
    }

    // Own-content rule: exclude caller's own gigs from available work
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      query = query.neq('client_id', authData.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      category_name: row.category?.name,
      price_min: row.price_min,
      price_max: row.price_max,
      work_type: row.work_type,
      area: row.area,
      application_deadline: row.application_deadline,
      deadline: row.deadline,
      status: row.status,
      client: row.client
        ? {
            display_name: row.client.display_name,
            client_rating_avg: row.client.client_rating_avg,
            client_rating_count: row.client.client_rating_count,
          }
        : undefined,
    }));
  },

  async getGig(id: string): Promise<GigDetail | null> {
    const { data, error } = await supabase
      .from('gigs')
      .select(`
        id,
        client_id,
        title,
        description,
        requirements,
        category_id,
        price_min,
        price_max,
        work_type,
        area,
        application_deadline,
        deadline,
        status,
        created_at,
        updated_at,
        category:categories(name),
        client:profiles(
          id,
          display_name,
          avatar_path,
          area,
          client_rating_avg,
          client_rating_count,
          client_completed_gigs
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as any;
    return {
      id: row.id,
      client_id: row.client_id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      category_id: row.category_id,
      category_name: row.category?.name,
      price_min: row.price_min,
      price_max: row.price_max,
      work_type: row.work_type,
      area: row.area,
      application_deadline: row.application_deadline,
      deadline: row.deadline,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client: row.client || {
        id: row.client_id,
        display_name: 'Unknown Client',
        avatar_path: null,
        area: null,
        client_rating_avg: 0,
        client_rating_count: 0,
        client_completed_gigs: 0,
      },
    };
  },

  async getMyGigs(clientId: string): Promise<GigSummary[]> {
    const { data, error } = await supabase
      .from('gigs')
      .select(`
        id,
        title,
        price_min,
        price_max,
        work_type,
        area,
        application_deadline,
        deadline,
        status,
        category:categories(name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      category_name: row.category?.name,
      price_min: row.price_min,
      price_max: row.price_max,
      work_type: row.work_type,
      area: row.area,
      application_deadline: row.application_deadline,
      deadline: row.deadline,
      status: row.status,
    }));
  },

  async createDraftGig(params: CreateGigParams): Promise<{ id: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated.');

    const { data, error } = await supabase
      .from('gigs')
      .insert({
        client_id: user.id,
        title: params.title,
        description: params.description,
        requirements: params.requirements,
        category_id: params.category_id,
        price_min: params.price_min,
        price_max: params.price_max,
        work_type: params.work_type,
        area: params.area || '',
        application_deadline: params.application_deadline,
        deadline: params.deadline,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  async publishGig(gigId: string): Promise<void> {
    const { error } = await supabase.rpc('publish_gig', {
      p_gig_id: gigId,
    });

    if (error) throw error;
  },

  async cancelGig(gigId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_gig', {
      p_gig_id: gigId,
      p_reason: reason,
    });

    if (error) throw error;
  },
};

