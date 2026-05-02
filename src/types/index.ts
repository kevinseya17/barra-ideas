export interface Producto {
  id: string;
  nombre: string;
  categoria: 'licor' | 'cerveza' | 'gaseosa' | 'agua' | 'snack' | 'otro';
  unidad: 'botella' | 'unidad' | 'caja' | 'lata';
  costo: number;
  precio: number;
}

export interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  responsable: string;
  caja_inicial: number;
  estado: 'abierto' | 'cerrado';
  created_at?: string;
}

export interface InventarioItem {
  id: string;
  evento_id: string;
  producto_id: string;
  tipo: 'inicial' | 'final';
  cantidad: number;
}

export interface Recarga {
  id: string;
  evento_id: string;
  producto_id: string;
  cantidad: number;
  hora: string;
  proveedor: string;
}

export interface Cortesia {
  id: string;
  evento_id: string;
  producto_id: string;
  cantidad: number;
  persona: string;
  motivo: string;
}

export interface Perdida {
  id: string;
  evento_id: string;
  producto_id: string;
  cantidad: number;
  motivo: string;
}

export interface CierreDinero {
  id: string;
  evento_id: string;
  efectivo: number;
  datafono: number;
  nequi: number;
}

export interface ResumenProducto extends Producto {
  ini: number;
  rec: number;
  cor: number;
  per: number;
  fin: number;
  disponible: number;
  consumo: number;
  vendido: number;
  ingresoEsperado: number;
  costoCortesias: number;
}

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  tipo: 'info' | 'recarga' | 'cortesia' | 'perdida' | 'cierre';
}
