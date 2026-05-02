'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, PackageOpen, Settings, LayoutGrid, List } from 'lucide-react';
import { Producto } from '@/types';
import * as api from '@/lib/api';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';

const CATEGORIAS = ['licor', 'cerveza', 'gaseosa', 'agua', 'snack', 'otro'] as const;
const UNIDADES = ['botella', 'unidad', 'caja', 'lata'] as const;

const prodVacio = (): Omit<Producto, 'id'> => ({
  nombre: '', categoria: 'licor', unidad: 'botella', costo: 0, precio: 0,
});

interface Props {
  onContinuar: (
    evento: { nombre: string; fecha: string; responsable: string; caja_inicial: number },
    productos: Producto[],
    proveedores: string[],
    invInicial: Record<string, { cantidad: number; proveedor: string }>
  ) => void;
  eventoInicial?: { nombre: string; fecha: string; responsable: string; caja_inicial: number } | null;
  productosIniciales?: Producto[];
  proveedoresIniciales?: string[];
  invInicial?: Record<string, { cantidad: number; proveedor: string }>;
  onAdmin: () => void;
}

export default function Apertura({ onContinuar, eventoInicial, productosIniciales, proveedoresIniciales, invInicial, onAdmin }: Props) {
  const [form, setForm] = useState({
    nombre: eventoInicial?.nombre || '',
    fecha: eventoInicial?.fecha || '',
    responsable: eventoInicial?.responsable || '',
    caja_inicial: eventoInicial?.caja_inicial ? String(eventoInicial.caja_inicial) : '',
  });
  const [productos, setProductos] = useState<Producto[]>(productosIniciales || []);
  const [proveedores, setProveedores] = useState<string[]>(proveedoresIniciales || []);
  const [nuevoProv, setNuevoProv] = useState('');
  const [nuevo, setNuevo] = useState<Omit<Producto, 'id'>>(prodVacio());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [formInv, setFormInv] = useState<Record<string, { cantidad: string, proveedor: string }>>(() => {
    if (invInicial) {
      return Object.fromEntries(Object.entries(invInicial).map(([k, v]) => [k, { cantidad: String(v.cantidad), proveedor: v.proveedor }]));
    }
    return {};
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    const init = async () => {
      if (productosIniciales) {
        setCargando(false);
      } else {
        const data = await api.getProductos();
        setProductos(data);
      }
      
      const provs = await api.getProveedores();
      if (provs.length > 0) {
        setProveedores(provs);
      } else if (proveedoresIniciales) {
        setProveedores(proveedoresIniciales);
      }
      setCargando(false);
    };
    init();
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const agregarProveedor = async () => {
    const n = nuevoProv.trim();
    if (!n) return;
    if (proveedores.includes(n)) return;
    
    const ok = await api.createProveedor(n);
    if (ok) {
      setProveedores([...proveedores, n]);
      setNuevoProv('');
    }
  };

  const eliminarProveedor = async (p: string) => {
    const ok = await api.deleteProveedor(p);
    if (ok) {
      setProveedores(proveedores.filter(x => x !== p));
    }
  };

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
    if (proveedores.length === 0) e.proveedores = 'Debes agregar al menos un proveedor';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    
    const invFinal: Record<string, { cantidad: number, proveedor: string }> = {};
    Object.entries(formInv).forEach(([id, data]) => {
      if (data.cantidad) {
        invFinal[id] = { cantidad: Number(data.cantidad), proveedor: data.proveedor };
      }
    });

    onContinuar(
      { ...form, caja_inicial: Number(form.caja_inicial || 0) }, 
      productos, 
      proveedores, 
      invFinal
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 relative">
      <SectionHeader
        step="PASO 1 / APERTURA"
        title="Abrir evento"
        sub="Configura el nombre, responsable y productos antes de iniciar."
      />

      <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-indigo-900 text-sm">¿Necesitas limpiar o ajustar datos?</h3>
          <p className="text-xs text-indigo-700/80 mt-0.5">Ve al panel de administración para editar precios o borrar eventos pasados.</p>
        </div>
        <button onClick={onAdmin} className="shrink-0 px-5 py-2.5 bg-white border border-indigo-200 text-indigo-600 text-xs font-bold uppercase tracking-widest rounded-xl shadow-sm hover:shadow hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
          <Settings size={16} /> Base de Datos
        </button>
      </div>

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

      {/* Proveedores */}
      <Card className="p-8 mb-8 border-amber-100 bg-amber-50/5 transition-all">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
            <Plus size={20} />
          </div>
          Lista de Proveedores
        </h2>
        
        {errores.proveedores && <p className="text-rose-500 text-[11px] font-bold mb-4 ml-1">{errores.proveedores}</p>}
        
        <div className="flex gap-2 mb-6">
          <input 
            className={inputCls} 
            value={nuevoProv} 
            onChange={e => setNuevoProv(e.target.value)} 
            placeholder="Nombre del proveedor (ej: Licor Junior)"
            onKeyDown={e => e.key === 'Enter' && agregarProveedor()}
          />
          <Btn variant="yellow" onClick={agregarProveedor}>Agregar</Btn>
        </div>

        <div className="flex flex-wrap gap-2">
          {proveedores.map(p => (
            <span key={p} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 rounded-xl text-sm font-bold text-amber-700 shadow-sm">
              {p}
              <button onClick={() => eliminarProveedor(p)} className="text-amber-300 hover:text-rose-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </span>
          ))}
          {proveedores.length === 0 && <p className="text-slate-400 text-sm italic">No has agregado proveedores todavía.</p>}
        </div>
      </Card>

      {/* Productos */}
      <Card className="p-8 mb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <Plus size={20} />
              </div>
              Productos del evento
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>
          {productos.length > 0 && <Badge color="indigo">{productos.length} items</Badge>}
        </div>
        
        {errores.productos && <p className="text-rose-500 text-[11px] font-bold mb-4 ml-1">{errores.productos}</p>}

        {/* Lista de Productos */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {productos.map(p => (
              <div key={p.id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-100 transition-all duration-300 animate-in fade-in zoom-in">
                <button 
                  onClick={() => eliminarProducto(p.id)} 
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <PackageOpen size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{p.nombre}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${catColor[p.categoria] || 'bg-slate-100 text-slate-500'}`}>
                        {p.categoria}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unidad}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50/50 p-3 rounded-2xl border border-slate-50">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Costo</p>
                    <p className="text-xs font-black text-slate-600">${p.costo.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Venta</p>
                    <p className="text-xs font-black text-indigo-600">${p.precio.toLocaleString('es-CO')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Cantidad Inicial</p>
                    <input 
                      type="number" 
                      className="w-full h-11 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl text-center font-black text-slate-800 transition-all outline-none placeholder:text-slate-200"
                      value={formInv[p.id]?.cantidad || ''} 
                      onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], cantidad: e.target.value } }))} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="relative">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Proveedor</p>
                    <select 
                      className="w-full h-11 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 font-bold text-slate-700 text-xs transition-all outline-none appearance-none"
                      value={formInv[p.id]?.proveedor || ''} 
                      onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], proveedor: e.target.value } }))}
                    >
                      <option value="">Seleccionar...</option>
                      {proveedores.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                    </select>
                    <div className="absolute right-4 bottom-3 pointer-events-none text-slate-300">
                      <Plus size={14} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-100 rounded-3xl mb-10 shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-4 py-4 text-center">Cat / Und</th>
                    <th className="px-4 py-4 text-center">Costo / Venta</th>
                    <th className="px-4 py-4 text-center">Cant. Inicial</th>
                    <th className="px-4 py-4">Proveedor</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productos.map(p => (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-800 text-sm uppercase tracking-tight">{p.nombre}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge color={catColor[p.categoria] || 'slate'}>{p.categoria}</Badge>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{p.unidad}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-slate-400">${p.costo.toLocaleString('es-CO')}</span>
                          <span className="text-sm font-black text-indigo-600">${p.precio.toLocaleString('es-CO')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="number" 
                          className="w-20 h-9 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-center font-black text-slate-800 transition-all outline-none mx-auto block"
                          value={formInv[p.id]?.cantidad || ''} 
                          onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], cantidad: e.target.value } }))} 
                          placeholder="0" 
                        />
                      </td>
                      <td className="px-4 py-4">
                        <select 
                          className="w-full max-w-[150px] h-9 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl px-2 font-bold text-slate-700 text-[11px] transition-all outline-none"
                          value={formInv[p.id]?.proveedor || ''} 
                          onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], proveedor: e.target.value } }))}
                        >
                          <option value="">Prov...</option>
                          {proveedores.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => eliminarProducto(p.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {productos.length === 0 && (
          <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/30 mb-10">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-200">
              <PackageOpen size={32} />
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No hay productos en la lista</p>
            <p className="text-slate-300 text-xs mt-2 italic text-balance">Configura tu primer producto abajo para empezar</p>
          </div>
        )}

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
