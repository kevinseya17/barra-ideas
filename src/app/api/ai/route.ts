import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Allow up to 120 seconds for local Ollama responses
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Fetch live system context
  let liveContext = '';
  try {
    const { data: openEvents } = await supabase
      .from('eventos')
      .select('id, nombre, estado')
      .in('estado', ['abierto', 'congelado']);
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, categoria, precio, costo, comision')
      .eq('activo', true);

    if (openEvents && openEvents.length > 0) {
      const baseName = openEvents[0].nombre.replace('BODEGA - ', '').split(' - ')[0];
      const { data: allRelated } = await supabase.from('eventos').select('id, nombre');
      const relatedIds = (allRelated || [])
        .filter(e =>
          e.nombre === `BODEGA - ${baseName}` ||
          e.nombre === baseName ||
          e.nombre.startsWith(`${baseName} - `)
        )
        .map(e => e.id);

      const ids = relatedIds.length > 0 ? relatedIds : [openEvents[0].id];
      const [recargas, cortesias, perdidas, gastos, dineros] = await Promise.all([
        supabase.from('recargas').select('producto_id, cantidad, proveedor').in('evento_id', ids),
        supabase.from('cortesias').select('producto_id, cantidad, persona, motivo').in('evento_id', ids),
        supabase.from('perdidas').select('producto_id, cantidad, motivo').in('evento_id', ids),
        supabase.from('gastos').select('monto, concepto, metodo').in('evento_id', ids),
        supabase.from('cierres_dinero').select('efectivo, datafono, nequi').in('evento_id', ids),
      ]);

      const totalEfectivo = (dineros?.data || []).reduce((a, b) => a + Number(b.efectivo || 0), 0);
      const totalDatafono = (dineros?.data || []).reduce((a, b) => a + Number(b.datafono || 0), 0);
      const totalNequi    = (dineros?.data || []).reduce((a, b) => a + Number(b.nequi    || 0), 0);
      const totalGastos   = (gastos?.data   || []).reduce((a, b) => a + Number(b.monto   || 0), 0);

      liveContext = `
--- CONTEXTO EN VIVO DEL EVENTO ("${baseName}") ---
Eventos/Barras activas: ${openEvents.map(e => e.nombre).join(', ')}
Catálogo: ${productos?.length || 0} productos
Recaudación:
- Efectivo: $${totalEfectivo.toLocaleString('es-CO')}
- Datáfono: $${totalDatafono.toLocaleString('es-CO')}
- Nequi/QR: $${totalNequi.toLocaleString('es-CO')}
- Gastos: $${totalGastos.toLocaleString('es-CO')}
- Neto: $${(totalEfectivo + totalDatafono + totalNequi - totalGastos).toLocaleString('es-CO')}
Operaciones: ${recargas?.data?.length || 0} recargas, ${cortesias?.data?.length || 0} cortesías, ${perdidas?.data?.length || 0} bajas
---`;
    }
  } catch (e) {
    console.warn('No se pudo obtener contexto en vivo:', e);
  }

  const systemMessage = {
    role: 'system',
    content: `Eres "BarraPro IA", el asistente experto en bodega, inventario y caja para eventos y discotecas en Colombia.
Responde de forma clara, amigable y concisa. Usa Markdown (negritas, listas, emojis). Usa los datos del contexto cuando estén disponibles.
${liveContext}`
  };

  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  let OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

  // Auto-detect model
  try {
    const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (tagsRes.ok) {
      const tagsData = await tagsRes.json();
      const available = (tagsData.models || []).map((m: any) => m.name);
      if (available.length > 0 && !available.includes(OLLAMA_MODEL)) {
        OLLAMA_MODEL = available[0];
      }
    }
  } catch {}

  // Use streaming to handle slow models and avoid timeout
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: [systemMessage, ...(messages || [])],
            stream: true,
          }),
        });

        if (!ollamaRes.ok || !ollamaRes.body) {
          const errText = await ollamaRes.text().catch(() => '');
          const msg = `data: ${JSON.stringify({ error: `Ollama error ${ollamaRes.status}: ${errText}` })}\n\n`;
          controller.enqueue(encoder.encode(msg));
          controller.close();
          return;
        }

        const reader = ollamaRes.body.getReader();
        const dec = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              const token = json?.message?.content || '';
              if (token) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
              }
              if (json.done) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              }
            } catch {}
          }
        }
      } catch (err: any) {
        const errMsg = `⚠️ No se pudo conectar con Ollama. Ejecuta: \`ollama run ${OLLAMA_MODEL}\`\n\nDetalle: ${err.message}`;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
