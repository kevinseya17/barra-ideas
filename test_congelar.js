const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gcqfqugzyzofmovsgbnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWZxdWd6eXpvZm1vdnNnYm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODM4MjgsImV4cCI6MjA5MzI1OTgyOH0.WyrKV_HoisqtcqGRcdKu-TbyX7_wN0ZrA_2aKy5Cck4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: evs, error } = await supabase.from('eventos').select('id, nombre, estado').order('created_at', { ascending: false }).limit(5);
  if (error) { console.error('Error:', error.message); return; }

  console.log('\n📋 Eventos actuales:');
  evs.forEach(e => console.log(` - [${e.estado}] ${e.nombre}`));

  const barra = evs.find(e => !e.nombre.startsWith('BODEGA'));
  if (!barra) { console.log('\nNo hay barra para probar'); return; }

  console.log(`\n❄️  Probando congelar: "${barra.nombre}" (${barra.estado})`);
  const { error: errC } = await supabase.from('eventos').update({ estado: 'congelado' }).eq('id', barra.id);
  if (errC) {
    console.log('❌ ERROR al congelar:', errC.message);
    console.log('Código:', errC.code);
    console.log('Detalle:', errC.details);
  } else {
    console.log('✅ Congelar funciona correctamente en Supabase');
    await supabase.from('eventos').update({ estado: barra.estado }).eq('id', barra.id);
    console.log(`↩️  Revertido a "${barra.estado}"`);
  }
}

test().catch(console.error);
