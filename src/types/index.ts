export interface Producto {
  id: string;
  nombre: string;
  categoria: 'licor' | 'cerveza' | 'gaseosa' | 'agua' | 'snack' | 'otro';
  unidad: 'botella' | 'unidad' | 'caja' | 'lata';
  costo: number;
  precio: number;
  activo?: boolean;
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
  proveedor?: string;
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
  hora: string;
}

export interface Perdida {
  id: string;
  evento_id: string;
  producto_id: string;
  cantidad: number;
  motivo: string;
  hora: string;
}

export interface Descuento {
  id: string;
  evento_id: string;
  producto_id: string;
  cantidad: number;
  porcentaje: number;
  valor_descontado: number;
  motivo: string;
  hora: string;
}

export interface Gasto {
  id: string;
  evento_id: string;
  concepto: string;
  monto: number;
  metodo: 'efectivo' | 'datafono' | 'nequi';
  hora: string;
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
  desc?: number;
  valorDescontadoTotales?: number;
  valorCortesiaTotales?: number;
  valorPerdidaTotales?: number;
  ventaPotencial?: number;
  fin: number;
  disponible: number;
  consumo: number;
  vendido: number;
  ingresoEsperado: number;
  costoCortesias: number;
  proveedor: string;
}

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  tipo: 'info' | 'recarga' | 'cortesia' | 'perdida' | 'descuento' | 'gasto' | 'cierre';
  metadata?: any;
}
