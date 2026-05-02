'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, PackageOpen } from 'lucide-react';
import { Producto } from '@/types';
import * as api from '@/lib/api';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';

const CATEGORIAS = ['licor', 'cerveza', 'gaseosa', 'agua', 'snack', 'otro'] as const;
const UNIDADES = ['botella', 'unidad', 'caja', 'lata'] as const;

const prodVacio = (): Omit<Producto, 'id'> => ({
  nombre: '', categoria: 'licor', unidad: 'botella', costo: 0, precio: 0,
});

interface Props {
  onContinuar: (evento: { nombre: string; fecha: string; responsable: string; caja_inicial: number }, productos: Producto[]) => void;
  eventoInicial?: { nombre: string; fecha: string; responsable: string; caja_inicial: number } | null;
  productosIniciales?: Producto[];
}

export default function Apertura({ onContinuar, eventoInicial, productosIniciales }: Props) {
  const [form, setForm] = useState({
    nombre: eventoInicial?.nombre || '',
    fecha: eventoInicial?.fecha || '',
    responsable: eventoInicial?.responsable || '',
    caja_inicial: eventoInicial?.caja_inicial ? String(eventoInicial.caja_inicial) : '',
  });
  const [productos, setProductos] = useState<Producto[]>(productosIniciales || []);
  const [nuevo, setNuevo] = useState<Omit<Producto, 'id'>>(prodVacio());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (productosIniciales) {
      setCargando(false);
      return;
    }
    api.getProductos().then(data => {
      setProductos(data);
      setCargando(false);
    });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const agregarProducto = async () => {
    if (!nuevo.nombre.trim()) return;
    const prodGuardado = await api.createProducto({ ...nuevo, costo: Number(nuevo.costo), precio: Number(nuevo.precio) });
    if (prodGuardado) {
      setProductos(p => [...p, prodGuardado]);
      setNuevo(prodVacio());
    } else {
      alert("Error al guardar el producto en la base de datos");
    }
  };

  const eliminarProducto = async (id: string) => {
    const ok = await api.deleteProducto(id);
    if (ok) {
      setProductos(p => p.filter(x => x.id !== id));
    } else {
      alert("Error al eliminar el producto");
    }
  };

  const continuar = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!form.responsable.trim()) e.responsable = 'El responsable es obligatorio';
    if (productos.length === 0) e.productos = 'Agrega al menos un producto';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    onContinuar({ ...form, caja_inicial: Number(form.caja_inicial || 0) }, productos);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <SectionHeader
        step="PASO 1 / APERTURA"
        title="Abrir evento"
        sub="Configura el nombre, responsable y productos antes de iniciar."
      />

      {/* Datos del evento */}
      <Card className="p-8 mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <PackageOpen size={20} />
          </div>
          Datos del evento
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="Nombre del evento" error={errores.nombre}>
            <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Feria de Cali · Barra VIP" />
          </Field>
          <Field label="Responsable" error={errores.responsable}>
            <input className={inputCls} value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Nombre del encargado" />
          </Field>
          <Field label="Fecha">
            <input type="date" className={inputCls} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </Field>
          <Field label="Caja inicial (opcional)">
            <input type="number" className={inputCls} value={form.caja_inicial} onChange={e => set('caja_inicial', e.target.value)} placeholder="$ 0" />
          </Field>
        </div>
      </Card>

      {/* Productos */}
      <Card className="p-8 mb-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
              <Plus size={20} />
            </div>
            Productos del evento
          </h2>
          {productos.length > 0 && <Badge color="indigo">{productos.length} items</Badge>}
        </div>
        
        {errores.productos && <p className="text-rose-500 text-[11px] font-bold mb-4 ml-1">{errores.productos}</p>}

        {/* Lista */}
        <div className="space-y-3 mb-8">
          {productos.map(p => (
            <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-indigo-200 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                <span className="text-lg">📦</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{p.nombre}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color={catColor[p.categoria]}>{p.categoria}</Badge>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.unidad}</span>
                </div>
              </div>
              <div className="text-right hidden sm:block px-4 border-r border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Costo</p>
                <p className="text-xs font-bold text-slate-600">${p.costo.toLocaleString('es-CO')}</p>
              </div>
              <div className="text-right hidden sm:block px-4">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Venta</p>
                <p className="text-sm font-black text-indigo-600">${p.precio.toLocaleString('es-CO')}</p>
              </div>
              <button onClick={() => eliminarProducto(p.id)} className="p-2.5 rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {productos.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
              <p className="text-slate-300 text-sm font-bold">No hay productos registrados</p>
            </div>
          )}
        </div>

        {/* Agregar producto */}
        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 ml-1">Configurar Nuevo Producto</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <Field label="Nombre del Producto">
              <input className={inputCls} value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder="Ej: Ron Viejo de Caldas" />
            </Field>
            <Field label="Categoría">
              <select className={inputCls} value={nuevo.categoria} onChange={e => setNuevo(n => ({ ...n, categoria: e.target.value as Producto['categoria'] }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Unidad">
              <select className={inputCls} value={nuevo.unidad} onChange={e => setNuevo(n => ({ ...n, unidad: e.target.value as Producto['unidad'] }))}>
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Costo Unitario ($)">
              <input type="number" className={inputCls} value={nuevo.costo || ''} onChange={e => setNuevo(n => ({ ...n, costo: Number(e.target.value) }))} placeholder="0" />
            </Field>
            <Field label="Precio de Venta ($)">
              <input type="number" className={inputCls} value={nuevo.precio || ''} onChange={e => setNuevo(n => ({ ...n, precio: Number(e.target.value) }))} placeholder="0" />
            </Field>
          </div>
          <Btn variant="ghost" size="md" icon={<Plus size={16} />} onClick={agregarProducto} className="w-full sm:w-auto">
            Registrar Producto
          </Btn>
        </div>
      </Card>

      <div className="flex justify-end pt-4">
        <Btn variant="indigo" size="lg" onClick={continuar}>
          Iniciar Operación de Barra →
        </Btn>
      </div>
    </div>
  );
}
