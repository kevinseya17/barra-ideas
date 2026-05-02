
'use client';
import React, { useState } from 'react';
import { RefreshCw, Gift, AlertTriangle, Package, Clock } from 'lucide-react';
import { Producto, Recarga, Cortesia, Perdida, LogEntry } from '@/types';
import { uid, nowTime } from '@/utils/calculos';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';

type Tab = 'inventario' | 'recargas' | 'cortesias' | 'perdidas';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string };
  productos: Producto[];
  inventarioInicial: Record<string, number>;
  recargas: Recarga[];
  cortesias: Cortesia[];
  perdidas: Perdida[];
  log: LogEntry[];
  onSaveInicial: (inv: Record<string, number>) => void;
  onAddRecarga: (r: Omit<Recarga, 'id'>) => void;
  onAddCortesia: (c: Omit<Cortesia, 'id'>) => void;
  onAddPerdida: (p: Omit<Perdida, 'id'>) => void;
  onCierre: () => void;
  onAtras: () => void;
}

const TIPO_LOG: Record<LogEntry['tipo'], string> = {
  info: 'bg-slate-100 text-slate-500 border-slate-200',
  recarga: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  cortesia: 'bg-violet-50 text-violet-600 border-violet-100',
  perdida: 'bg-rose-50 text-rose-600 border-rose-100',
  cierre: 'bg-amber-50 text-amber-700 border-amber-100',
};

export default function Operacion({
  evento, productos, inventarioInicial, recargas, cortesias, perdidas, log,
  onSaveInicial, onAddRecarga, onAddCortesia, onAddPerdida, onCierre, onAtras,
}: Props) {
  const [tab, setTab] = useState<Tab>('inventario');
  const [invLocal, setInvLocal] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(inventarioInicial).map(([k, v]) => [k, String(v)]))
  );
  const [rec, setRec] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', proveedor: '' });
  const [cor, setCor] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', persona: '', motivo: '' });
  const [per, setPer] = useState({ producto_id: productos[0]?.id ?? '', cantidad: '', motivo: '' });
  const [guardadoInv, setGuardadoInv] = useState(Object.keys(inventarioInicial).length > 0);

  const pName = (id: string) => productos.find(x => x.id === id)?.nombre ?? id;

  const saveInv = () => {
    const inv = Object.fromEntries(Object.entries(invLocal).map(([k, v]) => [k, Number(v || 0)]));
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
    onAddCortesia({ evento_id: '', producto_id: cor.producto_id, cantidad: Number(cor.cantidad), persona: cor.persona, motivo: cor.motivo });
    setCor(c => ({ ...c, cantidad: '', persona: '', motivo: '' }));
  };

  const doPerdida = () => {
    if (!per.cantidad) return;
    onAddPerdida({ evento_id: '', producto_id: per.producto_id, cantidad: Number(per.cantidad), motivo: per.motivo });
    setPer(p => ({ ...p, cantidad: '', motivo: '' }));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'inventario', label: 'Inventario', icon: <Package size={15} /> },
    { id: 'recargas', label: 'Recargas', icon: <RefreshCw size={15} />, count: recargas.length },
    { id: 'cortesias', label: 'Cortesías', icon: <Gift size={15} />, count: cortesias.length },
    { id: 'perdidas', label: 'Pérdidas', icon: <AlertTriangle size={15} />, count: perdidas.length },
  ];

  const tabActive = 'bg-slate-900 text-white shadow-md';
  const tabInactive = 'text-slate-500 hover:bg-slate-50';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">

        {/* MAIN CONSOLE */}
        <div className="flex-1 min-w-0">
          <SectionHeader
            step="PASO 2 / OPERACIÓN EN VIVO"
            title={evento.nombre}
            sub={`${evento.responsable} · Registro de actividad en tiempo real`}
          />

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
            {/* INVENTARIO INICIAL */}
            {tab === 'inventario' && (
              <Card className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-900">Control de Inventario Inicial</h3>
                  <Badge color={guardadoInv ? 'indigo' : 'yellow'}>{guardadoInv ? 'Sincronizado' : 'Pendiente'}</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {productos.map(p => (
                    <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.categoria}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          className={`${inputCls} w-24 text-center text-lg font-bold py-2`}
                          placeholder="0"
                          value={invLocal[p.id] ?? ''}
                          onChange={e => setInvLocal(inv => ({ ...inv, [p.id]: e.target.value }))}
                        />
                        <span className="text-[10px] text-slate-400 font-bold uppercase w-12">{p.unidad}s</span>
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

            {/* RECARGAS */}
            {tab === 'recargas' && (
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <RefreshCw size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Gestión de Recargas</h3>
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
                  <Field label="Proveedor / Info">
                    <input className={inputCls} value={rec.proveedor} onChange={e => setRec(r => ({ ...r, proveedor: e.target.value }))} placeholder="Opcional" />
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
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                    <Gift size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Registro de Cortesías</h3>
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
                        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-400 font-bold text-xs">
                          {c.cantidad}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(c.producto_id)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Entregado a: {c.persona}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 italic">"{c.motivo || 'Sin motivo'}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* PÉRDIDAS */}
            {tab === 'perdidas' && (
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Bajas y Pérdidas</h3>
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
                      <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-rose-100 bg-rose-50/20">
                        <Badge color="red">{p.cantidad}</Badge>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{pName(p.producto_id)}</p>
                          <p className="text-[10px] text-rose-600 font-bold uppercase">Motivo: {p.motivo}</p>
                        </div>
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
        <div className="w-full lg:w-80 shrink-0">
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
                    
                    <div className={`rounded-2xl p-4 border transition-all hover:shadow-sm ${TIPO_LOG[l.tipo]}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{l.tipo}</span>
                        <span className="text-[9px] font-bold opacity-40">{l.time}</span>
                      </div>
                      <p className="text-xs font-bold leading-relaxed">{l.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
