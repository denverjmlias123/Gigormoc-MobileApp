const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing credentials');
  process.exit(1);
}

// Separate client instances for Freelancer and Client
const freelancerClient = createClient(url, key, { auth: { persistSession: false } });
const clientUserClient = createClient(url, key, { auth: { persistSession: false } });

async function runPartB() {
  console.log('=== PART B: ACCOUNT CREATION AND SKILLS VERIFICATION ===\n');

  const ts = Date.now();
  const flEmail = `fl_${ts}@gigormoc.local`;
  const clEmail = `cl_${ts}@gigormoc.local`;
  const password = 'StrongPassword123!';

  // -------------------------------------------------------------
  // ITEM 5: Freelancer Account Creation & Duplicate Email Guard
  // -------------------------------------------------------------
  console.log('--- 1. Testing Freelancer Account Creation ---');
  const { data: flAuth, error: flErr } = await freelancerClient.auth.signUp({
    email: flEmail,
    password,
    options: {
      data: {
        display_name: 'Freelancer Juan',
        dob: '1995-04-12',
        terms_version: 'v1.0'
      }
    }
  });

  if (flErr) {
    console.error('Freelancer sign up error:', flErr.message);
    return;
  }
  const flUserId = flAuth.user?.id;
  console.log('Freelancer created successfully, ID:', flUserId);

  console.log('\n--- 2. Testing Duplicate Email Guard (Mixed Case) ---');
  const mixedEmail = flEmail.toUpperCase();
  console.log('Attempting sign up with:', mixedEmail);
  const { data: dupAuth, error: dupErr } = await freelancerClient.auth.signUp({
    email: mixedEmail,
    password,
    options: {
      data: {
        display_name: 'Imposter User',
        dob: '1995-04-12'
      }
    }
  });

  const isDuplicate = Boolean(
    dupErr || 
    (dupAuth?.user && Array.isArray(dupAuth.user.identities) && dupAuth.user.identities.length === 0)
  );

  console.log('Duplicate check result:', {
    blocked: isDuplicate,
    errorMsg: dupErr ? dupErr.message : (dupAuth?.user?.identities?.length === 0 ? 'Empty identities array (Supabase Auth duplicate signal)' : 'None')
  });

  // Verify rows in profiles
  const { data: flProfiles } = await freelancerClient
    .from('profiles')
    .select('id, display_name, active_mode, onboarding_complete')
    .eq('id', flUserId);
  console.log('Freelancer profile in DB:', flProfiles);

  // -------------------------------------------------------------
  // ITEM 6: Skills Suggestion, Custom Skill, Tray & Manage Skills
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Freelancer Mode Selection ---');
  // Choose initial mode: find_work
  const { error: modeErr } = await freelancerClient.rpc('choose_initial_mode', {
    target_mode: 'find_work'
  });
  console.log('choose_initial_mode (find_work):', modeErr ? modeErr.message : 'SUCCESS');

  console.log('\n--- 4. Testing Onboarding Step 2: Add Profile Skills ---');
  const customSkillName = `Mobile App Dev ${ts % 1000}`;
  const { data: addedSkills, error: addSkillsErr } = await freelancerClient.rpc('add_profile_skills', {
    p_skill_ids: [],
    p_custom_names: [customSkillName]
  });

  console.log('add_profile_skills result:', {
    error: addSkillsErr ? addSkillsErr.message : null,
    addedSkills
  });

  // Query skills and profile_skills directly
  const { data: psRows } = await freelancerClient
    .from('profile_skills')
    .select('profile_id, skill_id, skills(id, name, source, is_active)')
    .eq('profile_id', flUserId);
  console.log('profile_skills rows in DB:', JSON.stringify(psRows, null, 2));

  // Test restriction: Over-limit or duplicate
  console.log('\n--- 5. Testing Skill Restriction Enforcement ---');
  const { error: dupSkillErr } = await freelancerClient.rpc('add_profile_skills', {
    p_skill_ids: [],
    p_custom_names: [customSkillName] // same skill again
  });
  console.log('Duplicate skill addition handled idempotently / deduplicated:', {
    error: dupSkillErr ? dupSkillErr.message : 'Deduplicated (No error, reuses row)'
  });

  // Test skill removal
  if (psRows && psRows.length > 0) {
    const skillToRemove = psRows[0].skill_id;
    console.log('\n--- 6. Testing remove_profile_skill ---');
    const { error: remErr } = await freelancerClient.rpc('remove_profile_skill', {
      p_skill_id: skillToRemove
    });
    console.log('remove_profile_skill result:', remErr ? remErr.message : 'SUCCESS');

    // Re-add skill so freelancer has a skill for profile completeness
    await freelancerClient.rpc('add_profile_skills', {
      p_skill_ids: [],
      p_custom_names: [customSkillName]
    });
  }

  // Complete onboarding for Freelancer
  const { error: flOnboardErr } = await freelancerClient.rpc('complete_onboarding');
  console.log('complete_onboarding (Freelancer):', flOnboardErr ? flOnboardErr.message : 'SUCCESS');

  // Check completeness score for Freelancer
  const { data: flCompleteness } = await freelancerClient.rpc('get_profile_completeness', {
    p_profile_id: flUserId
  });
  console.log('Freelancer profile completeness:', flCompleteness);

  // -------------------------------------------------------------
  // ITEM 7: Client Account Creation & Hiring Details (No Skills)
  // -------------------------------------------------------------
  console.log('\n--- 7. Testing Client Account Creation ---');
  const { data: clAuth, error: clErr } = await clientUserClient.auth.signUp({
    email: clEmail,
    password,
    options: {
      data: {
        display_name: 'Client Maria',
        dob: '1990-08-20',
        terms_version: 'v1.0'
      }
    }
  });

  if (clErr) {
    console.error('Client sign up error:', clErr.message);
    return;
  }
  const clUserId = clAuth.user?.id;
  console.log('Client created successfully, ID:', clUserId);

  // Set client mode to 'hire'
  const { error: clModeErr } = await clientUserClient.rpc('choose_initial_mode', {
    target_mode: 'hire'
  });
  console.log('choose_initial_mode (hire):', clModeErr ? clModeErr.message : 'SUCCESS');

  // Verify that Client calling add_profile_skills is REJECTED
  console.log('\n--- 8. Verifying Client CANNOT Add Skills ---');
  const { error: clientSkillsForbidden } = await clientUserClient.rpc('add_profile_skills', {
    p_skill_ids: [],
    p_custom_names: ['Graphic Design']
  });
  console.log('Client add_profile_skills rejection:', {
    blocked: Boolean(clientSkillsForbidden),
    message: clientSkillsForbidden ? clientSkillsForbidden.message : 'UNEXPECTED PASS'
  });

  // Client saves hiring details
  console.log('\n--- 9. Testing Client Hiring Details Saving ---');
  const { data: hireResult, error: hireErr } = await clientUserClient.rpc('save_hiring_details', {
    p_client_type: 'business',
    p_business_name: 'Ormoc Tech Ventures',
    p_about_hiring: 'We build local mobile and web apps in Ormoc City.',
    p_category_ids: null,
    p_custom_category_names: ['Software', 'Design']
  });
  console.log('save_hiring_details result:', {
    error: hireErr ? hireErr.message : null,
    hireResult
  });

  // Complete onboarding for Client
  const { error: clOnboardErr } = await clientUserClient.rpc('complete_onboarding');
  console.log('complete_onboarding (Client):', clOnboardErr ? clOnboardErr.message : 'SUCCESS');

  // Check completeness score for Client
  const { data: clCompleteness } = await clientUserClient.rpc('get_profile_completeness', {
    p_profile_id: clUserId
  });
  console.log('Client profile completeness:', clCompleteness);

  console.log('\n=== PART B VERIFICATION COMPLETE ===');
}

runPartB().catch(console.error);
