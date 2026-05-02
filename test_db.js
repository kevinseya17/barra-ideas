const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://upgrsqatxeokoagcwbks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZ3JzcWF0eGVva29hZ2N3YmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTM0NzUsImV4cCI6MjA5MDMyOTQ3NX0.b87zEqrr-dznnsOwX58mKHlVcgLjYEJkTTJwaf5-KCQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Testing connection...");
  const { data, error } = await supabase.from('productos').select('*').limit(1);
  if (error) {
    console.error("Error from Supabase:", JSON.stringify(error, null, 2));
  } else {
    console.log("Success! Data:", data);
  }
}
test();
