
'use client';
import React, { useState } from 'react';
import { RefreshCw, Gift, AlertTriangle, Package, Clock, Printer, X, BarChart3, PackageOpen, Percent, Banknote, Trash2 } from 'lucide-react';
import { Producto, Recarga, Cortesia, Perdida, LogEntry, Descuento, Gasto } from '@/types';
import { uid, nowTime } from '@/utils/calculos';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';

type Tab = 'inventario' | 'recargas' | 'cortesias' | 'perdidas' | 'descuentos' | 'gastos' | 'stock';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string };
  productos: Producto[];
  proveedores: string[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  recargas: Recarga[];
  cortesias: Cortesia[];
  perdidas: Perdida[];
  descuentos: Descuento[];
  gastos: Gasto[];
  log: LogEntry[];
  onSaveInicial: (inv: Record<string, { cantidad: number; proveedor: string }>) => void;
  onAddRecarga: (r: Omit<Recarga, 'id'>) => void;
  onAddCortesia: (c: Omit<Cortesia, 'id'>) => void;
  onAddPerdida: (p: Omit<Perdida, 'id'>) => void;
  onAddDescuento: (d: Omit<Descuento, 'id'>) => void;
  onAddGasto: (g: Omit<Gasto, 'id'>) => void;
  onRemoveLogEntry: (logId: string) => void;
  onCierre: () => void;
  onAtras: () => void;
}

const TIPO_LOG: Record<LogEntry['tipo'], string> = {
  info: 'bg-slate-100 text-slate-500 border-slate-200',
  recarga: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  cortesia: 'bg-violet-50 text-violet-600 border-violet-100',
  perdida: 'bg-rose-50 text-rose-600 border-rose-100',
  descuento: 'bg-blue-50 text-blue-600 border-blue-100',
  gasto: 'bg-orange-50 text-orange-600 border-orange-100',
  cierre: 'bg-amber-50 text-amber-700 border-amber-100',
};

