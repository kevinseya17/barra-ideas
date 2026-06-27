const { createClient } = require('@supabase/supabase-js');
// Manually setting values from .env.local for this test
const SUPABASE_URL = "https://gcqfqugzyzofmovsgbnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWZxdWd6eXpvZm1vdnNnYm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODM4MjgsImV4cCI6MjA5MzI1OTgyOH0.WyrKV_HoisqtcqGRcdKu-TbyX7_wN0ZrA_2aKy5Cck4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listTables() {
  console.log('Listing tables for project:', SUPABASE_URL);
  
  // Try a generic query to see what's available
  // Note: RPC might be required for complex schema inspection, 
  // but we can try to hit known tables one by one.
  
  const tables = ['productos', 'eventos', 'recargas', 'cortesias', 'perdidas', 'descuentos', 'gastos', 'inventario_items', 'proveedores', 'cierres_dinero'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table [${table}]: ERROR - ${error.message} (${error.code})`);
    } else {
      console.log(`Table [${table}]: OK - Found ${data.length} items (limit 1)`);
    }
  }
}

listTables();
