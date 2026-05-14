import { supabase } from './supabase';
import { Producto, Evento, InventarioItem, Recarga, Cortesia, Perdida, CierreDinero, Gasto, Descuento } from '../types';

// PRODUCTOS
export async function getProductos(): Promise<Producto[]> {
  const { data, error } = await supabase.from('productos').select('*').order('nombre');
  if (error) {
    console.error('Error fetching productos:', error);
    return [];
  }
  return data || [];
}

export async function createProducto(prod: Omit<Producto, 'id'>): Promise<Producto | null> {
  const { data, error } = await supabase.from('productos').insert([prod]).select().single();
  if (error) {
    console.error('Error creating producto:', error);
    return null;
  }
  return data;
}

export async function updateProducto(id: string, prod: Partial<Producto>): Promise<boolean> {
  const { error } = await supabase.from('productos').update(prod).eq('id', id);
  if (error) console.error('Error updating producto:', error);
  return !error;
}

export async function deleteProducto(id: string): Promise<boolean> {
  const { error } = await supabase.from('productos').delete().eq('id', id);
  return !error;
}

// EVENTOS
export async function getEventos(): Promise<Evento[]> {
  const { data, error } = await supabase.from('eventos').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching eventos:', error);
    return [];
  }
  return data;
}

export async function getEventoActivo(): Promise<Evento | null> {
  try {
    const { data, error } = await supabase.from('eventos').select('*').eq('estado', 'abierto').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) {
      console.error('Error fetching active event:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Network error fetching active event (Failed to fetch?):', err);
    return null;
  }
}

export async function getEventoData(eventoId: string) {
  const [recargas, cortesias, perdidas, descuentos, gastos, inventario] = await Promise.all([
    supabase.from('recargas').select('*').eq('evento_id', eventoId),
    supabase.from('cortesias').select('*').eq('evento_id', eventoId),
    supabase.from('perdidas').select('*').eq('evento_id', eventoId),
    supabase.from('descuentos').select('*').eq('evento_id', eventoId),
    supabase.from('gastos').select('*').eq('evento_id', eventoId),
    supabase.from('inventario_items').select('*').eq('evento_id', eventoId),
  ]);

  return {
    recargas: recargas.data || [],
    cortesias: cortesias.data || [],
    perdidas: perdidas.data || [],
    descuentos: descuentos.data || [],
    gastos: gastos.data || [],
    inventario: inventario.data || [],
  };
}

export async function createEvento(evento: Omit<Evento, 'id' | 'estado' | 'created_at'>): Promise<Evento | null> {
  const { data, error } = await supabase.from('eventos').insert([{ ...evento, estado: 'abierto' }]).select().single();
  if (error) {
    console.error('Error creating evento:', error);
    return null;
  }
  return data;
}

export async function closeEvento(id: string): Promise<boolean> {
  const { error } = await supabase.from('eventos').update({ estado: 'cerrado' }).eq('id', id);
  return !error;
}

export async function deleteEventoCascade(id: string): Promise<boolean> {
  await supabase.from('inventario_items').delete().eq('evento_id', id);
  await supabase.from('recargas').delete().eq('evento_id', id);
  await supabase.from('cortesias').delete().eq('evento_id', id);
  await supabase.from('perdidas').delete().eq('evento_id', id);
  await supabase.from('descuentos').delete().eq('evento_id', id);
  await supabase.from('gastos').delete().eq('evento_id', id);
  await supabase.from('cierres_dinero').delete().eq('evento_id', id);
  
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  if (error) console.error('Error deleting evento:', error);
  return !error;
}

// INVENTARIO
export async function saveInventarioBatch(items: Omit<InventarioItem, 'id'>[]): Promise<boolean> {
  if (items.length === 0) return true;
  
  console.log(`💾 Guardando ${items.length} items de inventario...`);
  
  try {
    const { evento_id, tipo } = items[0];
    const prodIds = items.map(i => i.producto_id);

    // 1. Limpiar registros previos del mismo tipo para este evento (Simulando upsert)
    await supabase.from('inventario_items')
      .delete()
      .eq('evento_id', evento_id)
      .eq('tipo', tipo)
      .in('producto_id', prodIds);

    // 2. Insertar los nuevos
    const { error } = await supabase.from('inventario_items').insert(items);

    if (error) {
      console.error('❌ Error de Supabase al guardar inventario:', JSON.stringify(error, null, 2));
      return false;
    }
    
    console.log('✅ Inventario guardado con éxito');
    return true;
  } catch (err: any) {
    console.error('🔥 Error crítico al guardar inventario:', err.message || err);
    return false;
  }
}

// OPERACIONES (Ahora aceptamos el ID del frontend)
export async function createRecarga(recarga: Recarga): Promise<boolean> {
  const { error } = await supabase.from('recargas').insert([recarga]);
  if (error) console.error('Error creating recarga:', JSON.stringify(error));
  return !error;
}

export async function createCortesia(cortesia: Cortesia): Promise<boolean> {
  const { error } = await supabase.from('cortesias').insert([cortesia]);
  if (error) console.error('Error creating cortesia:', JSON.stringify(error));
  return !error;
}

export async function createPerdida(perdida: Perdida): Promise<boolean> {
  const { error } = await supabase.from('perdidas').insert([perdida]);
  if (error) console.error('Error creating perdida:', JSON.stringify(error));
  return !error;
}

export async function createDescuento(descuento: Descuento): Promise<boolean> {
  const { error } = await supabase.from('descuentos').insert([descuento]);
  if (error) console.error('Error creating descuento:', error);
  return !error;
}

export async function createGasto(gasto: Gasto): Promise<boolean> {
  const { error } = await supabase.from('gastos').insert([gasto]);
  if (error) console.error('Error creating gasto:', error);
  return !error;
}

export async function createCierreDinero(cierre: Omit<CierreDinero, 'id'>): Promise<boolean> {
  const { error } = await supabase.from('cierres_dinero').insert([cierre]);
  if (error) console.error('Error creating cierre dinero:', error);
  return !error;
}

export async function deleteRecord(table: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`Error deleting from ${table}:`, error);
  return !error;
}

export async function updateRecord(table: string, id: string, data: any): Promise<boolean> {
  const { error } = await supabase.from(table).update(data).eq('id', id);
  if (error) console.error(`Error updating record in ${table}:`, error);
  return !error;
}

// PROVEEDORES
export async function getProveedores(): Promise<string[]> {
  const { data, error } = await supabase.from('proveedores').select('nombre').order('nombre');
  if (error) return [];
  return data.map(p => p.nombre);
}

export async function createProveedor(nombre: string): Promise<boolean> {
  const { error } = await supabase.from('proveedores').insert([{ nombre: nombre.trim() }]);
  return !error;
}

export async function deleteProveedor(nombre: string): Promise<boolean> {
  const { error } = await supabase.from('proveedores').delete().eq('nombre', nombre);
  return !error;
}
