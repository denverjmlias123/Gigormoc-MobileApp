export const strings = {
  common: {
    appName: 'Gigormoc',
    appTagline: 'Local freelance marketplace for Ormoc City (18+ only)',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    continue: 'Continue',
    skip: 'Skip for now',
    delete: 'Delete',
    back: '← Back',
    retry: 'Try Again',
    errorTitle: 'Something went wrong',
    emptyTitle: 'Nothing here yet',
    currencySymbol: '₱',
  },
  modes: {
    findWork: 'Find Work',
    hire: 'Hire Someone',
    findWorkDesc: 'Browse local gigs in Ormoc, send proposals, and earn with your skills.',
    hireDesc: 'Post gigs, review local applicants, and hire skilled freelancers in Ormoc City.',
    switchNote: 'You can switch later, but only under certain conditions.',
  },
  onboarding: {
    skillsTitle: 'Select Your Skills',
    skillsSubtitle: 'Highlight what services you offer to help clients discover you.',
    yourSkillsTrayLabel: 'Your skills',
    yourSkillsEmptyHint: 'No skills selected yet. Pick from the catalog, use AI suggestions, or type a custom skill below.',
    saveSkillsBtn: 'Save Skills',
    savingSkillsText: 'Saving skills...',
    skillsSavedText: 'Saved',
    pendingReviewBadge: 'Pending review',
    zeroSkillsWarning: 'You need at least 1 skill to apply for gigs',
    aiSkillsPlaceholder: 'What kind of work do you do? (e.g. aircon repair, math tutor, delivery)',
    suggestSkillsBtn: '✨ Suggest skills',
    suggestingSkills: 'Thinking of skills...',
    addCustomSkillPlaceholder: 'Type a custom skill name (2–40 chars)...',
    addCustomSkillBtn: 'Add Skill',
    hiringTitle: 'What do you usually need help with?',
    hiringSubtitle: 'Tell local freelancers in Ormoc what kind of projects or services you look for.',
    aiCategoriesPlaceholder: 'Describe what you usually need help with (e.g. aircon cleaning, errands, graphic design)',
    suggestCategoriesBtn: '✨ Suggest categories',
    suggestingCategories: 'Thinking of categories...',
    addCustomCategoryPlaceholder: 'Type a custom category...',
    addCustomCategoryBtn: 'Add Category',
    bioTitle: 'Introduce Yourself',
    bioSubtitle: 'Tell clients and collaborators in Ormoc a little bit about what you do.',
    helpMeWriteBioBtn: '✨ Help me write this',
    draftingBio: 'Drafting bio options...',
    bioDraftsTitle: 'Suggested Drafts (Tap to use)',
    finishSetupBtn: 'Finish Setup',
    skipForNow: 'Skip for now',
  },
  auth: {
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Log in to your Gigormoc account',
    signupTitle: 'Create Account',
    step1Title: 'Account Details',
    step2Title: 'Age Confirmation',
    step2Subtitle:
      'Gigormoc is strictly for adults aged 18 and older. Your birth date is kept strictly confidential and is never shown publicly.',
    confirmEmailTitle: 'Confirm Your Email',
    forgotPasswordTitle: 'Reset Password',
    duplicateEmailMessage: 'This email is already registered. Log in or reset your password.',
    duplicateEmailLoginBtn: 'Log in',
    duplicateEmailResetBtn: 'Reset password',
    invalidEmailFormat: 'Please enter a valid email address.',
    disposableEmailTypo: 'Please check your email domain for typos (for example, @gmail.com or @yahoo.com).',
  },
  gigs: {
    title: 'Gigs',
    availableGigs: 'Available Gigs',
    myGigs: 'My Posted Gigs',
    postGig: 'Post a Gig',
    postGigTitle: 'Create a New Gig',
    searchPlaceholder: 'Search gigs by title or keywords...',
    filterAll: 'All Work Types',
    filterRemote: 'Remote',
    filterFaceToFace: 'Face-to-face',
    filterHybrid: 'Hybrid',
    noGigsTitle: 'No gigs posted yet',
    noGigsDesc: 'There are currently no active gigs in this category. Check back soon or post one.',
    noMyGigsTitle: "You haven't posted any gigs yet",
    noMyGigsDesc: 'Ready to find local talent in Ormoc? Post a gig with clear requirements and budget.',
    applyBtn: 'Apply for Gig',
    deadline: 'Deadline',
    applicationDeadline: 'Apply before',
    budget: 'Budget',
    requirements: 'Requirements',
    workType: 'Work Type',
    area: 'Location / Barangay',
    draftStatus: 'Draft',
    openStatus: 'Open',
    publishBtn: 'Publish Gig',
    saveDraftBtn: 'Save Draft',
    cancelGigBtn: 'Cancel Gig',
    categoryLabel: 'Category *',
    categoryHelper: 'Pick a suggested category, search existing categories, or create a general category if none fit.',
    suggestedCategoriesLabel: 'Suggested for your gig',
    aiSuggestCategoryBtn: '✨ Suggest best category',
    aiSuggestingCategory: 'Matching categories...',
    searchOrCreateCategoryPlaceholder: 'Search categories or type a new category name (3–40 chars)...',
    didYouMeanLabel: 'Did you mean an existing category?',
    createNewCategoryPrompt: 'No matching category? Create a new one:',
    confirmCreateNewCategoryPrefix: 'No, create',
    confirmCreateNewCategorySuffix: 'as a new category',
    addNewCategoryPrefix: 'Add',
    addNewCategorySuffix: 'as a new category',
    aiProposedCategoryLabel: 'AI suggested new category:',
    filterAllCategories: 'All Categories',
    hireModeRequiredTitle: 'Hire Someone Mode Required',
    hireModeRequiredDesc: 'You are currently in Find Work mode. Posting gigs is exclusively for clients in Hire Someone mode.',
  },
  payments: {
    reportedSent: 'Reported',
    confirmedReceived: 'Confirmed by freelancer',
    disputed: 'Disputed',
    disclaimer: 'Payments happen outside Gigormoc. Gigormoc only records them.',
  },
  profile: {
    title: 'My Profile',
    editProfile: 'Edit Profile Details',
    manageSkills: 'Manage Skills',
    portfolio: 'Portfolio Items',
    viewPublic: 'View Public Profile',
    logout: 'Log Out',
    ratingLabel: 'Rating',
    completedGigsLabel: 'Gigs completed',
    profileCompleteBadge: 'Profile complete',
    completenessTitle: 'Profile completeness',
    completenessHint: 'Tap a missing item below to jump to it:',
    unsavedChangesTitle: 'Discard unsaved changes?',
    unsavedChangesBody: 'You have unsaved profile edits. Are you sure you want to leave without saving?',
    discardBtn: 'Discard',
    keepEditingBtn: 'Keep editing',
    privateFieldNote: 'Private — never shown on your public profile',
    photoSectionTitle: 'Profile Photo',
    chooseFromLibraryBtn: 'Choose from photos/files',
    takePhotoBtn: 'Take a photo',
    removePhotoBtn: 'Remove photo',
    languagesList: ['English', 'Tagalog', 'Bisaya', 'Waray', 'Other'] as const,
    workTypeOptions: [
      { value: 'remote', label: 'Remote' },
      { value: 'face_to_face', label: 'Face-to-face' },
      { value: 'hybrid', label: 'Hybrid' },
    ] as const,
    availabilityOptions: [
      { value: 'available_now', label: 'Available now' },
      { value: 'part_time', label: 'Part-time' },
      { value: 'weekends', label: 'Weekends' },
      { value: 'not_taking_work', label: 'Not taking work' },
    ] as const,
    experienceOptions: [
      { value: 'lt_1', label: 'Less than 1 year' },
      { value: '1_3', label: '1–3 years' },
      { value: '3_5', label: '3–5 years' },
      { value: '5_plus', label: '5+ years' },
    ] as const,
    clientTypeOptions: [
      { value: 'individual', label: 'Individual / Household' },
      { value: 'business', label: 'Small Business / Shop' },
      { value: 'organization', label: 'School / Organization' },
      { value: 'other', label: 'Other' },
    ] as const,
  },
  loop: {
    timelineTitle: 'Relationship Progress',
    youAreHereBadge: 'You are here',
    nextStepPrefix: 'Next step',
    yourTurnBadge: 'Your turn to act',
    waitingBadge: 'Waiting on other side',
    openChatBtn: '💬 Open Chat',
    viewStageBtn: 'Go to Stage ›',
    stages: {
      posted: 'Posted',
      applied: 'Applied',
      accepted: 'Accepted',
      milestones_set: 'Milestones set',
      work_submitted: 'Work submitted',
      approved: 'Approved',
      payment_reported: 'Payment reported',
      payment_confirmed: 'Payment confirmed',
      done: 'Done',
      reviewed: 'Reviewed',
    },
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Network connection error. Please check your internet connection and try again.',
    unauthorized: 'Please log in to continue.',
    forbidden: 'You do not have permission to perform this action.',
    duplicateEntry: 'This record already exists.',
    cooldownActive: 'Mode switch is currently on its 7-day cooldown.',
    activeCommitmentsBlock: 'Please finish or resolve active gigs, proposals, or agreements before switching modes.',
    invalidMilestoneSum: 'The sum of all milestone amounts must equal the agreed project price.',
    maxRevisionsReached: 'Maximum of 2 revisions has already been used for this milestone.',
    reviewWindowClosed: 'The 14-day review window for this agreement has closed.',
    offline: "You appear to be offline. Changes can't be saved until your connection returns.",
    timeout: 'The request took too long. Please check your connection and try again.',
    sessionExpired: 'Your session expired. Please log in again.',
    loggedOutNotice: 'You were logged out.',
    conflict: 'This was already updated. Showing the latest.',
    alreadyDoneOtherDevice: 'Already done on your other device.',
    rateLimited: 'Too many tries. Please wait a moment and try again.',
    notFound: 'The requested item could not be found or was removed.',
    serverError: 'Our server encountered a temporary issue. Please try again in a moment.',
    wrongCredentials: 'Incorrect email or password. Please check your credentials and try again.',
    emailNotConfirmed: 'Please confirm your email address before logging in.',
    accountSuspended: 'Your account is currently suspended or inactive. Please contact support.',
    wrongMode: 'This action requires switching your active mode in Settings.',
    uploadTooLarge: 'File is too large. Please choose a file under 5 MB.',
    uploadInvalidType: 'Unsupported file format. Please upload a JPG, PNG, or WebP image.',
    uploadPermissionDenied: 'Permission to access your files or photos was denied.',
  },
};

