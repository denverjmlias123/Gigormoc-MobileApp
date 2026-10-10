import { supabase } from '../lib/supabase';

export type ReportTargetType = 'profile' | 'gig' | 'agreement' | 'message';
export type ReportReasonCategory =
  | 'spam_scam'
  | 'harassment'
  | 'unresponsive'
  | 'payment_issue'
  | 'work_quality'
  | 'cancellation_request'
  | 'other';

export interface ReportItem {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason_category: ReportReasonCategory;
  details: string;
  evidence_path: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface SubmitReportParams {
  targetType: ReportTargetType;
  targetId: string;
  reasonCategory: ReportReasonCategory;
  details: string;
  evidencePath?: string;
}

export const reportsService = {
  async submitReport(params: SubmitReportParams): Promise<string> {
    const { data, error } = await supabase.rpc('submit_report', {
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_reason_category: params.reasonCategory,
      p_details: params.details,
      p_evidence_path: params.evidencePath || null,
    });

    if (error) throw error;
    return data as string;
  },

  async getMyReports(): Promise<ReportItem[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ReportItem[];
  },

  async cancelAgreement(agreementId: string, reason: string): Promise<string> {
    const { data, error } = await supabase.rpc('cancel_agreement', {
      p_agreement_id: agreementId,
      p_reason: reason,
    });

    if (error) throw error;
    return data as string; // 'cancelled' or 'disputed'
  },

  async uploadReportEvidence(
    userId: string,
    fileName: string,
    fileBlob: Blob | ArrayBuffer
  ): Promise<string> {
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${userId}/evidence_${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from('reports')
      .upload(path, fileBlob, { upsert: false });

    if (error) throw error;
    return path;
  },
};
