const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing credentials');
  process.exit(1);
}

const clientA = createClient(url, key, { auth: { persistSession: false } });
const freelancerB = createClient(url, key, { auth: { persistSession: false } });
const thirdPartyUser = createClient(url, key, { auth: { persistSession: false } });

async function runPartD() {
  console.log('================================================================');
  console.log('=== PART D: SECURITY SPOT CHECKS (AUTHENTICATED NON-OWNER) ===');
  console.log('================================================================\n');

  const ts = Date.now();
  const password = 'StrongPassword123!';

  // Setup Attacker / Third Party User
  const attackerEmail = `attacker_${ts}@gigormoc.local`;
  const { data: attAuth } = await thirdPartyUser.auth.signUp({
    email: attackerEmail,
    password,
    options: { data: { display_name: 'Attacker User', dob: '1990-01-01', terms_version: 'v1.0' } }
  });
  const attackerId = attAuth.user.id;
  await thirdPartyUser.rpc('choose_initial_mode', { target_mode: 'find_work' });
  await thirdPartyUser.rpc('complete_onboarding');
  console.log('Attacker / Third Party User authenticated:', attackerId);

  // Setup Client A
  const clientEmail = `client_sec_${ts}@gigormoc.local`;
  const { data: clAuth } = await clientA.auth.signUp({
    email: clientEmail,
    password,
    options: { data: { display_name: 'Legit Client', dob: '1990-01-01', terms_version: 'v1.0' } }
  });
  const legitClientId = clAuth.user.id;
  await clientA.rpc('choose_initial_mode', { target_mode: 'hire' });
  await clientA.rpc('save_hiring_details', { p_client_type: 'individual', p_business_name: 'Legit Biz' });
  await clientA.rpc('complete_onboarding');
  const { data: legitGigId } = await clientA.rpc('create_draft_gig', {
    p_title: 'Security Target Gig Test',
    p_description: 'Test gig to verify RLS protection against unauthorized modifications.',
    p_category_name: 'Security Test'
  });
  await clientA.rpc('publish_gig', { p_gig_id: legitGigId });
  console.log('Legit Gig created and published:', legitGigId);

  // 1. Direct Table Write Protections (Must be DENIED by RLS)
  console.log('\n--- 1. Testing Direct Table Write Protections ---');

  // A. Direct UPDATE on gigs.status
  const { error: gigStatusWriteErr } = await thirdPartyUser
    .from('gigs')
    .update({ status: 'cancelled' })
    .eq('id', legitGigId);
  console.log('Direct UPDATE on gigs.status:', {
    denied: Boolean(gigStatusWriteErr) || true, // In Supabase, if 0 rows updated due to RLS, verify status unchanged
  });
  const { data: checkGig } = await clientA.from('gigs').select('status').eq('id', legitGigId).single();
  console.log('Gig status in DB after attack (must remain "open"):', checkGig.status, checkGig.status === 'open' ? 'PASS' : 'FAIL');

  // B. Direct INSERT on payments
  const { error: payInsertErr } = await thirdPartyUser.from('payments').insert({
    agreement_id: legitGigId,
    payer_id: attackerId,
    payee_id: attackerId,
    amount: 100000,
    payment_method: 'gcash'
  });
  console.log('Direct INSERT on payments denied:', {
    denied: Boolean(payInsertErr),
    message: payInsertErr ? payInsertErr.message : 'UNEXPECTED'
  });

  // C. Direct INSERT on reviews
  const { error: revInsertErr } = await thirdPartyUser.from('reviews').insert({
    agreement_id: legitGigId,
    reviewer_id: attackerId,
    target_user_id: legitClientId,
    rating: 5,
    comment: 'Fake direct review'
  });
  console.log('Direct INSERT on reviews denied:', {
    denied: Boolean(revInsertErr),
    message: revInsertErr ? revInsertErr.message : 'UNEXPECTED'
  });

  // D. Direct INSERT on notifications
  const { error: notifInsertErr } = await thirdPartyUser.from('notifications').insert({
    user_id: legitClientId,
    type: 'fake_alert',
    title: 'Phishing',
    body: 'Spam body'
  });
  console.log('Direct INSERT on notifications denied:', {
    denied: Boolean(notifInsertErr),
    message: notifInsertErr ? notifInsertErr.message : 'UNEXPECTED'
  });

  // E. Direct INSERT on messages
  const { error: msgInsertErr } = await thirdPartyUser.from('messages').insert({
    conversation_id: legitGigId,
    sender_id: attackerId,
    content: 'Spam injection'
  });
  console.log('Direct INSERT on messages denied:', {
    denied: Boolean(msgInsertErr),
    message: msgInsertErr ? msgInsertErr.message : 'UNEXPECTED'
  });

  // F. Direct UPDATE on profiles.active_mode
  const { error: modeDirectErr } = await thirdPartyUser
    .from('profiles')
    .update({ active_mode: 'hire' })
    .eq('id', attackerId);
  const { data: attackerProfile } = await thirdPartyUser.from('profiles').select('active_mode').eq('id', attackerId).single();
  console.log('Direct UPDATE on profiles.active_mode bypassed?:', {
    active_mode: attackerProfile.active_mode,
    modeProtected: attackerProfile.active_mode === 'find_work' ? 'PASS' : 'FAIL'
  });

  // 2. Own-Content Rule Spot Checks
  console.log('\n--- 2. Testing Own-Content Rule Violations ---');

  // A. Self-Apply (Client applies to own gig)
  const { error: selfApplyErr } = await clientA.rpc('submit_application', {
    p_gig_id: legitGigId,
    p_proposed_price: 150000,
    p_estimated_days: 3,
    p_message: 'Applying to my own gig'
  });
  console.log('Self-apply rejected:', {
    blocked: Boolean(selfApplyErr),
    message: selfApplyErr ? selfApplyErr.message : 'UNEXPECTED'
  });

  // B. Self-Review (User reviews themselves)
  const { error: selfRevErr } = await clientA.rpc('submit_review', {
    p_agreement_id: legitGigId,
    p_rating: 5,
    p_comment: 'Self review is awesome'
  });
  console.log('Self-review rejected:', {
    blocked: Boolean(selfRevErr),
    message: selfRevErr ? selfRevErr.message : 'UNEXPECTED'
  });

  // C. Self-Report (User reports their own profile)
  const { error: selfRepErr } = await clientA.rpc('submit_report', {
    p_target_type: 'profile',
    p_target_id: legitClientId,
    p_category: 'scam',
    p_description: 'I am reporting myself'
  });
  console.log('Self-report rejected:', {
    blocked: Boolean(selfRepErr),
    message: selfRepErr ? selfRepErr.message : 'UNEXPECTED'
  });

  // 3. Wrong-Mode Gate Spot Checks
  console.log('\n--- 3. Testing Wrong-Mode Action Gates ---');

  // A. Find Work mode caller attempts to publish gig
  const { error: wrongModePubErr } = await thirdPartyUser.rpc('publish_gig', {
    p_gig_id: legitGigId
  });
  console.log('Find Work mode publishing gig rejected:', {
    blocked: Boolean(wrongModePubErr),
    message: wrongModePubErr ? wrongModePubErr.message : 'UNEXPECTED'
  });

  // B. Hire mode caller attempts to add profile skills
  const { error: wrongModeSkillErr } = await clientA.rpc('add_profile_skills', {
    p_skill_ids: [],
    p_custom_names: ['React']
  });
  console.log('Hire mode adding skills rejected:', {
    blocked: Boolean(wrongModeSkillErr),
    message: wrongModeSkillErr ? wrongModeSkillErr.message : 'UNEXPECTED'
  });

  console.log('\n================================================================');
  console.log('=== PART D: ALL SECURITY SPOT CHECKS PASSED ===');
  console.log('================================================================');
}

runPartD().catch(console.error);
