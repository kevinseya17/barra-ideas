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
  // Para evitar errores de FK, borramos en orden inverso las tablas hijas primero
  await supabase.from('inventario').delete().eq('evento_id', id);
  await supabase.from('recargas').delete().eq('evento_id', id);
  await supabase.from('cortesias').delete().eq('evento_id', id);
  await supabase.from('perdidas').delete().eq('evento_id', id);
  await supabase.from('descuentos').delete().eq('evento_id', id);
  await supabase.from('gastos').delete().eq('evento_id', id);
  await supabase.from('cierres_dinero').delete().eq('evento_id', id);
  
  // Finalmente el evento
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  if (error) console.error('Error deleting evento:', error);
  return !error;
}

// INVENTARIO (Inicial / Final)
export async function saveInventarioBatch(items: Omit<InventarioItem, 'id'>[]): Promise<boolean> {
  if (items.length === 0) return true;
  const { error } = await supabase.from('inventario_items').insert(items);
  if (error) {
    console.error('Error saving inventario:', error.message || error);
    alert('Error en base de datos: ' + (error.message || 'Error desconocido'));
  }
  return !error;
}

// OPERACIONES
export async function createRecarga(recarga: Recarga): Promise<boolean> {
  const { id, ...dataToInsert } = recarga;
  const { error } = await supabase.from('recargas').insert([dataToInsert]);
  if (error) {
    console.error('Error creating recarga:', JSON.stringify(error, null, 2));
  }
  return !error;
}

export async function createCortesia(cortesia: Cortesia): Promise<boolean> {
  const { id, ...dataToInsert } = cortesia;
  const { error } = await supabase.from('cortesias').insert([dataToInsert]);
  if (error) {
    console.error('Error creating cortesia:', JSON.stringify(error, null, 2));
  }
  return !error;
}

export async function createPerdida(perdida: Perdida): Promise<boolean> {
  const { id, ...dataToInsert } = perdida;
  const { error } = await supabase.from('perdidas').insert([dataToInsert]);
  if (error) {
    console.error('Error creating perdida:', JSON.stringify(error, null, 2));
  }
  return !error;
}

export async function createDescuento(descuento: Omit<Descuento, 'id'>): Promise<Descuento | null> {
  const { data, error } = await supabase.from('descuentos').insert([descuento]).select().single();
  if (error) {
    console.error('Error creating descuento:', error);
    return null;
  }
  return data;
}

export async function createGasto(gasto: Omit<Gasto, 'id'>): Promise<Gasto | null> {
  const { data, error } = await supabase.from('gastos').insert([gasto]).select().single();
  if (error) {
    console.error('Error creating gasto:', error);
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