/**
 * Maps raw Postgres / Supabase RPC, Auth, Network, or Storage errors to friendly user-facing messages
 * from constants/strings.ts while preserving explicit human-readable validation messages.
 */
export function mapSqlErrorToFriendlyMessage(
  err: unknown,
  fallback: string = strings.errors.generic
): string {
  if (!err) return fallback;
  const rawMessage =
    typeof err === 'string'
      ? err
      : typeof (err as any)?.message === 'string'
      ? (err as any).message
      : '';
  const code = typeof (err as any)?.code === 'string' ? (err as any).code : '';
  const status = typeof (err as any)?.status === 'number' ? (err as any).status : 0;
  const name = typeof (err as any)?.name === 'string' ? (err as any).name : '';
  const lower = rawMessage.toLowerCase();

  // 1. Offline / Network
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('offline') ||
    lower.includes('internet connection')
  ) {
    return strings.errors.network;
  }

  // 2. Timeout / Abort
  if (
    name === 'AbortError' ||
    code === 'ETIMEDOUT' ||
    code === '57014' ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('aborted')
  ) {
    return strings.errors.timeout;
  }

  // 3. Auth / Session Expired / 401
  if (
    status === 401 ||
    code === 'PGRST301' ||
    lower.includes('jwt expired') ||
    lower.includes('invalid jwt') ||
    lower.includes('refresh_token_not_found') ||
    lower.includes('session_not_found') ||
    lower.includes('session expired')
  ) {
    return strings.errors.sessionExpired;
  }

  if (lower.includes('not authenticated') || lower.includes('authentication required')) {
    return strings.errors.unauthorized;
  }

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('wrong password')
  ) {
    return strings.errors.wrongCredentials;
  }

  if (lower.includes('email not confirmed') || code === 'email_not_confirmed') {
    return strings.errors.emailNotConfirmed;
  }

  // 4. Rate limit / 429
  if (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('too many attempts') ||
    lower.includes('for security purposes, you can only request this after')
  ) {
    const waitMatch = rawMessage.match(/(\d+)\s*second/i);
    if (waitMatch) {
      return `Too many tries. Please wait ${waitMatch[1]} seconds.`;
    }
    return strings.errors.rateLimited;
  }

  // 5. Account suspended / Mode / Forbidden
  if (
    lower.includes('account is not active') ||
    lower.includes('suspended') ||
    lower.includes('deactivated')
  ) {
    return strings.errors.accountSuspended;
  }

  if (
    lower.includes('must be in hire') ||
    lower.includes('must be in find work') ||
    lower.includes('only be added in find work') ||
    lower.includes('only be modified in find work') ||
    lower.includes('only be saved in hire')
  ) {
    return rawMessage || strings.errors.wrongMode;
  }

  if (
    status === 403 ||
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('access denied')
  ) {
    return strings.errors.forbidden;
  }

  // 6. Not found
  if (
    status === 404 ||
    code === 'PGRST116' ||
    lower.includes('not found') ||
    lower.includes('no rows')
  ) {
    return rawMessage && !rawMessage.includes('PGRST') ? rawMessage : strings.errors.notFound;
  }

  // 7. Conflict / Duplicate / Stale state
  if (lower.includes('already_done') || lower.includes('already done on your other device')) {
    return strings.errors.alreadyDoneOtherDevice;
  }

  if (
    status === 409 ||
    code === '23505' ||
    lower.includes('duplicate key value') ||
    lower.includes('unique constraint') ||
    lower.includes('already updated')
  ) {
    return strings.errors.conflict;
  }

  // 8. Storage upload errors
  if (lower.includes('payload too large') || lower.includes('exceeded the maximum allowed size') || lower.includes('5mb') || lower.includes('5 mb')) {
    return strings.errors.uploadTooLarge;
  }
  if (lower.includes('mime type') || lower.includes('invalid_mime_type') || lower.includes('unsupported file')) {
    return strings.errors.uploadInvalidType;
  }

  // 9. Domain rules
  if (lower.includes('cooldown')) {
    return rawMessage || strings.errors.cooldownActive;
  }
  if (lower.includes('milestone') && lower.includes('sum')) {
    return rawMessage || strings.errors.invalidMilestoneSum;
  }
  if (lower.includes('revision') && lower.includes('max')) {
    return rawMessage || strings.errors.maxRevisionsReached;
  }
  if (lower.includes('14') && lower.includes('review')) {
    return rawMessage || strings.errors.reviewWindowClosed;
  }

  // 10. Server / raw SQL sanitization (never leak PGRST*, SQLSTATE codes, or syntax error text)
  if (
    status >= 500 ||
    /^PGRST\d+/i.test(code) ||
    /^(22|23|42|53|54|55|57|58|XX)\w{3}$/i.test(code) ||
    lower.includes('syntax error at or near') ||
    lower.includes('relation "') ||
    lower.includes('column "') ||
    lower.includes('internal server error')
  ) {
    return strings.errors.serverError;
  }

  return rawMessage.trim() || fallback;
}


