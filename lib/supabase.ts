import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const REQUEST_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineErr: any = new Error('Network request failed: device is offline');
    offlineErr.code = 'OFFLINE';
    throw offlineErr;
  }

  const controller = new AbortController();
  const existingSignal = init?.signal;
  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort();
    } else {
      existingSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' && !existingSignal?.aborted) {
      const timeoutErr: any = new Error('The request took too long. Please check your connection and try again.');
      timeoutErr.name = 'AbortError';
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

let refreshSessionInFlight: Promise<boolean> | null = null;
let onSessionExpiredCallback: (() => Promise<void> | void) | null = null;

export function registerSessionExpiredHandler(cb: (() => Promise<void> | void) | null) {
  onSessionExpiredCallback = cb;
}

/**
 * Single-flight session refresh: concurrent 401/JWT-expired callers share one refresh request.
 */
export async function refreshSessionSingleFlight(): Promise<boolean> {
  if (refreshSessionInFlight) {
    return refreshSessionInFlight;
  }
  refreshSessionInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshSessionInFlight = null;
    }
  })();
  return refreshSessionInFlight;
}

export function isSessionExpiredError(err: unknown): boolean {
  if (!err) return false;
  const status = typeof (err as any)?.status === 'number' ? (err as any).status : 0;
  const code = typeof (err as any)?.code === 'string' ? (err as any).code : '';
  const msg = typeof (err as any)?.message === 'string' ? (err as any).message.toLowerCase() : '';
  return (
    status === 401 ||
    code === 'PGRST301' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('session_not_found')
  );
}

/**
 * Runs an operation; if it fails with 401 / JWT expired, refreshes session once (single-flight)
 * and retries the call once. If still unauthorized, invokes the session-expired sign-out handler.
 */
export async function withSessionRefreshRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isSessionExpiredError(err)) {
      throw err;
    }
    const refreshed = await refreshSessionSingleFlight();
    if (!refreshed) {
      if (onSessionExpiredCallback) {
        await onSessionExpiredCallback();
      }
      const expErr: any = new Error('Your session expired. Please log in again.');
      expErr.code = 'SESSION_EXPIRED';
      throw expErr;
    }
    try {
      return await fn();
    } catch (retryErr) {
      if (isSessionExpiredError(retryErr) && onSessionExpiredCallback) {
        await onSessionExpiredCallback();
      }
      throw retryErr;
    }
  }
}

