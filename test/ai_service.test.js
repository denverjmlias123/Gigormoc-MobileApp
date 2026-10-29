const test = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// Register module loader hook for resolving TypeScript extensions and mocking ../lib/supabase
register(
  pathToFileURL(path.resolve(__dirname, 'loader.mjs')).href,
  pathToFileURL(path.resolve(__dirname, 'ai_service.test.js'))
);

let aiService;
let mockSupabase;

test.before(async () => {
  mockSupabase = await import('./mocks/supabase.mjs');
  const aiModule = await import('../services/ai.ts');
  aiService = aiModule.aiService;
});

test.beforeEach(() => {
  mockSupabase.resetMock();
});

test('aiService.suggestSkills: validation, auth check, happy path, and error handling', async () => {
  // 1. Validation: empty or whitespace description
  await assert.rejects(
    () => aiService.suggestSkills(''),
    /Please describe the work you do\./
  );
  await assert.rejects(
    () => aiService.suggestSkills('   \n  '),
    /Please describe the work you do\./
  );

  // 2. Auth check: unauthenticated session
  mockSupabase.setMockSession(null);
  await assert.rejects(
    () => aiService.suggestSkills('I do electrical work'),
    /Not authenticated\./
  );

  // 3. Happy path
  mockSupabase.setMockSession({ user: { id: 'u1' } });
  mockSupabase.setMockInvokeResult({
    data: { skills: ['Plumbing', 'Pipe Repair'] },
    error: null,
  });

  const skills = await aiService.suggestSkills('  Fixing pipes and leaks  ');
  assert.deepEqual(skills, ['Plumbing', 'Pipe Repair']);

  const lastCall = mockSupabase.lastInvokeCall;
  assert.equal(lastCall.functionName, 'ai-assist');
  assert.deepEqual(lastCall.options.body, {
    task: 'suggest_skills',
    work_description: 'Fixing pipes and leaks',
  });

  // 4. Nullish data fallback -> returns []
  mockSupabase.setMockInvokeResult({ data: null, error: null });
  const emptySkills = await aiService.suggestSkills('Carpentry');
  assert.deepEqual(emptySkills, []);

  // 5. Edge function error with message
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: 'Edge function rate limited' },
  });
  await assert.rejects(
    () => aiService.suggestSkills('House painting'),
    /Edge function rate limited/
  );

  // 6. Edge function error with context.json() payload
  mockSupabase.setMockInvokeResult({
    data: null,
    error: {
      message: 'Generic error',
      context: {
        json: async () => ({ error: 'Detailed error from edge body' }),
      },
    },
  });
  await assert.rejects(
    () => aiService.suggestSkills('House painting'),
    /Detailed error from edge body/
  );

  // 7. Edge function error without message or json -> fallback message
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: '' },
  });
  await assert.rejects(
    () => aiService.suggestSkills('House painting'),
    /Could not fetch skill suggestions\./
  );
});

test('aiService.suggestCategories: validation, auth check, happy path, and error handling', async () => {
  // 1. Validation
  await assert.rejects(
    () => aiService.suggestCategories(''),
    /Please describe the help you usually need\./
  );
  await assert.rejects(
    () => aiService.suggestCategories('   '),
    /Please describe the help you usually need\./
  );

  // 2. Auth check
  mockSupabase.setMockSession(null);
  await assert.rejects(
    () => aiService.suggestCategories('Cleaning services'),
    /Not authenticated\./
  );

  // 3. Happy path
  mockSupabase.setMockSession({ user: { id: 'u1' } });
  mockSupabase.setMockInvokeResult({
    data: { categories: ['Home Repair', 'Cleaning'] },
    error: null,
  });

  const categories = await aiService.suggestCategories('  Need house cleaning  ');
  assert.deepEqual(categories, ['Home Repair', 'Cleaning']);

  const lastCall = mockSupabase.lastInvokeCall;
  assert.equal(lastCall.functionName, 'ai-assist');
  assert.deepEqual(lastCall.options.body, {
    task: 'suggest_categories',
    help_description: 'Need house cleaning',
  });

  // 4. Nullish data fallback
  mockSupabase.setMockInvokeResult({ data: null, error: null });
  const emptyCategories = await aiService.suggestCategories('Gardening');
  assert.deepEqual(emptyCategories, []);

  // 5. Error with fallback
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: '' },
  });
  await assert.rejects(
    () => aiService.suggestCategories('Gardening'),
    /Could not fetch category suggestions\./
  );
});

