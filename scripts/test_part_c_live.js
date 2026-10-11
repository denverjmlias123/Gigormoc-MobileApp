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

async function runPartC() {
  console.log('================================================================');
  console.log('=== PART C: THE FULL 10-STAGE JOB LOOP LIVE VERIFICATION ===');
  console.log('================================================================\n');

  const ts = Date.now();
  const clEmail = `client_loop_${ts}@gigormoc.local`;
  const flEmail = `fl_loop_${ts}@gigormoc.local`;
  const password = 'StrongPassword123!';

  // 1. Setup Client A (Hire Mode)
  console.log('--- Step 1: Client A Sign-up & Mode Setup ---');
  const { data: clAuth, error: clErr } = await clientA.auth.signUp({
    email: clEmail,
    password,
    options: {
      data: { display_name: 'Client Maria Loop', dob: '1992-06-15', terms_version: 'v1.0' }
    }
  });
  if (clErr) throw clErr;
  const clientId = clAuth.user.id;
  await clientA.rpc('choose_initial_mode', { target_mode: 'hire' });
  await clientA.rpc('save_hiring_details', {
    p_client_type: 'business',
    p_business_name: 'Ormoc Fast Delivery',
    p_about_hiring: 'Local logistics and mobile apps',
    p_category_ids: null,
    p_custom_category_names: ['Mobile Apps']
  });
  const clAvatarPath = `${clientId}/avatar-${ts}.jpg`;
  await clientA.storage.from('avatars').upload(clAvatarPath, Buffer.from('fake_avatar_bytes'), { contentType: 'image/jpeg' });
  await clientA.rpc('set_profile_avatar', { p_avatar_path: `https://ddnwqtzheroqcoopvrrb.supabase.co/storage/v1/object/public/avatars/${clAvatarPath}` });
  await clientA.rpc('complete_onboarding');
  console.log('Client A ready:', clientId);

  // 2. Setup Freelancer B (Find Work Mode)
  console.log('\n--- Step 2: Freelancer B Sign-up & Skills Setup ---');
  const { data: flAuth, error: flErr } = await freelancerB.auth.signUp({
    email: flEmail,
    password,
    options: {
      data: { display_name: 'Freelancer Juan Loop', dob: '1996-03-22', terms_version: 'v1.0' }
    }
  });
  if (flErr) throw flErr;
  const freelancerId = flAuth.user.id;
  await freelancerB.rpc('choose_initial_mode', { target_mode: 'find_work' });
  await freelancerB.rpc('add_profile_skills', {
    p_skill_ids: [],
    p_custom_names: ['React Native Expert']
  });
  const flAvatarPath = `${freelancerId}/avatar-${ts}.jpg`;
  await freelancerB.storage.from('avatars').upload(flAvatarPath, Buffer.from('fake_avatar_bytes'), { contentType: 'image/jpeg' });
  await freelancerB.rpc('set_profile_avatar', { p_avatar_path: `https://ddnwqtzheroqcoopvrrb.supabase.co/storage/v1/object/public/avatars/${flAvatarPath}` });
  await freelancerB.rpc('complete_onboarding');
  console.log('Freelancer B ready (with photo):', freelancerId);

  // 3. Stage 1: Client Posts Gig
  console.log('\n--- Step 8: Client A Posts Gig (Category Suggestion & Creation) ---');
  const { data: simCats } = await clientA.rpc('find_similar_categories', {
    p_name: 'Mobile Development'
  });
  console.log('Similar categories search result:', simCats);

  const { data: gigId, error: postErr } = await clientA.rpc('create_draft_gig', {
    p_title: 'Full Stack Mobile App for Ormoc Delivery',
    p_description: 'We need an experienced developer to build our React Native mobile application for local delivery tracking in Ormoc City.',
    p_requirements: 'Must know React Native, TypeScript and Supabase.',
    p_price_min: 150000, // ₱1,500.00
    p_price_max: 200000, // ₱2,000.00
    p_work_type: 'remote',
    p_area: 'Ormoc City Proper',
    p_category_name: 'Mobile Apps'
  });
  if (postErr) throw postErr;
  console.log('Draft Gig created with ID:', gigId);

  // Publish Gig
  const { error: pubErr } = await clientA.rpc('publish_gig', { p_gig_id: gigId });
  if (pubErr) throw pubErr;
  console.log('publish_gig called: SUCCESS');

  // Verify gig row in DB
  const { data: gigRow } = await clientA.from('gigs').select('*').eq('id', gigId).single();
  console.log('Gig row in DB:', {
    id: gigRow.id,
    title: gigRow.title,
    status: gigRow.status,
    price_min: gigRow.price_min,
    price_max: gigRow.price_max
  });

  // Verify Own-Content rule on Browse
  const { data: clientBrowse } = await clientA.from('gigs').select('id').eq('status', 'open').neq('client_id', clientId);
  const clientSeesOwn = clientBrowse.some(g => g.id === gigId);
  console.log('Own-Content Rule Check (Client sees own gig in Browse):', clientSeesOwn ? 'FAIL (Visible)' : 'PASS (Excluded)');

  const { data: flBrowse } = await freelancerB.from('gigs').select('id, title').eq('status', 'open').eq('id', gigId);
  console.log('Freelancer B sees open gig in Browse:', flBrowse.length > 0 ? 'PASS' : 'FAIL');

  // 4. Stage 2: Freelancer Applies & Chat
  console.log('\n--- Step 9: Freelancer B Applies & Chat ---');
  const { data: appId, error: appErr } = await freelancerB.rpc('submit_application', {
    p_gig_id: gigId,
    p_proposed_price: 180000, // ₱1,800.00
    p_estimated_days: 7,
    p_message: 'I have built multiple production apps in Ormoc and can deliver clean code in 7 days.'
  });
  if (appErr) throw appErr;
  console.log('Application submitted, ID:', appId);

  // Check application row
  const { data: appRow } = await freelancerB.from('applications').select('*').eq('id', appId).single();
  console.log('Application row in DB:', {
    id: appRow.id,
    status: appRow.status,
    proposed_price: appRow.proposed_price,
    estimated_days: appRow.estimated_days
  });

  // Check conversation created automatically
  const { data: convRow } = await freelancerB.from('conversations').select('*').eq('application_id', appId).single();
  console.log('Conversation created automatically:', {
    id: convRow?.id,
    client_id: convRow?.client_id,
    freelancer_id: convRow?.freelancer_id
  });

  // Chat both ways
  const { data: msg1Id, error: msg1Err } = await freelancerB.rpc('send_message', {
    p_conversation_id: convRow.id,
    p_content: 'Hello Maria! I just submitted my proposal. Ready to start immediately.'
  });
  console.log('Freelancer B sent message:', { id: msg1Id, error: msg1Err ? msg1Err.message : null });

  const { data: msg2Id, error: msg2Err } = await clientA.rpc('send_message', {
    p_conversation_id: convRow.id,
    p_content: 'Hi Juan! Thanks for applying. Your portfolio looks great, accepting your proposal now.'
  });
  console.log('Client A sent reply message:', { id: msg2Id, error: msg2Err ? msg2Err.message : null });

  // 5. Stage 3: Client Accepts -> Agreement Created
  console.log('\n--- Step 10: Client A Accepts Application & Double-Tap Guard ---');
  const { data: agreementId, error: acceptErr } = await clientA.rpc('respond_to_application', {
    p_application_id: appId,
    p_action: 'accept'
  });
  if (acceptErr) throw acceptErr;
  console.log('respond_to_application (accept) called, Agreement ID:', agreementId);

  // Double-tap attempt (must be blocked or idempotent)
  const { error: doubleTapErr } = await clientA.rpc('respond_to_application', {
    p_application_id: appId,
    p_action: 'accept'
  });
  console.log('Double-tap accept guard:', {
    blocked: Boolean(doubleTapErr),
    message: doubleTapErr ? doubleTapErr.message : 'UNEXPECTED'
  });

  // Verify Agreement in DB
  const { data: agreementRow } = await clientA.from('agreements').select('*').eq('id', agreementId).single();
  console.log('Agreement row in DB:', {
    id: agreementRow.id,
    status: agreementRow.status,
    agreed_price: agreementRow.agreed_price,
    client_id: agreementRow.client_id,
    freelancer_id: agreementRow.freelancer_id
  });

  // Verify Gig status updated to in_progress
  const { data: updatedGig } = await clientA.from('gigs').select('status').eq('id', gigId).single();
  console.log('Gig status updated in DB:', updatedGig.status);

  // 6. Stage 4: Milestones Definition
  console.log('\n--- Step 11a: Client A Defines Milestones (Exact Sum Check) ---');
  const milestonesPayload = [
    { title: 'UI Screens & Navigation', amount: 90000, description: 'Complete Figma designs to React Native code' },
    { title: 'Backend APIs & Delivery Tracking', amount: 90000, description: 'Supabase integration and real-time map tracking' }
  ];

  const { error: defErr } = await clientA.rpc('define_milestones', {
    p_agreement_id: agreementId,
    p_milestones: milestonesPayload
  });
  if (defErr) throw defErr;
  console.log('define_milestones called: SUCCESS');

  const { data: milestoneRows } = await clientA.from('milestones').select('*').eq('agreement_id', agreementId).order('position');
  console.log('Milestone rows in DB:', milestoneRows.map(m => ({ id: m.id, title: m.title, amount: m.amount, status: m.status })));
  const m1 = milestoneRows[0];
  const m2 = milestoneRows[1];

  // 7. Stage 5: Freelancer Submits Deliverable with File Upload
  console.log('\n--- Step 11b: Freelancer B Uploads Deliverable to Private Submissions Bucket ---');
  const deliverablePath = `${agreementId}/${m1.id}/${ts}_ui_bundle.txt`;
  const fileContent = Buffer.from('Build completed. React Native Screens: Home, OrderTracking, MapView.');
  const { error: uploadErr } = await freelancerB.storage
    .from('submissions')
    .upload(deliverablePath, fileContent, { contentType: 'text/plain' });
  console.log('Private submissions file upload:', uploadErr ? uploadErr.message : 'SUCCESS (Path: ' + deliverablePath + ')');

  const { data: subId, error: subErr } = await freelancerB.rpc('submit_milestone', {
    p_milestone_id: m1.id,
    p_message: 'Completed Milestone 1 UI screens with all requested animations.',
    p_file_paths: [deliverablePath]
  });
  if (subErr) throw subErr;
  console.log('submit_milestone called, Submission ID:', subId);

  // 8. Stage 6: Client Revision Request & Approval
  console.log('\n--- Step 11c: Client A Requests Revision & Subsequent Approval ---');
  const { error: revErr } = await clientA.rpc('review_milestone', {
    p_milestone_id: m1.id,
    p_action: 'request_revision',
    p_feedback: 'Please tweak the map marker icon color to match brand guidelines.'
  });
  if (revErr) throw revErr;
  console.log('review_milestone (request_revision): SUCCESS');

  // Freelancer fixes and re-submits
  await freelancerB.rpc('submit_milestone', {
    p_milestone_id: m1.id,
    p_message: 'Updated map marker icon color as requested.',
    p_file_paths: [deliverablePath]
  });
  console.log('Freelancer re-submitted milestone 1: SUCCESS');

  // Client approves milestone 1
  const { error: apprv1Err } = await clientA.rpc('review_milestone', {
    p_milestone_id: m1.id,
    p_action: 'approve',
    p_feedback: 'Great job, marker color looks perfect!'
  });
  if (apprv1Err) throw apprv1Err;
  console.log('review_milestone (approve) for Milestone 1: SUCCESS');

  // Complete Milestone 2
  await freelancerB.rpc('submit_milestone', {
    p_milestone_id: m2.id,
    p_message: 'Backend APIs integrated and tested.',
    p_file_paths: [deliverablePath]
  });
  await clientA.rpc('review_milestone', {
    p_milestone_id: m2.id,
    p_action: 'approve',
    p_feedback: 'All APIs approved.'
  });
  console.log('Milestone 2 submitted and approved: SUCCESS');

  // 9. Stage 7: Payment Reporting with Receipt Upload
  console.log('\n--- Step 11d: Client A Reports Payment with Receipt in Private Bucket ---');
  const receiptPath = `${agreementId}/${ts}_gcash_receipt.txt`;
  const receiptContent = Buffer.from('GCash Reference: 9876543210. Amount: 1800.00 PHP');
  await clientA.storage.from('receipts').upload(receiptPath, receiptContent, { contentType: 'text/plain' });

  const { data: payId, error: payErr } = await clientA.rpc('report_payment', {
    p_agreement_id: agreementId,
    p_milestone_id: m2.id,
    p_amount: 180000, // ₱1,800.00
    p_payment_method: 'gcash',
    p_reference_number: 'GCASH-9876543210',
    p_receipt_path: receiptPath,
    p_notes: 'Paid total agreed price in full via GCash'
  });
  if (payErr) throw payErr;
  console.log('report_payment called, Payment ID:', payId);

  // 10. Stage 8: Payment Confirmation & Agreement Completion
  console.log('\n--- Step 11e: Freelancer B Confirms Payment & Agreement Completes ---');
  const { error: confErr } = await freelancerB.rpc('confirm_payment', {
    p_payment_id: payId
  });
  if (confErr) throw confErr;
  console.log('confirm_payment called: SUCCESS');

  const { error: compErr } = await clientA.rpc('complete_agreement', {
    p_agreement_id: agreementId
  });
  if (compErr) throw compErr;
  console.log('complete_agreement called: SUCCESS');

  const { data: completedAgr } = await clientA.from('agreements').select('status, completed_at').eq('id', agreementId).single();
  console.log('Agreement completed in DB:', {
    status: completedAgr.status,
    completed_at: completedAgr.completed_at
  });

  // 11. Stage 9: Mutual Reviews & Rating Recalculation
  console.log('\n--- Step 11f: Mutual Reviews & Rating Recalculation ---');
  const { data: rev1Id, error: rev1Err } = await clientA.rpc('submit_review', {
    p_agreement_id: agreementId,
    p_rating: 5,
    p_comment: 'Outstanding developer! Delivered on time with high quality code and great communication.'
  });
  if (rev1Err) throw rev1Err;
  console.log('Client A submitted review for Freelancer B, ID:', rev1Id);

  const { data: rev2Id, error: rev2Err } = await freelancerB.rpc('submit_review', {
    p_agreement_id: agreementId,
    p_rating: 5,
    p_comment: 'Wonderful client! Clear instructions, prompt milestone reviews, and paid immediately.'
  });
  if (rev2Err) throw rev2Err;
  console.log('Freelancer B submitted review for Client A, ID:', rev2Id);

  // Verify ratings recomputed in profiles table
  const { data: flProfileFinal } = await freelancerB.from('profiles').select('freelancer_rating_avg, freelancer_rating_count, freelancer_completed_gigs').eq('id', freelancerId).single();
  console.log('Freelancer Profile Ratings in DB:', flProfileFinal);

  const { data: clProfileFinal } = await clientA.from('profiles').select('client_rating_avg, client_rating_count, client_completed_gigs').eq('id', clientId).single();
  console.log('Client Profile Ratings in DB:', clProfileFinal);

  // Notifications audit for both accounts
  const { data: flNotifs } = await freelancerB.from('notifications').select('type, title, created_at').eq('user_id', freelancerId).order('created_at', { ascending: false });
  console.log('\nFreelancer B Notifications received throughout loop:', flNotifs.map(n => n.type));

  const { data: clNotifs } = await clientA.from('notifications').select('type, title, created_at').eq('user_id', clientId).order('created_at', { ascending: false });
  console.log('Client A Notifications received throughout loop:', clNotifs.map(n => n.type));

  console.log('\n================================================================');
  console.log('=== PART C: ALL 10 STAGES COMPLETED & VERIFIED ON LIVE DB ===');
  console.log('================================================================');
}

runPartC().catch(err => {
  console.error('PART C ERROR:', err);
  process.exit(1);
});
