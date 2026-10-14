const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const cleanup = `-- ==============================================================================
-- STEP 0: CLEANUP ALL OLD & EXISTING TABLES & ROUTINES
-- (Database is confirmed empty with 0 user rows. This ensures a clean slate)
-- ==============================================================================
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.profile_private CASCADE;
DROP TABLE IF EXISTS public.profile_hiring_interests CASCADE;
DROP TABLE IF EXISTS public.profile_skills CASCADE;
DROP TABLE IF EXISTS public.portfolio_items CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.conversation_reads CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.milestones CASCADE;
DROP TABLE IF EXISTS public.agreements CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.gigs CASCADE;
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.rate_limit_events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Old prototype tables
DROP TABLE IF EXISTS public.staff_moderation_actions CASCADE;
DROP TABLE IF EXISTS public.content_reports CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;
DROP TABLE IF EXISTS public.payment_confirmations CASCADE;
DROP TABLE IF EXISTS public.payment_reports CASCADE;
DROP TABLE IF EXISTS public.payment_obligations CASCADE;
DROP TABLE IF EXISTS public.milestone_submissions CASCADE;
DROP TABLE IF EXISTS public.agreement_versions CASCADE;
DROP TABLE IF EXISTS public.gig_versions CASCADE;
DROP TABLE IF EXISTS public.freelancer_profiles CASCADE;
DROP TABLE IF EXISTS public.client_profiles CASCADE;

-- Drop obsolete prototype functions if they exist
DROP FUNCTION IF EXISTS public.deposit_wallet CASCADE;
DROP FUNCTION IF EXISTS public.ensure_wallet_account CASCADE;
DROP FUNCTION IF EXISTS public.fund_escrow CASCADE;
DROP FUNCTION IF EXISTS public.fund_escrow_for_job CASCADE;
DROP FUNCTION IF EXISTS public.release_escrow CASCADE;
DROP FUNCTION IF EXISTS public.withdraw_wallet CASCADE;
DROP FUNCTION IF EXISTS public.sync_job_knowledge_graph CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_knowledge_graph CASCADE;
DROP FUNCTION IF EXISTS public.kg_upsert_node CASCADE;
DROP FUNCTION IF EXISTS public.kg_link CASCADE;

-- Drop all functions to ensure clean slate without return type conflicts
DROP FUNCTION IF EXISTS public.add_profile_skills CASCADE;
DROP FUNCTION IF EXISTS public.add_profile_skills(uuid[], text[]) CASCADE;
DROP FUNCTION IF EXISTS public.remove_profile_skill CASCADE;
DROP FUNCTION IF EXISTS public.remove_profile_skill(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.complete_onboarding CASCADE;
DROP FUNCTION IF EXISTS public.publish_gig CASCADE;
DROP FUNCTION IF EXISTS public.create_draft_gig CASCADE;
DROP FUNCTION IF EXISTS public.submit_application CASCADE;
DROP FUNCTION IF EXISTS public.respond_to_application CASCADE;
DROP FUNCTION IF EXISTS public.respond_to_counter CASCADE;
DROP FUNCTION IF EXISTS public.define_milestones CASCADE;
DROP FUNCTION IF EXISTS public.submit_milestone CASCADE;
DROP FUNCTION IF EXISTS public.review_milestone CASCADE;
DROP FUNCTION IF EXISTS public.report_payment CASCADE;
DROP FUNCTION IF EXISTS public.confirm_payment CASCADE;
DROP FUNCTION IF EXISTS public.dispute_payment CASCADE;
DROP FUNCTION IF EXISTS public.complete_agreement CASCADE;
DROP FUNCTION IF EXISTS public.submit_review CASCADE;
DROP FUNCTION IF EXISTS public.cancel_agreement CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_category CASCADE;
DROP FUNCTION IF EXISTS public.suggest_categories_for_gig CASCADE;
DROP FUNCTION IF EXISTS public.find_similar_categories CASCADE;
DROP FUNCTION IF EXISTS public.get_browse_categories CASCADE;
DROP FUNCTION IF EXISTS public.admin_merge_categories CASCADE;
DROP FUNCTION IF EXISTS public.save_hiring_details CASCADE;
DROP FUNCTION IF EXISTS public.get_profile_completeness CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_details CASCADE;
DROP FUNCTION IF EXISTS public.set_profile_avatar CASCADE;

`;

function makePoliciesIdempotent(sql) {
  // Matches: CREATE POLICY "name" ON table_name
  // or: CREATE POLICY name ON table_name
  const policyRegex = /(?:DROP\s+POLICY\s+IF\s+EXISTS\s+(?:\"[^\"]+\"|[a-zA-Z0-9_]+)\s+ON\s+[a-zA-Z0-9_\.]+\s*;\s*)?CREATE\s+POLICY\s+(\"[^\"]+\"|[a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_\.]+)/gi;
  
  return sql.replace(policyRegex, (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS ${policyName} ON ${tableName};\nCREATE POLICY ${policyName} ON ${tableName}`;
  });
}

function bundleFiles(fileList, header) {
  let content = header || '';
  for (const f of fileList) {
    let text = fs.readFileSync(path.join(dir, f), 'utf8');
    text = makePoliciesIdempotent(text);
    content += '\n-- ==============================================================================\n';
    content += '-- MIGRATION: ' + f + '\n';
    content += '-- ==============================================================================\n';
    content += text + '\n';
  }
  return content;
}

const part1Files = files.filter(f => {
  const num = parseInt(f.slice(0, 14), 10);
  return num <= 20261011000007;
});

const part2Files = files.filter(f => {
  const num = parseInt(f.slice(0, 14), 10);
  return num >= 20261011000008 && num <= 20261011000015;
});

const part3Files = files.filter(f => {
  const num = parseInt(f.slice(0, 14), 10);
  return num >= 20261011000016;
});

const part1 = bundleFiles(part1Files, cleanup);
const part2 = bundleFiles(part2Files, '');
const part3 = bundleFiles(part3Files, '');
const full = bundleFiles(files, cleanup);

// Reference bundles only. Apply schema with `supabase db push`, never by pasting these (AGENTS.md rule 7).
const bundleDir = path.join(__dirname, '..', 'docs', 'sql-bundles');
fs.mkdirSync(bundleDir, { recursive: true });
fs.writeFileSync(path.join(bundleDir, 'FULL_SETUP_MIGRATIONS.sql'), full, 'utf8');
fs.writeFileSync(path.join(bundleDir, 'PART_1_CORE_SCHEMA.sql'), part1, 'utf8');
fs.writeFileSync(path.join(bundleDir, 'PART_2_LOOP_AND_MESSAGING.sql'), part2, 'utf8');
fs.writeFileSync(path.join(bundleDir, 'PART_3_PROFILE_CATEGORIES_SKILLS.sql'), part3, 'utf8');

console.log('Successfully generated idempotent migration bundles:');
console.log(' - FULL_SETUP_MIGRATIONS.sql (' + full.length + ' bytes)');
console.log(' - PART_1_CORE_SCHEMA.sql (' + part1.length + ' bytes, ' + part1Files.length + ' migrations)');
console.log(' - PART_2_LOOP_AND_MESSAGING.sql (' + part2.length + ' bytes, ' + part2Files.length + ' migrations)');
console.log(' - PART_3_PROFILE_CATEGORIES_SKILLS.sql (' + part3.length + ' bytes, ' + part3Files.length + ' migrations)');
