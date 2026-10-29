export let mockSession = { user: { id: 'test-user-id' } };
export let mockInvokeResult = { data: null, error: null };
export let lastInvokeCall = null;

export function setMockSession(session) {
  mockSession = session;
}

export function setMockInvokeResult(result) {
  mockInvokeResult = result;
}

export function resetMock() {
  mockSession = { user: { id: 'test-user-id' } };
  mockInvokeResult = { data: null, error: null };
  lastInvokeCall = null;
}

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: mockSession } };
    },
  },
  functions: {
    async invoke(functionName, options) {
      lastInvokeCall = { functionName, options };
      return typeof mockInvokeResult === 'function'
        ? mockInvokeResult(functionName, options)
        : mockInvokeResult;
    },
  },
};
