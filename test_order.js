const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://gcqfqugzyzofmovsgbnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWZxdWd6eXpvZm1vdnNnYm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODM4MjgsImV4cCI6MjA5MzI1OTgyOH0.WyrKV_HoisqtcqGRcdKu-TbyX7_wN0ZrA_2aKy5Cck4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testOrder() {
  console.log('Testing getEventos with order...');
  const { data, error } = await supabase.from('eventos').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Order Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Order Success:', data.length, 'events found');
  }
}

testOrder();
