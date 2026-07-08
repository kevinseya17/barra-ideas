'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Activity, RefreshCw, Gift, AlertTriangle, Percent, Banknote, PackagePlus, Eye, TrendingUp, Snowflake, FlameKindling, ShieldCheck, ArrowLeftRight } from 'lucide-react';

interface BarActivity {
  id: string;
  eventoId: string;
  barNombre: string;
  tipo: 'recarga' | 'cortesia' | 'perdida' | 'descuento' | 'gasto';
  descripcion: string;
  hora: string;
  cantidad?: number;
  monto?: number;
  producto?: string;
  persona?: string;
}

interface BarData {
  evento: { id: string; nombre: string };
  recargas: any[];
  cortesias: any[];
  perdidas: any[];
  descuentos: any[];
  gastos: any[];
}

interface MonitorBarrasProps {
  barEvents: { id: string; nombre: string; estado?: string }[]; // Las barras activas (sin bodega)
  productos: { id: string; nombre: string }[];
  isDark?: boolean;
  onCongelarBarra?: (eventoId: string, congelar: boolean) => Promise<void>;
}

const TIPO_META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  recarga:   { icon: <PackagePlus size={14} />, label: 'Recarga',   color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100' },
  cortesia:  { icon: <Gift size={14} />,        label: 'Cortesía',  color: 'text-pink-600',    bg: 'bg-pink-50 border-pink-100' },
  perdida:   { icon: <AlertTriangle size={14}/>, label: 'Pérdida',  color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-100' },
  descuento: { icon: <Percent size={14} />,     label: 'Descuento', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
  gasto:     { icon: <Banknote size={14} />,    label: 'Gasto',     color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-100' },
};

// Colores por barra (para distinguirlas visualmente)
const BAR_COLORS = [
  'bg-cyan-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
];

const PIN_ADMIN = '1234';

export default function MonitorBarras({ barEvents, productos, isDark, onCongelarBarra }: MonitorBarrasProps) {
  const [allActivity, setAllActivity] = useState<BarActivity[]>([]);
  const [barDataCache, setBarDataCache] = useState<Record<string, BarData>>({});
  const [selectedBar, setSelectedBar] = useState<string>('all');
  const [monitorTab, setMonitorTab] = useState<'actividad' | 'transferencias'>('actividad');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  // Estado para el modal de PIN de congelar
  const [pinModal, setPinModal] = useState<{ eventoId: string; nombre: string; congelar: boolean } | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);
  const [congelando, setCongelando] = useState(false);

  const pName = (id: string) => productos.find(p => p.id === id)?.nombre || 'Producto';

  const buildActivity = useCallback((barData: Record<string, BarData>): BarActivity[] => {
    const acts: BarActivity[] = [];

    Object.values(barData).forEach(({ evento, recargas, cortesias, perdidas, descuentos, gastos }) => {
      const barNombre = evento.nombre.replace(/^.*- /, ''); // "Barra 1", "Barra 2", etc.

      recargas.forEach(r => acts.push({
        id: `r-${r.id}`, eventoId: evento.id, barNombre,
        tipo: 'recarga',
        descripcion: `${r.cantidad} × ${pName(r.producto_id)}${r.proveedor ? ` (${r.proveedor})` : ''}`,
        hora: r.hora, cantidad: r.cantidad, producto: pName(r.producto_id)
      }));

      cortesias.forEach(c => acts.push({
        id: `c-${c.id}`, eventoId: evento.id, barNombre,
        tipo: 'cortesia',
        descripcion: `${c.cantidad} × ${pName(c.producto_id)} → ${c.persona}${c.motivo ? ` (${c.motivo})` : ''}`,
        hora: c.hora, cantidad: c.cantidad, producto: pName(c.producto_id), persona: c.persona
      }));

      perdidas.forEach(p => acts.push({
        id: `p-${p.id}`, eventoId: evento.id, barNombre,
        tipo: 'perdida',
        descripcion: `${p.cantidad} × ${pName(p.producto_id)}${p.motivo ? ` — ${p.motivo}` : ''}`,
        hora: p.hora, cantidad: p.cantidad, producto: pName(p.producto_id)
      }));

      descuentos.forEach(d => acts.push({
        id: `d-${d.id}`, eventoId: evento.id, barNombre,
        tipo: 'descuento',
        descripcion: `${d.cantidad} × ${pName(d.producto_id)} al ${d.porcentaje}% off${d.motivo ? ` (${d.motivo})` : ''}`,
        hora: d.hora, cantidad: d.cantidad, producto: pName(d.producto_id), monto: d.valor_descontado
      }));

      gastos.forEach(g => acts.push({
        id: `g-${g.id}`, eventoId: evento.id, barNombre,
        tipo: 'gasto',
        descripcion: `$${Number(g.monto).toLocaleString('es-CO')} — ${g.concepto} (${g.metodo})`,
        hora: g.hora, monto: g.monto
      }));
    });

    // Ordenar por hora (más reciente primero)
    return acts.sort((a, b) => b.hora.localeCompare(a.hora));
  }, [productos]);

  const loadAllBars = useCallback(async () => {
    if (barEvents.length === 0) { setIsLoading(false); return; }

    const results = await Promise.all(
      barEvents.map(async ev => {
        const data = await api.getEventoData(ev.id);
        return { evento: ev, ...data };
      })
    );

    const cache: Record<string, BarData> = {};
    results.forEach(r => { cache[r.evento.id] = r as BarData; });

    setBarDataCache(cache);
    setAllActivity(buildActivity(cache));
    setLastUpdate(new Date());
    setIsLoading(false);
  }, [barEvents, buildActivity]);

  // Carga inicial y polling cada 5 segundos
  useEffect(() => {
    loadAllBars();
    const interval = setInterval(loadAllBars, 5000);
    return () => clearInterval(interval);
  }, [loadAllBars]);

  // Supabase Realtime: escuchar INSERT en todas las barras
  useEffect(() => {
    if (barEvents.length === 0) return;
    const eventIds = barEvents.map(e => e.id);

    const channels = eventIds.map(evId => {
      const barEv = barEvents.find(e => e.id === evId)!;
      const barNombre = barEv.nombre.replace(/^.*- /, '');

      return supabase
        .channel(`monitor_bar_${evId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recargas', filter: `evento_id=eq.${evId}` }, (payload) => {
          const r = payload.new as any;
          const newAct: BarActivity = {
            id: `r-${r.id}`, eventoId: evId, barNombre, tipo: 'recarga',
            descripcion: `${r.cantidad} × ${pName(r.producto_id)}${r.proveedor ? ` (${r.proveedor})` : ''}`,
            hora: r.hora, cantidad: r.cantidad, producto: pName(r.producto_id)
          };
          setAllActivity(prev => [newAct, ...prev]);
          setLastUpdate(new Date());
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cortesias', filter: `evento_id=eq.${evId}` }, (payload) => {
          const c = payload.new as any;
          const newAct: BarActivity = {
            id: `c-${c.id}`, eventoId: evId, barNombre, tipo: 'cortesia',
            descripcion: `${c.cantidad} × ${pName(c.producto_id)} → ${c.persona}${c.motivo ? ` (${c.motivo})` : ''}`,
            hora: c.hora, cantidad: c.cantidad, producto: pName(c.producto_id), persona: c.persona
          };
          setAllActivity(prev => [newAct, ...prev]);
          setLastUpdate(new Date());
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'perdidas', filter: `evento_id=eq.${evId}` }, (payload) => {
          const p = payload.new as any;
          const newAct: BarActivity = {
            id: `p-${p.id}`, eventoId: evId, barNombre, tipo: 'perdida',
            descripcion: `${p.cantidad} × ${pName(p.producto_id)}${p.motivo ? ` — ${p.motivo}` : ''}`,
            hora: p.hora, cantidad: p.cantidad, producto: pName(p.producto_id)
          };
          setAllActivity(prev => [newAct, ...prev]);
          setLastUpdate(new Date());
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'descuentos', filter: `evento_id=eq.${evId}` }, (payload) => {
          const d = payload.new as any;
          const newAct: BarActivity = {
            id: `d-${d.id}`, eventoId: evId, barNombre, tipo: 'descuento',
            descripcion: `${d.cantidad} × ${pName(d.producto_id)} al ${d.porcentaje}% off`,
            hora: d.hora, cantidad: d.cantidad, producto: pName(d.producto_id)
          };
          setAllActivity(prev => [newAct, ...prev]);
          setLastUpdate(new Date());
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gastos', filter: `evento_id=eq.${evId}` }, (payload) => {
          const g = payload.new as any;
          const newAct: BarActivity = {
            id: `g-${g.id}`, eventoId: evId, barNombre, tipo: 'gasto',
            descripcion: `$${Number(g.monto).toLocaleString('es-CO')} — ${g.concepto}`,
            hora: g.hora, monto: g.monto
          };
          setAllActivity(prev => [newAct, ...prev]);
          setLastUpdate(new Date());
        })
        .subscribe();
    });

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [barEvents]);

  const filtered = selectedBar === 'all'
    ? allActivity
    : allActivity.filter(a => a.eventoId === selectedBar);

  // Resumen por barra
  const barSummary = barEvents.map((ev, idx) => {
    const data = barDataCache[ev.id];
    const acts = allActivity.filter(a => a.eventoId === ev.id);
    return {
      ev, idx,
      recargas: data?.recargas?.length || 0,
      cortesias: data?.cortesias?.length || 0,
      perdidas: data?.perdidas?.length || 0,
      total: acts.length,
      congelada: (ev as any).estado === 'congelado',
    };
  });

  const abrirPinCongelar = (eventoId: string, nombre: string, congelar: boolean) => {
    setPinValue('');
    setPinError(false);
    setPinModal({ eventoId, nombre, congelar });
  };

  const confirmarCongelar = async () => {
    if (!pinModal) return;
    if (pinValue !== PIN_ADMIN) {
      setPinError(true);
      setPinValue('');
      return;
    }
    setCongelando(true);
    if (onCongelarBarra) {
      await onCongelarBarra(pinModal.eventoId, pinModal.congelar);
    }
    setPinModal(null);
    setCongelando(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00d2ff] to-[#ff0099] flex items-center justify-center">
            <RefreshCw size={24} className="text-white animate-spin" />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando actividad de barras...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00d2ff] to-[#ff0099] flex items-center justify-center shadow-lg shadow-cyan-200">
            <Eye size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Monitor Central de Barras</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Todo lo que hacen tus barras · Última actualización: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">En Vivo</span>
        </div>
      </div>

      {/* TARJETAS RESUMEN POR BARRA */}
      {barEvents.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border-2 border-dashed border-slate-200">
          <Activity size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-sm">No hay barras activas en este evento</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {barSummary.map(({ ev, idx, recargas, cortesias, perdidas, total, congelada }) => (
              <div
                key={ev.id}
                className={`p-6 rounded-3xl border-2 text-left transition-all ${
                  congelada
                    ? 'border-blue-200 bg-blue-50/60 opacity-75'
                    : selectedBar === ev.id
                      ? 'border-[#00d2ff] bg-cyan-50 shadow-lg shadow-cyan-100'
                      : 'border-slate-100 bg-white hover:border-[#00d2ff] hover:shadow-lg'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-2xl ${
                    congelada ? 'bg-blue-400' : BAR_COLORS[idx % BAR_COLORS.length]
                  } flex items-center justify-center text-white font-black text-sm shadow-md`}>
                    {congelada ? <Snowflake size={18} /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-900 text-sm uppercase tracking-tight truncate">{ev.nombre.replace(/^.*- /, '')}</p>
                      {congelada && (
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full shrink-0">❄️ Congelada</span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{total} movimientos</p>
                  </div>
                  {selectedBar === ev.id && !congelada && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  )}
                </div>

                {/* Stats */}
                <div
                  className="grid grid-cols-3 gap-2 mb-4 cursor-pointer"
                  onClick={() => !congelada && setSelectedBar(selectedBar === ev.id ? 'all' : ev.id)}
                >
                  <div className="text-center p-2 rounded-xl bg-indigo-50">
                    <p className="text-lg font-black text-indigo-600">{recargas}</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase">Recargas</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-pink-50">
                    <p className="text-lg font-black text-pink-600">{cortesias}</p>
                    <p className="text-[9px] font-bold text-pink-400 uppercase">Cortesías</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-rose-50">
                    <p className="text-lg font-black text-rose-600">{perdidas}</p>
                    <p className="text-[9px] font-bold text-rose-400 uppercase">Pérdidas</p>
                  </div>
                </div>

                {/* Botón Congelar/Descongelar */}
                {onCongelarBarra && (
                  <button
                    onClick={() => abrirPinCongelar(ev.id, ev.nombre.replace(/^.*- /, ''), !congelada)}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      congelada
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                    }`}
                  >
                    {congelada ? (
                      <><FlameKindling size={12} /> Descongelar barra</>
                    ) : (
                      <><Snowflake size={12} /> Congelar barra</>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* TABS ACTIVIDAD / TRANSFERENCIAS */}
          <div className="flex gap-2">
            <button
              onClick={() => setMonitorTab('actividad')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                monitorTab === 'actividad' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              📡 Actividad en Vivo
            </button>
            <button
              onClick={() => setMonitorTab('transferencias')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                monitorTab === 'transferencias' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <ArrowLeftRight size={12} /> Transferencias
            </button>
          </div>

          {monitorTab === 'actividad' && (
            <>
              {/* FILTRO */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedBar('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedBar === 'all'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Todas las Barras
                </button>
                {barEvents.map((ev, idx) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedBar(selectedBar === ev.id ? 'all' : ev.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      selectedBar === ev.id
                        ? `${BAR_COLORS[idx % BAR_COLORS.length]} text-white shadow-md`
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {ev.nombre.replace(/^.*- /, '')}
                  </button>
                ))}
                <button
                  onClick={loadAllBars}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-cyan-600 hover:bg-cyan-50 transition-all"
                >
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>

              {/* FEED DE ACTIVIDAD */}
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 rounded-3xl border-2 border-dashed border-slate-100">
                    <TrendingUp size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Sin actividad registrada aún</p>
                  </div>
                ) : (
                  filtered.map((act, i) => {
                    const meta = TIPO_META[act.tipo];
                    const barIdx = barEvents.findIndex(e => e.id === act.eventoId);
                    const barColor = BAR_COLORS[barIdx % BAR_COLORS.length];
                    return (
                      <div
                        key={act.id}
                        className={`flex items-start gap-4 p-4 rounded-2xl border animate-in slide-in-from-top-1 ${meta.bg}`}
                        style={{ animationDelay: `${i * 20}ms` }}
                      >
                        <div className={`w-1.5 self-stretch rounded-full ${barColor} shrink-0`} />
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color} bg-white shadow-sm border border-current/10`}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">·</span>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{act.barNombre}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 leading-snug">{act.descripcion}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{act.hora}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {monitorTab === 'transferencias' && (() => {
            // Recopilar todos los traslados de todas las barras
            const traslados: { hora: string; origen: string; destino: string; producto: string; cantidad: number }[] = [];

            Object.values(barDataCache).forEach(({ evento, perdidas: pers, recargas: recs }) => {
              const barNombre = evento.nombre.replace(/^.*- /, '');
              // Pérdidas = salida de Barra A ("Traslado enviado →")
              pers.filter((p: any) => String(p.motivo || '').startsWith('Traslado enviado')).forEach((p: any) => {
                const match = String(p.motivo).match(/→ (.+)$/);
                const destino = match ? match[1].replace(/^.*- /, '') : '?';
                const prodNombre = productos.find(x => x.id === p.producto_id)?.nombre || p.producto_id;
                traslados.push({ hora: p.hora || '--:--', origen: barNombre, destino, producto: prodNombre, cantidad: p.cantidad });
              });
            });

            traslados.sort((a, b) => b.hora.localeCompare(a.hora));

            return (
              <div className="space-y-3">
                {traslados.length === 0 ? (
                  <div className="text-center py-12 rounded-3xl border-2 border-dashed border-slate-100">
                    <ArrowLeftRight size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Sin transferencias entre barras aún</p>
                  </div>
                ) : (
                  traslados.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border bg-indigo-50 border-indigo-100 animate-in slide-in-from-top-1">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                        <ArrowLeftRight size={14} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">{t.origen}</span>
                          <span className="text-indigo-400">→</span>
                          <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">{t.destino}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-xs font-bold text-slate-700">{t.producto}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-500 text-white text-[10px] font-black">
                            ×{t.cantidad}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{t.hora}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>

    {/* Modal PIN para congelar/descongelar */}
    {pinModal && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className={`p-8 bg-gradient-to-br ${
            pinModal.congelar ? 'from-blue-900 to-slate-900' : 'from-amber-900 to-slate-900'
          }`}>
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                pinModal.congelar
                  ? 'bg-blue-500/20 border-blue-500/30'
                  : 'bg-amber-500/20 border-amber-500/30'
              }`}>
                {pinModal.congelar
                  ? <Snowflake size={28} className="text-blue-300" />
                  : <FlameKindling size={28} className="text-amber-300" />}
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {pinModal.congelar ? 'Congelar Barra' : 'Descongelar Barra'}
              </h3>
              <p className={`text-[10px] font-black uppercase tracking-widest ${
                pinModal.congelar ? 'text-blue-300' : 'text-amber-300'
              }`}>{pinModal.nombre}</p>
            </div>
          </div>
          <div className="p-8 flex flex-col gap-4">
            <div className={`p-3 rounded-2xl border text-center text-xs font-bold ${
              pinModal.congelar
                ? 'bg-blue-50 border-blue-100 text-blue-700'
                : 'bg-amber-50 border-amber-100 text-amber-700'
            }`}>
              {pinModal.congelar
                ? '❄️ La barra quedará excluida del consolidado global. Podrás descongelarla cuando quieras.'
                : '🔥 La barra volverá a aparecer en el consolidado global.'}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PIN de Admin</p>
              <div className="flex items-center gap-2 justify-center">
                <ShieldCheck size={14} className="text-slate-400" />
                <span className="text-[10px] text-slate-400">Ingresa el PIN para confirmar</span>
              </div>
            </div>
            <input
              type="password"
              maxLength={4}
              className="w-full h-12 bg-slate-50 border-2 border-slate-200 focus:border-[#00d2ff] rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none transition-all"
              placeholder="••••"
              value={pinValue}
              autoFocus
              onChange={e => { setPinValue(e.target.value); setPinError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') confirmarCongelar(); }}
            />
            {pinError && (
              <p className="text-rose-500 text-xs font-black uppercase tracking-widest text-center animate-in fade-in">
                ❌ PIN incorrecto
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setPinModal(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCongelar}
                disabled={congelando}
                className={`flex-1 py-3 rounded-2xl text-white font-black text-xs transition-all shadow-lg ${
                  pinModal.congelar
                    ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                } disabled:opacity-50`}
              >
                {congelando ? '...' : pinModal.congelar ? '❄️ Congelar' : '🔥 Descongelar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
