'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, PackageOpen, Settings, LayoutGrid, List, ChevronDown, RefreshCw } from 'lucide-react';
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
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [eventosPasados, setEventosPasados] = useState<api.Evento[]>([]);
  const [cargandoPrevio, setCargandoPrevio] = useState(false);

  useEffect(() => {
    const init = async () => {
      let data = [];
      if (productosIniciales) {
        data = productosIniciales;
      } else {
        data = await api.getProductos();
      }
      // Solo mostramos productos activos
      setProductos(data.filter(p => p.activo !== false));
      
      const [provs, events] = await Promise.all([
        api.getProveedores(),
        api.getEventos()
      ]);

      if (provs.length > 0) {
        setProveedores(provs);
      } else if (proveedoresIniciales) {
        setProveedores(proveedoresIniciales);
      }

      setEventosPasados(events.filter(e => e.estado === 'cerrado').slice(0, 5));
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
    const prodGuardado = await api.createProducto({ 
      ...nuevo, 
      costo: Number(nuevo.costo), 
      precio: Number(nuevo.precio),
      activo: true 
    });
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
      // Si no se puede borrar por historial, lo desactivamos
      const updateOk = await api.updateRecord('productos', id, { activo: false });
      if (updateOk) {
        setProductos(p => p.filter(x => x.id !== id));
      } else {
        alert("El producto tiene historial y no se pudo ocultar. Asegúrate de haber creado la columna 'activo' en Supabase.");
      }
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

  const cargarInventarioPrevio = async (eventoId: string) => {
    if (!eventoId) return;
    setCargandoPrevio(true);
    try {
      const data = await api.getEventoData(eventoId);
      const invFinalMap: Record<string, { cantidad: string, proveedor: string }> = {};
      
      // Mapear el inventario FINAL del evento pasado al INICIAL de este
      data.inventario.filter(i => i.tipo === 'final').forEach(i => {
        invFinalMap[i.producto_id] = { 
          cantidad: String(i.cantidad), 
          proveedor: i.proveedor || '' 
        };
      });

      setFormInv(prev => ({ ...prev, ...invFinalMap }));
      
      // Opcional: También podríamos cargar los datos del evento si quisiéramos
      const ev = eventosPasados.find(e => e.id === eventoId);
      if (ev) {
        set('nombre', `Seguimiento: ${ev.nombre}`);
      }

    } catch (error) {
      console.error("Error cargando inventario previo:", error);
      alert("No se pudo cargar el inventario del evento seleccionado.");
    } finally {
      setCargandoPrevio(false);
    }
  };

  const tieneInvPrecargado = invInicial && Object.keys(invInicial).length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 relative">
      <SectionHeader
        step="01 APERTURA"
        title="Abrir evento"
        sub="Configura el nombre, responsable y productos antes de iniciar."
      />

      {tieneInvPrecargado && (
        <div className="mb-8 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <span className="text-3xl mt-0.5">📦</span>
          <div>
            <h3 className="font-black text-amber-900 text-sm tracking-tight">Inventario precargado de la noche anterior</h3>
            <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
              Las cantidades iniciales ya están llenas con el inventario final del evento pasado. 
              <strong className="text-amber-900"> Verifica y ajusta</strong> si hubo cambios antes de continuar.
            </p>
          </div>
        </div>
      )}

      <div className="mb-12 p-1 bg-gradient-to-r from-[#00d2ff] to-[#ff0099] rounded-3xl shadow-lg shadow-cyan-500/10">
        <div className="bg-[#0a0a0a] dark:bg-[#050505] rounded-[1.4rem] p-6 flex flex-col lg:flex-row items-center justify-between gap-6 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-[#00d2ff] shrink-0 border border-cyan-500/20">
              <Settings size={22} />
            </div>
            <div>
              <h3 className="font-black text-white text-sm tracking-tight uppercase tracking-widest">Panel de Control</h3>
              <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">Administra precios, productos y configuraciones globales.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            {eventosPasados.length > 0 && (
              <div className="relative w-full sm:w-64">
                <select 
                  onChange={(e) => cargarInventarioPrevio(e.target.value)}
                  disabled={cargandoPrevio}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-[10px] font-black text-white uppercase tracking-widest outline-none focus:border-[#00d2ff] transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#0a0a0a]">📦 Seguir noche anterior...</option>
                  {eventosPasados.map(ev => (
                    <option key={ev.id} value={ev.id} className="bg-[#0a0a0a]">
                      {ev.fecha} - {ev.nombre}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#00d2ff]">
                  {cargandoPrevio ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                </div>
              </div>
            )}
            <button onClick={onAdmin} className="shrink-0 px-8 py-3 bg-gradient-to-r from-[#00d2ff] to-[#ff0099] text-white text-[10px] font-[1000] uppercase tracking-[0.2em] rounded-xl shadow-[0_0_20px_rgba(0,210,255,0.3)] hover:shadow-[0_0_30px_rgba(0,210,255,0.5)] hover:scale-105 transition-all w-full sm:w-auto">
              Panel Admin
            </button>
          </div>
        </div>
      </div>

      {/* Datos del evento */}
      <Card className="p-8 mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
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
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-cyan-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-cyan-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>
          {productos.length > 0 && <Badge color="brand">{productos.length} items</Badge>}
        </div>
        
        {errores.productos && <p className="text-rose-500 text-[11px] font-bold mb-4 ml-1">{errores.productos}</p>}

        {/* Lista de Productos */}
        {viewMode === 'grid' ? (
          <div className="space-y-8 mb-10">
            {Object.entries(
              productos.reduce((acc, p) => {
                const cat = p.category || p.categoria || 'otro';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(p);
                return acc;
              }, {} as Record<string, Producto[]>)
            ).map(([cat, prods]) => (
              <div key={cat} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button 
                  onClick={() => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                  className="w-full flex items-center justify-between p-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 mb-4 group hover:border-[#00d2ff] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${
                      cat === 'licor' ? 'bg-indigo-500 shadow-indigo-500/20' :
                      cat === 'cerveza' ? 'bg-amber-500 shadow-amber-500/20' :
                      'bg-cyan-500 shadow-cyan-500/20'
                    }`}>
                      {cat === 'licor' ? <span className="text-lg">🥃</span> : 
                       cat === 'cerveza' ? <span className="text-lg">🍺</span> : 
                       <span className="text-lg">🥤</span>}
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">{cat}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">{prods.length} Productos</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${collapsedCats[cat] ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-slate-400" />
                  </div>
                </button>

                {!collapsedCats[cat] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
                    {prods.map(p => (
                      <div 
                        key={p.id} 
                        className="group relative bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/5 p-6 shadow-sm hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-500"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00d2ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-3xl" />
                        
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate group-hover:text-[#00d2ff] transition-colors">{p.nombre}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.unidad}</p>
                          </div>
                          <button 
                            onClick={() => eliminarProducto(p.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Costo Unit</p>
                            <p className="text-xs font-black text-slate-600 dark:text-slate-300 text-center">${p.costo.toLocaleString()}</p>
                          </div>
                          <div className="bg-cyan-50 dark:bg-[#00d2ff]/10 p-3 rounded-2xl border border-cyan-100 dark:border-[#00d2ff]/20">
                            <p className="text-[8px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-1 text-center">P. Venta</p>
                            <p className="text-xs font-black text-cyan-700 dark:text-cyan-400 text-center">${p.precio.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Field label="Cantidad Inicial">
                            <div className="relative">
                              <input 
                                type="number" 
                                className="w-full h-12 bg-slate-50 dark:bg-[#111] border-2 border-slate-100 dark:border-white/10 focus:border-[#00d2ff] focus:bg-white dark:focus:bg-black rounded-2xl text-center font-black text-slate-900 dark:text-white transition-all outline-none"
                                value={formInv[p.id]?.cantidad || ''} 
                                onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], cantidad: e.target.value } }))} 
                                placeholder="0" 
                              />
                              {formInv[p.id]?.cantidad && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#00d2ff] shadow-[0_0_8px_#00d2ff]" />
                              )}
                            </div>
                          </Field>

                          <Field label="Proveedor">
                            <select 
                              className="w-full h-12 bg-slate-50 dark:bg-[#111] border-2 border-slate-100 dark:border-white/10 focus:border-[#00d2ff] focus:bg-white dark:focus:bg-black rounded-2xl px-4 font-bold text-slate-700 dark:text-slate-300 text-xs transition-all outline-none"
                              value={formInv[p.id]?.proveedor || ''} 
                              onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], proveedor: e.target.value } }))}
                            >
                              <option value="">Seleccionar...</option>
                              {proveedores.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                            </select>
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-100 dark:border-white/5 rounded-3xl mb-10 shadow-sm bg-white dark:bg-black">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-4 py-4 text-center">Cat / Und</th>
                    <th className="px-4 py-4 text-center">Costo / Venta</th>
                    <th className="px-4 py-4 text-center">Cant. Inicial</th>
                    <th className="px-4 py-4">Proveedor</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {productos.map(p => (
                    <tr key={p.id} className="hover:bg-cyan-50/30 dark:hover:bg-cyan-500/5 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-tight">{p.nombre}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge color={catColor[p.categoria] || 'slate'}>{p.categoria}</Badge>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{p.unidad}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-slate-400">${p.costo.toLocaleString('es-CO')}</span>
                          <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">${p.precio.toLocaleString('es-CO')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="number" 
                          className="w-20 h-9 bg-slate-100 dark:bg-white/5 border-2 border-transparent focus:border-[#00d2ff] focus:bg-white dark:focus:bg-black rounded-xl text-center font-black text-slate-800 dark:text-white transition-all outline-none mx-auto block"
                          value={formInv[p.id]?.cantidad || ''} 
                          onChange={e => setFormInv(prev => ({ ...prev, [p.id]: { ...prev[p.id], cantidad: e.target.value } }))} 
                          placeholder="0" 
                        />
                      </td>
                      <td className="px-4 py-4">
                        <select 
                          className="w-full max-w-[150px] h-9 bg-slate-100 dark:bg-white/5 border-2 border-transparent focus:border-[#00d2ff] focus:bg-white dark:focus:bg-black rounded-xl px-2 font-bold text-slate-700 dark:text-slate-300 text-[11px] transition-all outline-none"
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
        <div className="bg-slate-100/50 dark:bg-black/40 rounded-3xl p-8 border border-slate-200 dark:border-white/10 shadow-inner">
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

      <div className="sticky bottom-6 flex justify-end pt-8 z-30 pointer-events-none">
        <Btn variant="brand" size="lg" onClick={continuar} className="shadow-2xl pointer-events-auto scale-110 hover:scale-115 active:scale-105">
          Iniciar Operación de Barra →
        </Btn>
      </div>
    </div>
  );
}
