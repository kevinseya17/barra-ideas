import { supabase } from './supabase';
import { Producto, Evento, InventarioItem, Recarga, Cortesia, Perdida, CierreDinero } from '../types';

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

export async function deleteProducto(id: string): Promise<boolean> {
  const { error } = await supabase.from('productos').delete().eq('id', id);
  return !error;
}

// EVENTOS
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

// INVENTARIO (Inicial / Final)
export async function saveInventarioBatch(items: Omit<InventarioItem, 'id'>[]): Promise<boolean> {
  if (items.length === 0) return true;
  const { error } = await supabase.from('inventario_items').insert(items);
  if (error) console.error('Error saving inventario:', error);
  return !error;
}

// OPERACIONES
export async function createRecarga(recarga: Omit<Recarga, 'id'>): Promise<Recarga | null> {
  const { data, error } = await supabase.from('recargas').insert([recarga]).select().single();
  if (error) {
    console.error('Error creating recarga:', error);
    return null;
  }
  return data;
}

export async function createCortesia(cortesia: Omit<Cortesia, 'id'>): Promise<Cortesia | null> {
  const { data, error } = await supabase.from('cortesias').insert([cortesia]).select().single();
  if (error) {
    console.error('Error creating cortesia:', error);
    return null;
  }
  return data;
}

export async function createPerdida(perdida: Omit<Perdida, 'id'>): Promise<Perdida | null> {
  const { data, error } = await supabase.from('perdidas').insert([perdida]).select().single();
  if (error) {
    console.error('Error creating perdida:', error);
    return null;
  }
  return data;
}

// CIERRE DE DINERO
export async function createCierreDinero(cierre: Omit<CierreDinero, 'id'>): Promise<boolean> {
  const { error } = await supabase.from('cierres_dinero').insert([cierre]);
  if (error) console.error('Error creating cierre dinero:', error);
  return !error;
}