test('aiService.suggestGigCategory: validation, auth check, truncation, happy path, defaults, and error handling', async () => {
  // 1. Validation: title and description both < 3 chars
  await assert.rejects(
    () => aiService.suggestGigCategory({ title: 'a', description: 'b' }),
    /Please enter a gig title or description first\./
  );
  await assert.rejects(
    () => aiService.suggestGigCategory({ title: '', description: '  ' }),
    /Please enter a gig title or description first\./
  );

  // 2. Auth check
  mockSupabase.setMockSession(null);
  await assert.rejects(
    () => aiService.suggestGigCategory({ title: 'Fix sink drain' }),
    /Not authenticated\./
  );

  // 3. Happy path with title and description truncation (max 600 chars)
  mockSupabase.setMockSession({ user: { id: 'u1' } });
  mockSupabase.setMockInvokeResult({
    data: {
      suggestions: [
        { category_id: 'c1', name: 'Plumbing', slug: 'plumbing', reason: 'Fits pipe repair' },
      ],
      proposed_new_category: null,
    },
    error: null,
  });

  const longTitle = 'T'.repeat(700);
  const longDesc = 'D'.repeat(700);
  const res = await aiService.suggestGigCategory({ title: longTitle, description: longDesc });

  assert.equal(res.suggestions.length, 1);
  assert.equal(res.suggestions[0].category_id, 'c1');
  assert.equal(res.proposed_new_category, null);

  const lastCall = mockSupabase.lastInvokeCall;
  assert.equal(lastCall.options.body.task, 'suggest_gig_category');
  assert.equal(lastCall.options.body.title.length, 600);
  assert.equal(lastCall.options.body.description.length, 600);

  // 4. Default fallbacks when data structure is empty/non-array
  mockSupabase.setMockInvokeResult({
    data: { suggestions: 'not an array', proposed_new_category: undefined },
    error: null,
  });
  const defaultRes = await aiService.suggestGigCategory({ title: 'Valid Title' });

  assert.deepEqual(defaultRes, {
    suggestions: [],
    proposed_new_category: null,
  });

  // 5. Proposed new category output
  mockSupabase.setMockInvokeResult({
    data: {
      suggestions: [],
      proposed_new_category: 'Drone Photography',
    },
    error: null,
  });
  const newCatRes = await aiService.suggestGigCategory({ title: 'Aerial Photography' });
  assert.equal(newCatRes.proposed_new_category, 'Drone Photography');

  // 6. Error handling with fallback message
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: '' },
  });
  await assert.rejects(
    () => aiService.suggestGigCategory({ title: 'Fix sink' }),
    /Could not fetch AI category suggestions\./
  );
});

test('aiService.draftBio: auth check, default parameter fallbacks, happy path, and error handling', async () => {
  // 1. Auth check
  mockSupabase.setMockSession(null);
  await assert.rejects(
    () => aiService.draftBio({}),
    /Not authenticated\./
  );

  // 2. Default parameter fallbacks
  mockSupabase.setMockSession({ user: { id: 'u1' } });
  mockSupabase.setMockInvokeResult({
    data: { drafts: ['Experienced plumber in Ormoc.', 'Reliable pipe specialist.'] },
    error: null,
  });

  const drafts = await aiService.draftBio({});
  assert.deepEqual(drafts, ['Experienced plumber in Ormoc.', 'Reliable pipe specialist.']);

  const lastCall = mockSupabase.lastInvokeCall;
  assert.equal(lastCall.functionName, 'ai-assist');
  assert.deepEqual(lastCall.options.body, {
    task: 'draft_bio',
    mode: 'find_work',
    skills: [],
    area: '',
    rough_bio: '',
  });

  // 3. Explicit parameters
  await aiService.draftBio({
    mode: 'hire',
    skills: ['Carpentry'],
    area: 'Poblacion',
    roughBio: 'Need help around the house',
  });
  const explicitCall = mockSupabase.lastInvokeCall;
  assert.deepEqual(explicitCall.options.body, {
    task: 'draft_bio',
    mode: 'hire',
    skills: ['Carpentry'],
    area: 'Poblacion',
    rough_bio: 'Need help around the house',
  });

  // 4. Missing data fallback -> returns []
  mockSupabase.setMockInvokeResult({ data: null, error: null });
  const emptyDrafts = await aiService.draftBio({});
  assert.deepEqual(emptyDrafts, []);

  // 5. Error with fallback
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: '' },
  });
  await assert.rejects(
    () => aiService.draftBio({}),
    /Could not draft bio\./
  );
});

test('aiService.polishGigDescription: validation, auth check, happy path, fallback to trimmed original, and error handling', async () => {
  // 1. Validation: empty or whitespace description
  await assert.rejects(
    () => aiService.polishGigDescription(''),
    /Description is required\./
  );
  await assert.rejects(
    () => aiService.polishGigDescription('   \n '),
    /Description is required\./
  );

  // 2. Auth check
  mockSupabase.setMockSession(null);
  await assert.rejects(
    () => aiService.polishGigDescription('Grass cutting'),
    /Not authenticated\./
  );

  // 3. Happy path
  mockSupabase.setMockSession({ user: { id: 'u1' } });
  mockSupabase.setMockInvokeResult({
    data: {
      polished_description:
        'Professional grass cutting and lawn maintenance service in Ormoc.',
    },
    error: null,
  });

  const polished = await aiService.polishGigDescription(
    '  Need someone to cut grass in my yard  '
  );
  assert.equal(
    polished,
    'Professional grass cutting and lawn maintenance service in Ormoc.'
  );

  const lastCall = mockSupabase.lastInvokeCall;
  assert.equal(lastCall.functionName, 'ai-assist');
  assert.deepEqual(lastCall.options.body, {
    task: 'polish_gig_description',
    description: 'Need someone to cut grass in my yard',
  });

  // 4. Fallback to trimmed description if data.polished_description is missing
  mockSupabase.setMockInvokeResult({
    data: { polished_description: '' },
    error: null,
  });
  const fallbackDesc = await aiService.polishGigDescription('  Fix roof leak  ');
  assert.equal(fallbackDesc, 'Fix roof leak');

  // 5. Error with fallback message
  mockSupabase.setMockInvokeResult({
    data: null,
    error: { message: '' },
  });
  await assert.rejects(
    () => aiService.polishGigDescription('Fix roof leak'),
    /Could not polish gig description\./
  );
});
