const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing connection to:', SUPABASE_URL);
  
  const { data: events, error: errEvents } = await supabase.from('eventos').select('*').limit(1);
  if (errEvents) {
    console.error('Error fetching eventos:', JSON.stringify(errEvents, null, 2));
  } else {
    console.log('Success fetching eventos:', events);
  }

  const { data: prods, error: errProds } = await supabase.from('productos').select('*').limit(1);
  if (errProds) {
    console.error('Error fetching productos:', JSON.stringify(errProds, null, 2));
  } else {
    console.log('Success fetching productos:', prods);
  }
}

test();
