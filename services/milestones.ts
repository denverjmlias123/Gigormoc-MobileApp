import { supabase } from '../lib/supabase';

export interface MilestoneItem {
  id: string;
  agreement_id: string;
  seq: number;
  title: string;
  description: string;
  amount: number; // in centavos
  status: 'pending' | 'submitted' | 'approved' | 'revision_requested';
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionItem {
  id: string;
  milestone_id: string;
  freelancer_id: string;
  submission_number: number;
  message: string;
  file_paths: string[];
  created_at: string;
  freelancer?: {
    display_name: string;
    avatar_path: string | null;
  };
}

export interface DefineMilestoneParam {
  title: string;
  description?: string;
  amount: number; // in centavos
}

export const milestonesService = {
  async getAgreementMilestones(agreementId: string): Promise<MilestoneItem[]> {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('agreement_id', agreementId)
      .order('seq', { ascending: true });

    if (error) throw error;
    return (data || []) as MilestoneItem[];
  },

  async defineMilestones(agreementId: string, milestones: DefineMilestoneParam[]): Promise<void> {
    const { error } = await supabase.rpc('define_milestones', {
      p_agreement_id: agreementId,
      p_milestones: milestones,
    });

    if (error) throw error;
  },

  async submitMilestone(
    milestoneId: string,
    message: string,
    filePaths: string[] = []
  ): Promise<string> {
    const { data, error } = await supabase.rpc('submit_milestone', {
      p_milestone_id: milestoneId,
      p_message: message,
      p_file_paths: filePaths,
    });

    if (error) throw error;
    return data as string;
  },

  async reviewMilestone(
    milestoneId: string,
    action: 'approve' | 'request_revision',
    feedback: string = ''
  ): Promise<void> {
    const { error } = await supabase.rpc('review_milestone', {
      p_milestone_id: milestoneId,
      p_action: action,
      p_feedback: feedback,
    });

    if (error) throw error;
  },

  async getMilestoneSubmissions(milestoneId: string): Promise<SubmissionItem[]> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        id,
        milestone_id,
        freelancer_id,
        submission_number,
        message,
        file_paths,
        created_at,
        freelancer:profiles(display_name, avatar_path)
      `)
      .eq('milestone_id', milestoneId)
      .order('submission_number', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },

  async uploadSubmissionFile(
    agreementId: string,
    milestoneId: string,
    fileName: string,
    fileBlob: Blob | ArrayBuffer
  ): Promise<string> {
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${agreementId}/${milestoneId}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from('submissions')
      .upload(path, fileBlob, { upsert: false });

    if (error) throw error;
    return path;
  },

  async createSignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) return null;
    return data.signedUrl;
  },
};
