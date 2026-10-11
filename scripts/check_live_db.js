const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log('Testing connection to live Supabase URL:', url);
  
  // 1. Check categories table
  const { data: categories, error: catErr } = await supabase.from('categories').select('*').limit(5);
  console.log('Categories query:', { catErr: catErr ? catErr.message : null, count: categories ? categories.length : null });

  // 2. Check skills table
  const { data: skills, error: skillErr } = await supabase.from('skills').select('*').limit(5);
  console.log('Skills query:', { skillErr: skillErr ? skillErr.message : null, count: skills ? skills.length : null });

  // 3. Check gigs table
  const { data: gigs, error: gigErr } = await supabase.from('gigs').select('*').limit(5);
  console.log('Gigs query:', { gigErr: gigErr ? gigErr.message : null, count: gigs ? gigs.length : null });

  // 4. Check profile_skills table
  const { data: ps, error: psErr } = await supabase.from('profile_skills').select('*').limit(5);
  console.log('Profile_skills query:', { psErr: psErr ? psErr.message : null });

  // 5. Check areas table
  const { data: areas, error: areaErr } = await supabase.from('areas').select('*').limit(5);
  console.log('Areas query:', { areaErr: areaErr ? areaErr.message : null });

  // 6. Check RPC get_available_gigs or get_browse_categories
  const { data: browseCats, error: browseErr } = await supabase.rpc('get_browse_categories');
  console.log('get_browse_categories RPC:', { browseErr: browseErr ? browseErr.message : null, browseCats });
}

testConnection().catch(console.error);
