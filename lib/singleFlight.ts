import { useCallback, useEffect, useRef, useState } from 'react';
import { createRequestId } from './errors';

export const ALREADY_DONE_MESSAGE = 'Already done on your other device.';

const inFlightPromises = new Map<string, Promise<any>>();
const attemptRequestIds = new Map<string, string>();

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export interface RunOnceOptions {
  /** Explicit request_id to use (e.g. for deterministic replay). */
  requestId?: string;
  /** If true (default), keeps the same request_id when an attempt throws so a retry reuses it. */
  reuseRequestIdOnError?: boolean;
}

/**
 * Returns the active request_id for a given action key, or creates one if none exists.
 */
export function getOrCreateAttemptRequestId(key: string): string {
  const existing = attemptRequestIds.get(key);
  if (existing && isUuid(existing)) return existing;
  const fresh = createRequestId();
  attemptRequestIds.set(key, fresh);
  return fresh;
}

/**
 * Clears the stored request_id for a key (called after a successful write or when resetting a form).
 */
export function clearAttemptRequestId(key: string): void {
  attemptRequestIds.delete(key);
}

/**
 * Checks whether an RPC return value or error indicates the state transition was already completed
 * (for example on another device or a previous tap).
 */
export function isAlreadyDoneSignal(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    if (obj.already_done === true || obj.alreadyDone === true) {
      return true;
    }
    const msg = typeof obj.message === 'string' ? obj.message.toLowerCase() : '';
    if (msg.includes('already_done') || msg.includes('already done on your other device')) {
      return true;
    }
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'already_done' || lower.includes('already done on your other device');
  }
  return false;
}

/**
 * Module-level single-flight wrapper for write operations.
 * - Synchronous in-flight Map lock: 10 rapid calls with the same key execute `fn` only once.
 * - Generates one `request_id` (UUID) per user attempt; a retry after failure reuses the same `request_id`,
 *   while a new deliberate action after success gets a new `request_id`.
 */
export function runOnce<T>(
  key: string,
  fn: (requestId: string) => Promise<T>,
  options?: RunOnceOptions
): Promise<T> {
  const existing = inFlightPromises.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const reuseOnError = options?.reuseRequestIdOnError ?? true;
  const requestId = options?.requestId || getOrCreateAttemptRequestId(key);

  const promise = (async () => {
    try {
      const result = await fn(requestId);
      clearAttemptRequestId(key);
      return result;
    } catch (err) {
      if (!reuseOnError) {
        clearAttemptRequestId(key);
      }
      throw err;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

export function isActionInFlight(key: string): boolean {
  return inFlightPromises.has(key);
}

export interface UseActionOptions<TResult> {
  cooldownMs?: number;
  onSuccess?: (result: TResult, meta: { requestId: string; alreadyDone: boolean }) => void | Promise<void>;
  onAlreadyDone?: (result: TResult) => void | Promise<void>;
  onError?: (error: unknown, meta: { requestId: string }) => void;
}

/**
 * React hook for write actions with:
 * - Immediate synchronous `useRef` lock (blocks fast double-taps before React state re-renders)
 * - Stable `request_id` per attempt (reused on retry of a failed attempt, rotated after success)
 * - Post-success cooldown (default 800ms)
 */
export function useAction<TArgs extends any[], TResult>(
  key: string,
  fn: (requestId: string, ...args: TArgs) => Promise<TResult>,
  options?: UseActionOptions<TResult>
) {
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const [requestId, setRequestId] = useState<string>(() => getOrCreateAttemptRequestId(key));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current || coolingDown || inFlightPromises.has(key)) {
        return undefined;
      }

      inFlightRef.current = true;
      if (mountedRef.current) {
        setLoading(true);
      }

      const activeReqId = getOrCreateAttemptRequestId(key);
      if (mountedRef.current) {
        setRequestId(activeReqId);
      }

      try {
        const result = await runOnce(key, (reqId) => fn(reqId, ...args), {
          requestId: activeReqId,
          reuseRequestIdOnError: true,
        });

        const alreadyDone = isAlreadyDoneSignal(result);
        if (alreadyDone && options?.onAlreadyDone) {
          await options.onAlreadyDone(result);
        } else if (options?.onSuccess) {
          await options.onSuccess(result, { requestId: activeReqId, alreadyDone });
        }

        const nextId = getOrCreateAttemptRequestId(key);
        if (mountedRef.current) {
          setRequestId(nextId);
        }

        const cooldownMs = options?.cooldownMs ?? 800;
        if (cooldownMs > 0 && mountedRef.current) {
          setCoolingDown(true);
          cooldownTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setCoolingDown(false);
            }
          }, cooldownMs);
        }

        return result;
      } catch (err) {
        if (options?.onError) {
          options.onError(err, { requestId: activeReqId });
        }
        throw err;
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [key, fn, coolingDown, options]
  );

  const resetAttempt = useCallback(() => {
    clearAttemptRequestId(key);
    const fresh = getOrCreateAttemptRequestId(key);
    if (mountedRef.current) {
      setRequestId(fresh);
    }
  }, [key]);

  return {
    execute,
    loading,
    disabled: loading || coolingDown,
    requestId,
    resetAttempt,
  };
}

/**
 * Deduplicates Realtime row events by row `id` so repeated deliveries or reconnect replays
 * do not insert duplicate items in UI state.
 */
export function createRealtimeDeduper(maxEntries: number = 500) {
  const seenIds = new Set<string>();

  return {
    shouldProcess(id: string | null | undefined): boolean {
      if (!id) return false;
      if (seenIds.has(id)) {
        return false;
      }
      if (seenIds.size >= maxEntries) {
        const oldest = seenIds.values().next().value;
        if (oldest !== undefined) {
          seenIds.delete(oldest);
        }
      }
      seenIds.add(id);
      return true;
    },
    markSeen(id: string | null | undefined): void {
      if (!id) return;
      seenIds.add(id);
    },
    clear(): void {
      seenIds.clear();
    },
  };
}

/**
 * Debounces a callback (e.g., search input or pull-to-refresh) without exposing raw timers in screens.
 */
export function useDebouncedCallback<TArgs extends any[]>(
  callback: (...args: TArgs) => void,
  delayMs: number = 300
): (...args: TArgs) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs]
  );
}
