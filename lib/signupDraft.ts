export interface SignupDraft {
  displayName: string;
  email: string;
  password: string;
}

let currentSignupDraft: SignupDraft | null = null;

export function setSignupDraft(draft: SignupDraft) {
  currentSignupDraft = { ...draft };
}

export function getSignupDraft(): SignupDraft | null {
  return currentSignupDraft ? { ...currentSignupDraft } : null;
}

export function clearSignupDraft() {
  currentSignupDraft = null;
}
