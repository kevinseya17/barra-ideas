'use client';
import React, { useState, useEffect } from 'react';
import { Settings, Package, Truck, Calendar as CalendarIcon, Edit2, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Producto, Evento } from '@/types';
import * as api from '@/lib/api';
import { Btn, Card, Field, inputCls, Badge } from './UI';

type Tab = 'productos' | 'proveedores' | 'eventos';

export default function AdminPanel({ onAtras }: { onAtras: () => void }) {
  const [tab, setTab] = useState<Tab>('productos');
  const [loading, setLoading] = useState(true);
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);

  // Modal de Edición de Producto
  const [editProd, setEditProd] = useState<Producto | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, provData, evData] = await Promise.all([
        api.getProductos(),
        api.getProveedores(),
        api.getEventos()
      ]);
      setProductos(pData);
      setProveedores(provData);
      setEventos(evData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteProd = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    await api.deleteProducto(id);
    loadData();
  };

  const handleDeleteProv = async (nombre: string) => {
    if (!confirm(`¿Eliminar proveedor ${nombre}?`)) return;
    await api.deleteProveedor(nombre);
    loadData();
  };

  const handleDeleteEvento = async (id: string) => {
    if (!confirm('¡CUIDADO! Esto borrará el evento y TODO el historial de recargas, inventario y cortesías asociado a este evento. ¿Estás seguro?')) return;
    await api.deleteEventoCascade(id);
    loadData();
  };

  const handleUpdateProd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProd) return;
    await api.updateProducto(editProd.id, {
      nombre: editProd.nombre,
      categoria: editProd.categoria,
      unidad: editProd.unidad,
      precio: editProd.precio,
      costo: editProd.costo,
    });
    setEditProd(null);
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onAtras} className="p-3 bg-white rounded-full shadow-sm hover:shadow text-slate-500 hover:text-slate-900 transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Settings className="text-indigo-600" /> Panel de Administración
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de Base de Datos</p>
            </div>
          </div>
          <button onClick={loadData} className="p-3 bg-white rounded-xl shadow-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm overflow-x-auto">
          {[
            { id: 'productos', label: 'Productos', icon: <Package size={16} /> },
            { id: 'proveedores', label: 'Proveedores', icon: <Truck size={16} /> },
            { id: 'eventos', label: 'Historial Eventos', icon: <CalendarIcon size={16} /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                tab === t.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-sm">
            Cargando datos...
          </div>
        ) : (
          <Card className="p-0 overflow-hidden border-slate-200">
            {tab === 'productos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-4 py-4 text-center">Categoría</th>
                      <th className="px-4 py-4 text-center">Precio</th>
                      <th className="px-4 py-4 text-center">Costo</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productos.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{p.nombre}</td>
                        <td className="px-4 py-4 text-center"><Badge color="slate">{p.categoria}</Badge></td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600">${p.precio.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600">${p.costo.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setEditProd(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg mr-2 transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteProd(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'proveedores' && (
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {proveedores.map(prov => (
                    <div key={prov} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="font-bold text-slate-800">{prov}</span>
                      <button onClick={() => handleDeleteProv(prov)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {proveedores.length === 0 && <p className="text-slate-400 text-sm">No hay proveedores registrados.</p>}
                </div>
              </div>
            )}

            {tab === 'eventos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Fecha / Creación</th>
                      <th className="px-4 py-4">Evento</th>
                      <th className="px-4 py-4">Responsable</th>
                      <th className="px-4 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Limpiar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eventos.map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(ev.created_at || '').toLocaleString('es-CO')}</td>
                        <td className="px-4 py-4 font-bold text-slate-800">{ev.nombre}</td>
                        <td className="px-4 py-4 text-slate-600">{ev.responsable}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge color={ev.estado === 'abierto' ? 'emerald' : 'slate'}>{ev.estado}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeleteEvento(ev.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Borrar evento y todos sus registros">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {eventos.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay eventos en el historial.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Modal de Edición */}
      {editProd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Edit2 size={20} className="text-indigo-600"/> Editar: {editProd.nombre}
            </h3>
            <form onSubmit={handleUpdateProd} className="space-y-4">
              <Field label="Nombre del Producto">
                <input required className={inputCls} value={editProd.nombre} onChange={e => setEditProd({...editProd, nombre: e.target.value})} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Categoría">
                  <select required className={inputCls} value={editProd.categoria} onChange={e => setEditProd({...editProd, categoria: e.target.value as any})}>
                    <option value="licor">Licor</option>
                    <option value="cerveza">Cerveza</option>
                    <option value="agua">Agua</option>
                    <option value="gaseosa">Gaseosa</option>
                    <option value="snack">Snack</option>
                    <option value="otro">Otro</option>
                  </select>
                </Field>
                <Field label="Presentación">
                  <select required className={inputCls} value={editProd.unidad} onChange={e => setEditProd({...editProd, unidad: e.target.value as any})}>
                    <option value="botella">Botella</option>
                    <option value="unidad">Unidad</option>
                    <option value="caja">Caja</option>
                    <option value="lata">Lata</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Costo Base ($)">
                  <input required type="number" className={inputCls} value={editProd.costo} onChange={e => setEditProd({...editProd, costo: Number(e.target.value)})} />
                </Field>
                <Field label="Precio Venta ($)">
                  <input required type="number" className={inputCls} value={editProd.precio} onChange={e => setEditProd({...editProd, precio: Number(e.target.value)})} />
                </Field>
              </div>
              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setEditProd(null)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                <Btn variant="indigo">Guardar Cambios</Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
