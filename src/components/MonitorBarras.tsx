'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Activity, RefreshCw, Gift, AlertTriangle, Percent, Banknote, PackagePlus, Eye, TrendingUp } from 'lucide-react';

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
  barEvents: { id: string; nombre: string }[]; // Las barras activas (sin bodega)
  productos: { id: string; nombre: string }[];
  isDark?: boolean;
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

export default function MonitorBarras({ barEvents, productos, isDark }: MonitorBarrasProps) {
  const [allActivity, setAllActivity] = useState<BarActivity[]>([]);
  const [barDataCache, setBarDataCache] = useState<Record<string, BarData>>({});
  const [selectedBar, setSelectedBar] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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
    };
  });

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
            {barSummary.map(({ ev, idx, recargas, cortesias, perdidas, total }) => (
              <button
                key={ev.id}
                onClick={() => setSelectedBar(selectedBar === ev.id ? 'all' : ev.id)}
                className={`p-6 rounded-3xl border-2 text-left transition-all hover:shadow-lg group ${
                  selectedBar === ev.id
                    ? 'border-[#00d2ff] bg-cyan-50 shadow-lg shadow-cyan-100'
                    : 'border-slate-100 bg-white hover:border-[#00d2ff]'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-2xl ${BAR_COLORS[idx % BAR_COLORS.length]} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{ev.nombre.replace(/^.*- /, '')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{total} movimientos</p>
                  </div>
                  {selectedBar === ev.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
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
              </button>
            ))}
          </div>

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
                    {/* Indicador de barra */}
                    <div className={`w-1.5 self-stretch rounded-full ${barColor} shrink-0`} />

                    {/* Ícono tipo */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color} bg-white shadow-sm border border-current/10`}>
                      {meta.icon}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">·</span>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{act.barNombre}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-snug">{act.descripcion}</p>
                    </div>

                    {/* Hora */}
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{act.hora}</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
