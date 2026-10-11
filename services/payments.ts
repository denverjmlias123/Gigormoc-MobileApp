import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { runOnce } from '../lib/singleFlight';
import { pickImagesUniversal } from '../utils/imageUpload';

let receiptUploadSeq = 0;

export type PaymentMethod = 'gcash' | 'maya' | 'bank_transfer' | 'cash' | 'other';
export type PaymentStatus = 'reported_sent' | 'confirmed_received' | 'disputed';

export interface PaymentItem {
  id: string;
  agreement_id: string;
  milestone_id: string | null;
  payer_id: string;
  payee_id: string;
  amount: number; // in centavos
  payment_method: PaymentMethod;
  reference_number: string;
  receipt_path: string | null;
  notes: string;
  status: PaymentStatus;
  dispute_reason: string | null;
  reported_at: string;
  confirmed_at: string | null;
  disputed_at: string | null;
  created_at: string;
  updated_at: string;
  payer?: {
    display_name: string;
    avatar_path: string | null;
  };
  payee?: {
    display_name: string;
    avatar_path: string | null;
  };
}

export interface ReportPaymentParams {
  agreementId: string;
  milestoneId?: string;
  amount: number; // in centavos
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  receiptPath?: string;
  notes?: string;
  requestId?: string;
}

export const paymentsService = {
  async getAgreementPayments(agreementId: string): Promise<PaymentItem[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        agreement_id,
        milestone_id,
        payer_id,
        payee_id,
        amount,
        payment_method,
        reference_number,
        receipt_path,
        notes,
        status,
        dispute_reason,
        reported_at,
        confirmed_at,
        disputed_at,
        created_at,
        updated_at,
        payer:profiles!payments_payer_id_fkey(display_name, avatar_path),
        payee:profiles!payments_payee_id_fkey(display_name, avatar_path)
      `)
      .eq('agreement_id', agreementId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },

  async reportPayment(params: ReportPaymentParams): Promise<string> {
    return runOnce(
      `report_payment:${params.agreementId}:${params.milestoneId || 'all'}`,
      async (reqId) => {
        const baseArgs = {
          p_agreement_id: params.agreementId,
          p_milestone_id: params.milestoneId || null,
          p_amount: params.amount,
          p_payment_method: params.paymentMethod,
          p_reference_number: params.referenceNumber,
          p_receipt_path: params.receiptPath || null,
          p_notes: params.notes || '',
        };
        let { data, error } = await supabase.rpc('report_payment', {
          ...baseArgs,
          p_request_id: reqId,
        });
        if (error && error.code === 'PGRST202') {
          ({ data, error } = await supabase.rpc('report_payment', baseArgs));
        }

        // Direct fallback if RPC is not installed in database
        if (error && (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('report_payment'))) {
          const { data: agr } = await supabase
            .from('agreements')
            .select('client_id, freelancer_id')
            .eq('id', params.agreementId)
            .maybeSingle();

          const { data: inserted, error: insErr } = await supabase
            .from('payments')
            .insert({
              agreement_id: params.agreementId,
              milestone_id: params.milestoneId || null,
              payer_id: (agr as any)?.client_id,
              payee_id: (agr as any)?.freelancer_id,
              amount: params.amount,
              payment_method: params.paymentMethod,
              reference_number: params.referenceNumber,
              receipt_path: params.receiptPath || null,
              notes: params.notes || '',
              status: 'reported_sent',
            })
            .select('id')
            .single();

          if (!insErr && inserted?.id) {
            return inserted.id;
          }
        }

        if (error) throw error;
        return data as string;
      },
      { requestId: params.requestId }
    );
  },

  async confirmPayment(paymentId: string, requestId?: string): Promise<void> {
    return runOnce(
      `confirm_payment:${paymentId}`,
      async (reqId) => {
        const baseArgs = { p_payment_id: paymentId };
        let { error } = await supabase.rpc('confirm_payment', {
          ...baseArgs,
          p_request_id: reqId,
        });
        if (error && error.code === 'PGRST202') {
          ({ error } = await supabase.rpc('confirm_payment', baseArgs));
        }

        // Direct fallback if RPC is not installed in database
        if (error && (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('confirm_payment'))) {
          const { error: updErr } = await supabase
            .from('payments')
            .update({
              status: 'confirmed_received',
              confirmed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', paymentId);
          if (!updErr) return;
        }

        if (error) throw error;
      },
      { requestId }
    );
  },

  async disputePayment(paymentId: string, reason: string, requestId?: string): Promise<void> {
    return runOnce(
      `dispute_payment:${paymentId}`,
      async (reqId) => {
        const baseArgs = {
          p_payment_id: paymentId,
          p_reason: reason,
        };
        let { error } = await supabase.rpc('dispute_payment', {
          ...baseArgs,
          p_request_id: reqId,
        });
        if (error && error.code === 'PGRST202') {
          ({ error } = await supabase.rpc('dispute_payment', baseArgs));
        }

        if (error) throw error;
      },
      { requestId }
    );
  },

  async completeAgreement(agreementId: string, requestId?: string): Promise<void> {
    return runOnce(
      `complete_agreement:${agreementId}`,
      async (reqId) => {
        const baseArgs = { p_agreement_id: agreementId };
        let { error } = await supabase.rpc('complete_agreement', {
          ...baseArgs,
          p_request_id: reqId,
        });
        if (error && error.code === 'PGRST202') {
          ({ error } = await supabase.rpc('complete_agreement', baseArgs));
        }

        // Direct fallback if RPC is not installed in database
        if (error && (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('complete_agreement'))) {
          const { error: updErr } = await supabase
            .from('agreements')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', agreementId);
          if (!updErr) return;
        }

        if (error) throw error;
      },
      { requestId }
    );
  },

  async uploadReceiptFile(
    agreementId: string,
    fileName: string,
    fileBlob: Blob | ArrayBuffer | Uint8Array,
    contentType?: string,
    requestId?: string
  ): Promise<string> {
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return runOnce(
      `upload_receipt:${agreementId}:${safeName}`,
      async (reqId) => {
        receiptUploadSeq += 1;
        const deterministicToken = requestId || reqId || `${Date.now()}_${receiptUploadSeq}`;
        const path = `${agreementId}/receipts/${deterministicToken}_${safeName}`;

        const { error } = await supabase.storage
          .from('receipts')
          .upload(path, fileBlob, {
            upsert: false,
            ...(contentType ? { contentType } : {}),
          });

        if (error) throw error;
        return path;
      },
      { requestId }
    );
  },

  async pickAndUploadReceiptImage(agreementId: string): Promise<string | null> {
    return runOnce(`pick_upload_receipt:${agreementId}`, async (reqId) => {
      const picked = await pickImagesUniversal({
        source: 'library',
        allowsMultipleSelection: false,
        cropSquare: false,
        maxDimension: 1920,
        quality: 0.85,
      });

      if (!picked || picked.length === 0) {
        return null;
      }

      const file = picked[0];
      if (file.bytes.byteLength > 10 * 1024 * 1024) {
        throw new Error('Receipt image is too large. Maximum allowed file size is 10 MB.');
      }

      const fileName = file.fileName || `receipt_${reqId}.${file.ext}`;
      return await paymentsService.uploadReceiptFile(
        agreementId,
        fileName,
        file.bytes,
        file.mimeType,
        reqId
      );
    });
  },

  async createSignedReceiptUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string | null> {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) return null;
    return data.signedUrl;
  },
};
