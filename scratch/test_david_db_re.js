const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gcqfqugzyzofmovsgbnc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWZxdWd6eXpvZm1vdnNnYm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODM4MjgsImV4cCI6MjA5MzI1OTgyOH0.WyrKV_HoisqtcqGRcdKu-TbyX7_wN0ZrA_2aKy5Cck4');

async function run() {
  const { data: eventos } = await supabase.from('eventos').select('*').in('estado', ['abierto']);
  console.log('Eventos Abiertos:', eventos?.length);
  
  if (eventos && eventos.length > 0) {
    for (const ev of eventos) {
      console.log('\n---', ev.nombre, '---');
      console.log('ID:', ev.id);
      
      const { data: recargas } = await supabase.from('recargas').select('*').eq('evento_id', ev.id);
      const { data: inv } = await supabase.from('inventario_items').select('*').eq('evento_id', ev.id);
      const { data: perdidas } = await supabase.from('perdidas').select('*').eq('evento_id', ev.id);
      
      console.log('Recargas:', recargas?.length, '| Perdidas:', perdidas?.length, '| Inventario:', inv?.length);
    }
  }
}
run();