export default function Operacion({
  evento, productos, proveedores, inventarioInicial, recargas, cortesias, perdidas, descuentos, gastos, log,
  onSaveInicial, onAddRecarga, onAddCortesia, onAddPerdida, onAddDescuento, onAddGasto, onRemoveLogEntry, onCierre, onAtras,
}: Props) {
  const [tab, setTab] = useState<Tab>('inventario');
  const [invLocal, setInvLocal] = useState<Record<string, { cantidad: string, proveedor: string }>>(() =>
    Object.fromEntries(productos.map(p => {
      const data = inventarioInicial[p.id];
      return [p.id, { 
        cantidad: data ? String(data.cantidad) : '', 
        proveedor: data?.proveedor || proveedores[0] || '' 
      }];
    }))
  );
  const [rec, setRec] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', proveedor: proveedores[0] || '' });
  const [cor, setCor] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', persona: '', motivo: '' });
  const [per, setPer] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', motivo: '' });
  const [desc, setDesc] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', porcentaje: '', motivo: '' });
  const [gas, setGas] = useState<{ concepto: string, monto: string, metodo: 'efectivo' | 'nequi' | 'datafono' }>({ 
    concepto: '', 
    monto: '', 
    metodo: 'efectivo' 
  });
  const [guardadoInv, setGuardadoInv] = useState(Object.keys(inventarioInicial).length > 0);
  const [ticket, setTicket] = useState<LogEntry | null>(null);

  // --- CÁLCULOS EN VIVO ---
  const totalPotencial = productos.reduce((acc, p) => {
    const ini = inventarioInicial[p.id]?.cantidad || 0;
    const recs = recargas.filter(r => r.producto_id === p.id).reduce((sum, r) => sum + Number(r.cantidad), 0);
    
    // Restar lo que ya no es potencial de venta
    const cors = cortesias.filter(c => c.producto_id === p.id).reduce((sum, c) => sum + Number(c.cantidad), 0);
    const pers = perdidas.filter(per => per.producto_id === p.id).reduce((sum, per) => sum + Number(per.cantidad), 0);
    const descs = descuentos.filter(d => d.producto_id === p.id).reduce((sum, d) => sum + (d.valor_descontado || 0), 0);

    const bruto = (ini + recs - cors - pers) * (p.precio || 0);
    return acc + bruto - descs;
  }, 0);

  const totalGastos = gastos.reduce((a, b) => a + Number(b.monto), 0);
  const totalRecargas = recargas.reduce((a, b) => {
    const p = productos.find(x => x.id === b.producto_id);
    return a + (Number(b.cantidad) * (p?.precio || 0));
  }, 0);
  const totalCortesias = cortesias.reduce((a, b) => {
    const p = productos.find(x => x.id === b.producto_id);
    return a + (Number(b.cantidad) * (p?.precio || 0));
  }, 0);
  const totalPerdidas = perdidas.reduce((a, b) => a + Number(b.cantidad), 0);

  // --- CÁLCULO DE VENTAS PROYECTADAS ---
  const ventasProyectadas = productos.reduce((acc, p) => {
    const inicial = inventarioInicial[p.id]?.cantidad || 0;
    const masRecargas = recargas.filter(r => r.producto_id === p.id).reduce((sum, r) => sum + Number(r.cantidad), 0);
    const menosCortesias = cortesias.filter(c => c.producto_id === p.id).reduce((sum, c) => sum + Number(c.cantidad), 0);
    const menosPerdidas = perdidas.filter(per => per.producto_id === p.id).reduce((sum, per) => sum + Number(per.cantidad), 0);
    
    const disponible = inicial + masRecargas - menosCortesias - menosPerdidas;
    const actual = Number(invLocal[p.id]?.cantidad || disponible); // Si no ha puesto nada, asume que no ha vendido nada
    
    const consumido = Math.max(0, disponible - actual);
    return acc + (consumido * p.precio);
  }, 0);

  const pName = (id: string) => productos.find(x => x.id === id)?.nombre ?? id;

  const saveInv = () => {
    const inv = Object.fromEntries(
      Object.entries(invLocal).map(([k, v]) => [k, { cantidad: Number(v.cantidad || 0), proveedor: v.proveedor }])
    );
    onSaveInicial(inv);
    setGuardadoInv(true);
  };

  const doRecarga = () => {
    if (!rec.cantidad) return;
    onAddRecarga({ evento_id: '', producto_id: rec.producto_id, cantidad: Number(rec.cantidad), hora: nowTime(), proveedor: rec.proveedor });
    setRec(r => ({ ...r, cantidad: '', proveedor: '' }));
  };

  const doCortesia = () => {
    if (!cor.cantidad || !cor.persona) return;
    onAddCortesia({ evento_id: '', producto_id: cor.producto_id, cantidad: Number(cor.cantidad), persona: cor.persona, motivo: cor.motivo, hora: nowTime() });
    setCor(c => ({ ...c, cantidad: '', persona: '', motivo: '' }));
  };

  const doPerdida = () => {
    if (!per.cantidad) return;
    onAddPerdida({ evento_id: '', producto_id: per.producto_id, cantidad: Number(per.cantidad), motivo: per.motivo, hora: nowTime() });
    setPer(p => ({ ...p, cantidad: '', motivo: '' }));
  };

  const doDescuento = () => {
    if (!desc.cantidad || !desc.porcentaje) return;
    const prod = productos.find(x => x.id === desc.producto_id);
    if (!prod) return;
    const porc = Number(desc.porcentaje);
    const valorOriginal = prod.precio * Number(desc.cantidad);
    const descontado = valorOriginal * (porc / 100);
    onAddDescuento({ evento_id: '', producto_id: desc.producto_id, cantidad: Number(desc.cantidad), porcentaje: porc, valor_descontado: descontado, motivo: desc.motivo, hora: nowTime() });
    setDesc(d => ({ ...d, cantidad: '', porcentaje: '', motivo: '' }));
  };

  const doGasto = () => {
    if (!gas.concepto || !gas.monto) return;
    onAddGasto({ evento_id: '', concepto: gas.concepto, monto: Number(gas.monto), metodo: gas.metodo, hora: nowTime() });
    setGas({ concepto: '', monto: '', metodo: 'efectivo' });
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'inventario', label: 'Carga Inicial', icon: <Package size={15} /> },
    { id: 'stock', label: 'Stock en Vivo', icon: <BarChart3 size={15} /> },
    { id: 'recargas', label: 'Recargas', icon: <RefreshCw size={15} />, count: recargas.length },
    { id: 'cortesias', label: 'Cortesías', icon: <Gift size={15} />, count: cortesias.length },
    { id: 'descuentos', label: 'Descuentos', icon: <Percent size={15} />, count: descuentos.length },
    { id: 'perdidas', label: 'Pérdidas', icon: <AlertTriangle size={15} />, count: perdidas.length },
    { id: 'gastos', label: 'Gastos', icon: <Banknote size={15} />, count: gastos.length },
  ];

  const tabActive = 'bg-slate-900 text-white shadow-md';
  const tabInactive = 'text-slate-500 hover:bg-slate-50';

  return (
    <div className="w-full py-2">
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">

        {/* MAIN CONSOLE */}
        <div className="flex-1 min-w-0">
          <SectionHeader
            step="PASO 2 / OPERACIÓN EN VIVO"
            title={evento.nombre}
            sub={`${evento.responsable} · Registro de actividad en tiempo real`}
          />

          {/* MONITOR EN VIVO - COMPACTO Y ELEGANTE */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-emerald-600 rounded-3xl p-4 shadow-lg shadow-emerald-100 border border-emerald-500 transition-all hover:scale-[1.02]">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">Potencial Venta</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">${totalPotencial.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-4 shadow-lg border border-slate-800 transition-all hover:scale-[1.02]">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">${totalGastos.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 transition-all hover:scale-[1.02] hover:shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recargas</p>
              </div>
              <p className="text-xl font-black text-slate-900 tracking-tight">${totalRecargas.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 transition-all hover:scale-[1.02] hover:shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cortesías</p>
              </div>
              <p className="text-xl font-black text-slate-900 tracking-tight">${totalCortesias.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 transition-all hover:scale-[1.02] hover:shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bajas</p>
              </div>
              <p className="text-xl font-black text-rose-600 tracking-tight">{totalPerdidas}</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl shadow-sm mb-8 gap-1.5 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id 
                  ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                }`}
              >
                <span className={`${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`}>{t.icon}</span>
                {t.label}
                {!!t.count && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            {tab === 'inventario' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-xl font-black text-slate-900">Control de Inventario Inicial</h3>
                  <Badge color={guardadoInv ? 'emerald' : 'yellow'}>{guardadoInv ? 'Sincronizado' : 'Pendiente'}</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                  {productos.map(p => (
                    <div key={p.id} className="flex flex-col gap-4 p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-all">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.categoria}</p>
                        </div>
                        <Badge color="slate">{p.unidad}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Cantidad">
                          <input
                            type="number"
                            className={`${inputCls} text-center text-lg font-bold`}
                            placeholder="0"
                            value={invLocal[p.id]?.cantidad ?? ''}
                            onChange={e => setInvLocal(inv => ({ ...inv, [p.id]: { ...inv[p.id], cantidad: e.target.value } }))}
                          />
                        </Field>
                        <Field label="Proveedor">
                          <select
                            className={inputCls}
                            value={invLocal[p.id]?.proveedor ?? ''}
                            onChange={e => setInvLocal(inv => ({ ...inv, [p.id]: { ...inv[p.id], proveedor: e.target.value } }))}
                          >
                            <option value="">Seleccionar...</option>
                            {proveedores.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                          </select>
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                  <Btn variant="indigo" icon={<Package size={18} />} onClick={saveInv}>
                    Guardar Inventario Inicial
                  </Btn>
                  {guardadoInv && (
                    <div className="flex items-center gap-2 text-indigo-600 animate-in fade-in slide-in-from-left-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                        <span className="text-sm">✓</span>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Base de datos actualizada</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* STOCK EN VIVO (TABLA DE MOVIMIENTOS) */}
            {tab === 'stock' && (
              <Card className="p-0 overflow-hidden border-indigo-100 shadow-xl shadow-indigo-50/50 animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 bg-indigo-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Inventario en Tiempo Real</h3>
                      <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Cuadre actual basado en todos los movimientos</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                      <BarChart3 size={24} />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-y border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Base</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-500">Recargas</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest text-rose-500">Baj./Cort./Desc.</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">En Barra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {productos.map(p => {
                        const ini = inventarioInicial[p.id]?.cantidad ?? 0;
                        const rec = recargas.filter(r => r.producto_id === p.id).reduce((a, b) => a + b.cantidad, 0);
                        const cor = cortesias.filter(c => c.producto_id === p.id).reduce((a, b) => a + b.cantidad, 0);
                        const per = perdidas.filter(l => l.producto_id === p.id).reduce((a, b) => a + b.cantidad, 0);
                        const descCount = descuentos.filter(d => d.producto_id === p.id).reduce((a, b) => a + b.cantidad, 0);
                        const total = Number(ini) + Number(rec) - Number(cor) - Number(per) - Number(descCount);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{p.nombre}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.categoria}</p>
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-slate-500 text-sm">{ini}</td>
                            <td className="px-4 py-4 text-center font-bold text-indigo-600 text-sm">+{rec}</td>
                            <td className="px-4 py-4 text-center font-bold text-rose-400 text-sm">-{cor + per + descCount}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-black ${
                                total > 0 ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {total}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase text-center tracking-widest italic">
                    * Los valores reflejan el stock físico que debería haber en el estante en este momento.
                  </p>
                </div>
              </Card>
            )}

            {/* RECARGAS */}
            {tab === 'recargas' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <RefreshCw size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestión de Recargas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Suministro de mercancía a la barra</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                  <div className="sm:col-span-2">
                    <Field label="Producto a Recargar">
                      <select className={inputCls} value={rec.producto_id} onChange={e => setRec(r => ({ ...r, producto_id: e.target.value }))}>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Cantidad">
                    <input type="number" className={inputCls} value={rec.cantidad} onChange={e => setRec(r => ({ ...r, cantidad: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Proveedor">
                    <select className={inputCls} value={rec.proveedor} onChange={e => setRec(r => ({ ...r, proveedor: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                </div>
                
                <Btn variant="indigo" icon={<RefreshCw size={16} />} onClick={doRecarga}>Confirmar Recarga</Btn>

                {recargas.length > 0 && (
                  <div className="mt-10 space-y-3 pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Historial Reciente</p>
                    {recargas.map(r => (
                      <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Clock size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-12">{r.hora}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(r.producto_id)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{r.proveedor || 'Sin proveedor'}</p>
                        </div>
                        <Badge color="indigo">+{r.cantidad}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* CORTESÍAS */}
            {tab === 'cortesias' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-violet-50 shadow-2xl">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-200">
                    <Gift size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registro de Cortesías</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Autorización de consumos gratis</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="lg:col-span-2">
                    <Field label="Producto">
                      <select className={inputCls} value={cor.producto_id} onChange={e => setCor(c => ({ ...c, producto_id: e.target.value }))}>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Cantidad">
                    <input type="number" className={inputCls} value={cor.cantidad} onChange={e => setCor(c => ({ ...c, cantidad: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Beneficiario">
                    <input className={inputCls} value={cor.persona} onChange={e => setCor(c => ({ ...c, persona: e.target.value }))} placeholder="DJ, Artista, VIP..." />
                  </Field>
                  <div className="lg:col-span-4">
                    <Field label="Motivo o Justificación">
                      <input className={inputCls} value={cor.motivo} onChange={e => setCor(c => ({ ...c, motivo: e.target.value }))} placeholder="Ej: Rider técnico o autorización gerencial" />
                    </Field>
                  </div>
                </div>
                
                <Btn variant="primary" icon={<Gift size={16} />} onClick={doCortesia}>Autorizar Cortesía</Btn>

                {cortesias.length > 0 && (
                  <div className="mt-10 space-y-3 pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Registro de Beneficiarios</p>
                    {cortesias.map(c => (
                      <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Clock size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-12">{c.hora}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(c.producto_id)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">PARA: {c.persona}</p>
                        </div>
                        <Badge color="violet">-{c.cantidad}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* PÉRDIDAS */}
            {tab === 'perdidas' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-rose-50 shadow-2xl">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bajas y Pérdidas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Reporte de mermas, daños o robos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <Field label="Producto">
                    <select className={inputCls} value={per.producto_id} onChange={e => setPer(p => ({ ...p, producto_id: e.target.value }))}>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Cantidad Afectada">
                    <input type="number" className={inputCls} value={per.cantidad} onChange={e => setPer(p => ({ ...p, cantidad: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Descripción del Incidente">
                    <input className={inputCls} value={per.motivo} onChange={e => setPer(p => ({ ...p, motivo: e.target.value }))} placeholder="Ej: Botella quebrada" />
                  </Field>
                </div>
                
                <Btn variant="red" icon={<AlertTriangle size={16} />} onClick={doPerdida}>Reportar Incidente</Btn>

                {perdidas.length > 0 && (
                  <div className="mt-10 space-y-3 pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Alertas Registradas</p>
                    {perdidas.map(p => (
                      <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Clock size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-12">{p.hora}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(p.producto_id)}</p>
                          <p className="text-[10px] text-rose-400 font-bold uppercase">{p.motivo || 'Sin descripción'}</p>
                        </div>
                        <Badge color="red">-{p.cantidad}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* DESCUENTOS */}
            {tab === 'descuentos' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-blue-50 shadow-2xl">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <Percent size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Descuentos Especiales</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ventas con precio rebajado o negociado</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="lg:col-span-2">
                    <Field label="Producto">
                      <select className={inputCls} value={desc.producto_id} onChange={e => setDesc(c => ({ ...c, producto_id: e.target.value }))}>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Cantidad Vendida">
                    <input type="number" className={inputCls} value={desc.cantidad} onChange={e => setDesc(c => ({ ...c, cantidad: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="% Descuento">
                    <input type="number" className={inputCls} value={desc.porcentaje} onChange={e => setDesc(c => ({ ...c, porcentaje: e.target.value }))} placeholder="Ej: 30" />
                  </Field>
                  <div className="lg:col-span-4">
                    <Field label="Justificación o Beneficiario">
                      <input className={inputCls} value={desc.motivo} onChange={e => setDesc(c => ({ ...c, motivo: e.target.value }))} placeholder="Ej: Amigo del dueño, Cumpleaños VIP" />
                    </Field>
                  </div>
                </div>
                
                <Btn variant="indigo" icon={<Percent size={16} />} onClick={doDescuento}>Aplicar Descuento</Btn>

                {descuentos.length > 0 && (
                  <div className="mt-10 space-y-3 pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Historial de Descuentos</p>
                    {descuentos.map(d => (
                      <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Clock size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-12">{d.hora}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(d.producto_id)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{d.motivo || 'Descuento'}</p>
                        </div>
                        <Badge color="blue">-{d.porcentaje}% (x{d.cantidad})</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* GASTOS / PAGOS */}
            {tab === 'gastos' && (
              <Card className="p-8 lg:p-12 rounded-[2.5rem] border-2 border-orange-50 shadow-2xl">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-200">
                    <Banknote size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Salidas de Efectivo (Gastos)</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dinero que sale de la caja para pagos inmediatos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <Field label="Concepto / Motivo">
                    <input className={inputCls} value={gas.concepto} onChange={e => setGas(g => ({ ...g, concepto: e.target.value }))} placeholder="Ej: Pago de Hielo" />
                  </Field>
                  <Field label="Monto ($)">
                    <input type="number" className={inputCls} value={gas.monto} onChange={e => setGas(g => ({ ...g, monto: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Método">
                    <select className={inputCls} value={gas.metodo} onChange={e => setGas(g => ({ ...g, metodo: e.target.value as 'efectivo'|'nequi'|'datafono' }))}>
                      <option value="efectivo">Efectivo (Sale de Caja)</option>
                      <option value="nequi">Nequi</option>
                      <option value="datafono">Datáfono</option>
                    </select>
                  </Field>
                </div>
                
                <Btn variant="primary" icon={<Banknote size={16} />} onClick={doGasto}>Registrar Gasto</Btn>

                {gastos.length > 0 && (
                  <div className="mt-10 space-y-3 pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Registro de Pagos</p>
                    {gastos.map(g => (
                      <div key={g.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Clock size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-12">{g.hora}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{g.concepto}</p>
                          <p className="text-[10px] text-orange-400 font-bold uppercase">{g.metodo}</p>
                        </div>
                        <Badge color="orange">-${g.monto.toLocaleString()}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}


            {/* Global Flow Controls */}
            <div className="flex items-center justify-between mt-10">
              <button onClick={onAtras} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
                ← Configuración Inicial
              </button>
              <Btn variant="yellow" size="lg" onClick={onCierre} className="shadow-lg shadow-amber-100">
                Proceder al Cierre de Caja →
              </Btn>
            </div>
          </div>
        </div>

        {/* ACTIVITY TIMELINE SIDEBAR */}
        <div className="w-full lg:w-72 shrink-0">
          <Card className="p-6 sticky top-24 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Activity Log</p>
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              </div>

              {log.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-200">
                    <Clock size={24} />
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Esperando Actividad…</p>
                </div>
              )}

              <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {log.map((l, i) => (
                  <div key={l.id} className="relative pl-6 group">
                    {/* Línea conectora */}
                    {i !== log.length - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-[-16px] w-[2px] bg-slate-100 group-last:hidden" />
                    )}
                    {/* Punto indicador */}
                    <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100 ${TIPO_LOG[l.tipo].split(' ')[0]}`} />
                    
                      <div className={`rounded-2xl p-4 border transition-all hover:shadow-sm ${TIPO_LOG[l.tipo]} relative group/item`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{l.tipo}</span>
                          <span className="text-[9px] font-bold opacity-40">{l.time}</span>
                        </div>
                        <p className="text-xs font-bold leading-relaxed pr-6">{l.msg}</p>
                        
                        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                          <button 
                            onClick={() => setTicket(l)}
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-current transition-all"
                            title="Ver Detalle"
                          >
                            <Printer size={12} />
                          </button>
                          {['recarga', 'cortesia', 'perdida', 'gasto', 'descuento'].includes(l.tipo) && (
                            <button 
                              onClick={() => {
                                if (confirm('¿Seguro que deseas eliminar este registro? Esto afectará el inventario y las cuentas.')) {
                                  onRemoveLogEntry(l.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all shadow-sm"
                              title="Eliminar Registro"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

      </div>

      {/* TICKET MODAL (PRINTABLE) */}
      {ticket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ticket Header (Non-printable controls) */}
            <div className="p-6 flex justify-between items-center border-b border-slate-100 no-print">
              <h3 className="font-bold text-slate-900">Comprobante de Movimiento</h3>
              <button onClick={() => setTicket(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            {/* THE TICKET BODY */}
            {(() => {
              const prod = ticket.metadata?.producto_id 
                ? productos.find(p => p.id === ticket.metadata.producto_id) 
                : null;
              const cantidad = Number(ticket.metadata?.cantidad || 0);
              const subtotalCosto = prod ? cantidad * prod.costo : 0;
              const subtotalPrecio = prod ? cantidad * prod.precio : 0;

              return (
                <div id="printable-ticket" className="p-8 bg-white print:p-0">
                  {/* Logo */}
                  <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 mb-6">
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">BarraPRO</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Sistema de Auditoría de Barra</p>
                  </div>

                  {/* Tipo de Documento */}
                  <div className="text-center mb-6">
                    <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      ticket.tipo === 'recarga' ? 'bg-indigo-100 text-indigo-700' :
                      ticket.tipo === 'cortesia' ? 'bg-amber-100 text-amber-700' :
                      ticket.tipo === 'perdida' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {ticket.tipo === 'recarga' ? '📦 ACTA DE RECARGA' :
                       ticket.tipo === 'cortesia' ? '🎁 VALE DE CORTESÍA' :
                       ticket.tipo === 'perdida' ? '⚠️ REPORTE DE BAJA' :
                       '📋 REGISTRO DE OPERACIÓN'}
                    </span>
                  </div>

                  {/* Datos del Evento */}
                  <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2 text-[11px]">
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Evento:</span><span className="font-black text-slate-900">{evento.nombre}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Responsable:</span><span className="font-bold text-slate-800">{evento.responsable}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Fecha:</span><span className="font-bold text-slate-800">{new Date().toLocaleDateString('es-CO')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Hora:</span><span className="font-bold text-slate-800">{ticket.time}</span></div>
                  </div>

                  {/* Si tiene metadata de producto, mostrar detalle completo */}
                  {prod ? (
                    <>
                      {/* Producto */}
                      <div className="border-2 border-dashed border-slate-100 rounded-2xl p-5 mb-6">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Detalle del Producto</p>
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <p className="text-lg font-black text-slate-900">{prod.nombre}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{prod.categoria} · {prod.unidad}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Cantidad</p>
                            <p className="text-4xl font-black text-indigo-600 leading-none">{cantidad}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{prod.unidad}(s)</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                          <div className="bg-slate-50 rounded-xl p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Precio Venta</p>
                            <p className="text-sm font-black text-slate-700">${prod.precio.toLocaleString('es-CO')}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Costo Unitario</p>
                            <p className="text-sm font-black text-slate-700">${prod.costo.toLocaleString('es-CO')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Campos Específicos por Tipo */}
                      <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
                        {ticket.tipo === 'recarga' && (
                          <>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400 font-bold">Proveedor:</span>
                              <span className="font-black text-indigo-700 uppercase">{ticket.metadata?.proveedor || 'No especificado'}</span>
                            </div>
                            <div className="flex justify-between text-[11px] pt-2 border-t border-slate-200">
                              <span className="text-slate-400 font-bold">Subtotal Costo ({cantidad} × ${prod.costo.toLocaleString('es-CO')}):</span>
                              <span className="font-black text-slate-900">${subtotalCosto.toLocaleString('es-CO')}</span>
                            </div>
                            <p className="text-[9px] text-slate-400 italic mt-1">* Este monto se suma a la cuenta por pagar del proveedor</p>
                          </>
                        )}

                        {ticket.tipo === 'cortesia' && (
                          <>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400 font-bold">Entregado a:</span>
                              <span className="font-black text-amber-700 uppercase">{ticket.metadata?.persona}</span>
                            </div>
                            {ticket.metadata?.motivo && (
                              <div className="pt-2 border-t border-slate-200">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Motivo / Justificación:</p>
                                <p className="text-[11px] font-bold text-slate-800 italic">&ldquo;{ticket.metadata.motivo}&rdquo;</p>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Valor Comercial Perdido:</span>
                                <span className="font-black text-amber-600">${subtotalPrecio.toLocaleString('es-CO')}</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Costo Real Asumido:</span>
                                <span className="font-black text-slate-900">${subtotalCosto.toLocaleString('es-CO')}</span>
                              </div>
                            </div>
                          </>
                        )}

                        {ticket.tipo === 'perdida' && (
                          <>
                            <div className="pt-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Razón de la Baja:</p>
                              <p className="text-[11px] font-bold text-rose-600 italic">&ldquo;{ticket.metadata?.motivo || 'Sin especificar'}&rdquo;</p>
                            </div>
                            <div className="pt-2 border-t border-slate-200 space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Ingreso No Percibido:</span>
                                <span className="font-black text-rose-500">${subtotalPrecio.toLocaleString('es-CO')}</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Pérdida en Costo:</span>
                                <span className="font-black text-slate-900">${subtotalCosto.toLocaleString('es-CO')}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : ticket.msg.includes('Inventario inicial') && ticket.metadata ? (
                    /* ACTA DE INVENTARIO COMPLETA */
                    <div className="mb-6">
                      <div className="border-b-2 border-slate-900 pb-2 mb-4">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Lista de Carga Inicial</p>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto pr-2">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100">
                              <th className="text-left py-2">PRODUCTO</th>
                              <th className="text-center py-2">CANT.</th>
                              <th className="text-right py-2">PROVEEDOR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {Object.entries(ticket.metadata as Record<string, {cantidad: number, proveedor: string}>).map(([id, data]) => (
                              <tr key={id}>
                                <td className="py-2 font-bold text-slate-800 uppercase">{pName(id)}</td>
                                <td className="py-2 text-center font-black text-indigo-600">{data.cantidad}</td>
                                <td className="py-2 text-right text-slate-500 font-bold uppercase">{data.proveedor || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Log genérico sin producto */
                    <div className="border-2 border-dashed border-slate-100 rounded-2xl p-5 mb-6">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Descripción</p>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{ticket.msg}</p>
                    </div>
                  )}

                  {/* Firmas */}
                  <div className="grid grid-cols-2 gap-8 pt-8 mt-4">
                    <div className="text-center">
                      <div className="w-full h-px bg-slate-300 mb-2 mt-10" />
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Firma Responsable</p>
                      <p className="text-[8px] text-slate-300 font-bold mt-0.5">({evento.responsable})</p>
                    </div>
                    <div className="text-center">
                      <div className="w-full h-px bg-slate-300 mb-2 mt-10" />
                      <p className="text-[9px] font-bold text-slate-500 uppercase">{ticket.tipo === 'recarga' ? 'Firma Proveedor' : ticket.tipo === 'cortesia' ? 'Firma Beneficiario' : 'Firma Testigo'}</p>
                      <p className="text-[8px] text-slate-300 font-bold mt-0.5">({ticket.tipo === 'recarga' ? (ticket.metadata?.proveedor || 'Proveedor') : ticket.tipo === 'cortesia' ? (ticket.metadata?.persona || 'Beneficiario') : 'Testigo'})</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t border-dashed border-slate-200 text-center">
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">ID: {ticket.id}</p>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons (Non-printable) */}
            <div className="p-6 bg-slate-50 flex gap-3 no-print">
              <Btn variant="indigo" className="flex-1" onClick={() => window.print()} icon={<Printer size={16} />}>
                Imprimir Vale
              </Btn>
            </div>
          </div>
          
          <style jsx global>{`
            @media print {
              .no-print { display: none !important; }
              body * { visibility: hidden; }
              #printable-ticket, #printable-ticket * { visibility: visible; }
              #printable-ticket {
                position: fixed;
                left: 0;
                top: 0;
                width: 80mm; /* Ancho estándar de ticket térmico */
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
