import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

function resolveSupabaseUrl(url: string): string {
  if (!url) return '';
  if (Platform.OS !== 'web' && (url.includes('127.0.0.1') || url.includes('localhost'))) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
      (Constants as any)?.manifest?.debuggerHost;
    if (hostUri) {
      const hostIp = hostUri.split(':')[0];
      return url.replace(/127\.0\.0\.1|localhost/, hostIp);
    }
  }
  return url;
}

export const supabaseUrl = resolveSupabaseUrl(rawUrl);
const supabaseAnonKey = rawKey;

export const REQUEST_TIMEOUT_MS = 6000;

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

export function registerSessionExpiredHandler(_cb: (() => Promise<void> | void) | null) {}

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
