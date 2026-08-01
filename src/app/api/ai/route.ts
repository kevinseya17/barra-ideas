import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { messages, contextData } = await req.json();
    const userPrompt = messages?.[messages.length - 1]?.content || '';

    // Fetch live system context if not provided
    let liveContext = '';

    try {
      // Fetch open events
      const { data: openEvents } = await supabase.from('eventos').select('id, nombre, estado').in('estado', ['abierto', 'congelado']);
      const { data: productos } = await supabase.from('productos').select('id, nombre, categoria, precio, costo, comision').eq('activo', true);

      if (openEvents && openEvents.length > 0) {
        const baseName = openEvents[0].nombre.replace('BODEGA - ', '').split(' - ')[0];
        
        const { data: allRelated } = await supabase.from('eventos').select('id, nombre');
        const relatedIds = (allRelated || [])
          .filter(e => e.nombre === `BODEGA - ${baseName}` || e.nombre === baseName || e.nombre.startsWith(`${baseName} - `))
          .map(e => e.id);

        const [recargas, cortesias, perdidas, gastos, dineros, inventario] = await Promise.all([
          supabase.from('recargas').select('producto_id, cantidad, proveedor').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
          supabase.from('cortesias').select('producto_id, cantidad, persona, motivo').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
          supabase.from('perdidas').select('producto_id, cantidad, motivo').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
          supabase.from('gastos').select('monto, concepto, metodo').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
          supabase.from('cierres_dinero').select('efectivo, datafono, nequi').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
          supabase.from('inventario_items').select('producto_id, cantidad, tipo').in('evento_id', relatedIds.length > 0 ? relatedIds : [openEvents[0].id]),
        ]);

        const prodMap = new Map((productos || []).map(p => [p.id, p]));

        const totalEfectivo = (dineros?.data || []).reduce((a, b) => a + Number(b.efectivo || 0), 0);
        const totalDatafono = (dineros?.data || []).reduce((a, b) => a + Number(b.datafono || 0), 0);
        const totalNequi    = (dineros?.data || []).reduce((a, b) => a + Number(b.nequi    || 0), 0);
        const totalGastos   = (gastos?.data || []).reduce((a, b) => a + Number(b.monto || 0), 0);

        liveContext = `
--- CONTEXTO EN VIVO DEL EVENTO ACTUAL ("${baseName}") ---
Eventos/Barras activas: ${openEvents.map(e => e.nombre).join(', ')}
Total Productos en Catálogo: ${productos?.length || 0}
Recaudación en Caja:
- Efectivo: $${totalEfectivo.toLocaleString('es-CO')}
- Datáfono: $${totalDatafono.toLocaleString('es-CO')}
- Nequi / QR: $${totalNequi.toLocaleString('es-CO')}
- Gastos registrados: $${totalGastos.toLocaleString('es-CO')}
- Recaudado Neto (Efectivo + Datáfono + Nequi - Gastos): $${(totalEfectivo + totalDatafono + totalNequi - totalGastos).toLocaleString('es-CO')}

Resumen de operaciones registradas:
- Recargas registradas: ${recargas?.data?.length || 0}
- Cortesías registradas: ${cortesias?.data?.length || 0}
- Pérdidas/Bajas registradas: ${perdidas?.data?.length || 0}
---------------------------------------------------------
`;
      }
    } catch (e) {
      console.warn('Could not fetch live context for AI prompt:', e);
    }

    const systemMessage = {
      role: 'system',
      content: `Eres "BarraPro IA", el asistente inteligente experto en gestión de bodega, inventario, ventas y cuadre de caja para eventos y discotecas.
Tu objetivo es ayudar a los administradores a entender sus cifras, auditar pérdidas, generar recomendaciones de stock, hacer conciliaciones y responder cualquier duda de la operación.

REGLAS DE RESPUESTA:
1. Responde de forma clara, directa, profesional y amigable usando lenguaje colombiano moderado si aplica.
2. Usa formato Markdown elegante (negritas, listas con viñetas, emojis relevantes).
3. Si los datos actuales están en el contexto, úsalos para dar respuestas exactas y numéricas.
4. Si la pregunta es sobre cómo usar el sistema, guíalos paso a paso.

${liveContext}`
    };

    const formattedMessages = [systemMessage, ...(messages || [])];

    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    let OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

    // Auto-detect installed model if available
    try {
      const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        const availableModels = (tagsData.models || []).map((m: any) => m.name);
        if (availableModels.length > 0) {
          if (process.env.OLLAMA_MODEL && availableModels.includes(process.env.OLLAMA_MODEL)) {
            OLLAMA_MODEL = process.env.OLLAMA_MODEL;
          } else {
            OLLAMA_MODEL = availableModels[0]; // Auto-use installed model (e.g. qwen2.5:7b)
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-detect Ollama tags:', e);
    }

    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: formattedMessages,
          stream: false,
        }),
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        throw new Error(`Ollama API error (${ollamaRes.status}): ${errText}`);
      }

      const data = await ollamaRes.json();
      const aiReply = data?.message?.content || 'No se recibió respuesta de Ollama.';

      return NextResponse.json({ reply: aiReply });
    } catch (err: any) {
      console.error('Error connecting to local Ollama server:', err.message || err);
      return NextResponse.json({
        reply: `⚠️ **No se pudo comunicar con Ollama en tu PC.**

Verifica que el servicio esté activo ejecutando en tu terminal:
\`ollama run ${OLLAMA_MODEL}\`

*Detalle:* ${err.message || 'Error de conexión'}`
      });
    }
  } catch (error: any) {
    console.error('Error in AI Route:', error);
    return NextResponse.json({
      reply: `⚠️ Ocurrió un inconveniente al procesar la solicitud: ${error?.message || 'Error interno'}`
    });
  }
}
