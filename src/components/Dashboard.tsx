'use client';
import React, { useMemo } from 'react';
import { TrendingUp, BarChart3, DollarSign, Clock } from 'lucide-react';
import { Producto, Recarga, Cortesia, Perdida, Descuento } from '@/types';
import { fmt } from '@/utils/calculos';

interface DashboardProps {
  productos: Producto[];
  recargas: Recarga[];
  cortesias: Cortesia[];
  perdidas: Perdida[];
  descuentos: Descuento[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  dinero: { efectivo: number; datafono: number; nequi: number };
  consolidadoBarras?: { nombre: string; ventas: number; caja: number }[];
}

function BarHorizontal({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-black text-slate-600 w-28 truncate uppercase tracking-tight">{label}</p>
      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        >
          <span className="text-[10px] font-black text-white">{value}</span>
        </div>
      </div>
      <p className="text-[10px] font-bold text-slate-400 w-8 text-right">{pct}%</p>
    </div>
  );
}

export default function Dashboard({ productos, recargas, cortesias, perdidas, descuentos, inventarioInicial, dinero, consolidadoBarras }: DashboardProps) {
  
  // ── Top productos por unidades vendidas ─────────────────────────────────────
  const topProductos = useMemo(() => {
    return productos.map(p => {
      const ini = inventarioInicial[p.id]?.cantidad ?? 0;
      const rec = recargas.filter(r => r.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
      const cor = cortesias.filter(c => c.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
      const per = perdidas.filter(l => l.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
      const desc = descuentos.filter(d => d.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
      const stockFinal = ini + rec - cor - per;
      const vendidas = Math.max(0, ini + rec - stockFinal - cor - per - desc);
      const ingresos = vendidas * p.precio;
      return { nombre: p.nombre, vendidas, ingresos };
    })
    .filter(p => p.vendidas > 0)
    .sort((a, b) => b.vendidas - a.vendidas)
    .slice(0, 8);
  }, [productos, recargas, cortesias, perdidas, descuentos, inventarioInicial]);

  const maxVendidas = Math.max(...topProductos.map(p => p.vendidas), 1);

  // ── Distribución del recaudo ─────────────────────────────────────────────
  const totalDinero = dinero.efectivo + dinero.datafono + dinero.nequi;

  // ── Actividad por hora ────────────────────────────────────────────────────
  const actividadPorHora = useMemo(() => {
    const horas: Record<string, number> = {};
    [...recargas, ...cortesias, ...perdidas].forEach(item => {
      const hora = (item as any).hora?.slice(0, 5) ?? '??:??';
      const h = hora.split(':')[0] + ':00';
      horas[h] = (horas[h] || 0) + 1;
    });
    return Object.entries(horas).sort(([a], [b]) => a.localeCompare(b));
  }, [recargas, cortesias, perdidas]);
  const maxActividad = Math.max(...actividadPorHora.map(([, v]) => v), 1);

  // ── Comparativa de barras ─────────────────────────────────────────────────
  const maxBarVentas = Math.max(...(consolidadoBarras?.map(b => b.ventas) || []), 1);

  const METODOCOLORS: Record<string, string> = {
    efectivo: 'bg-emerald-500',
    datafono: 'bg-blue-500',
    nequi: 'bg-violet-500',
  };

  return (
    <div className="space-y-8 mt-10 print:mt-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00d2ff] to-[#ff0099] flex items-center justify-center">
          <BarChart3 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Dashboard · Estadísticas del Evento</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Análisis completo de rendimiento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── TOP PRODUCTOS ── */}
        <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-cyan-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Top Productos Vendidos</h3>
          </div>
          {topProductos.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Sin ventas registradas</p>
          ) : (
            <div className="space-y-3">
              {topProductos.map((p, i) => (
                <BarHorizontal
                  key={p.nombre}
                  label={p.nombre}
                  value={p.vendidas}
                  max={maxVendidas}
                  color={i === 0 ? 'bg-gradient-to-r from-[#00d2ff] to-[#ff0099]' : i === 1 ? 'bg-cyan-500' : i === 2 ? 'bg-violet-500' : 'bg-slate-400'}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── DISTRIBUCIÓN RECAUDO ── */}
        <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign size={16} className="text-emerald-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Distribución del Recaudo</h3>
          </div>
          {totalDinero === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Sin recaudo registrado</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Efectivo', value: dinero.efectivo, color: 'bg-emerald-500' },
                { label: 'Datáfono', value: dinero.datafono, color: 'bg-blue-500' },
                { label: 'Nequi', value: dinero.nequi, color: 'bg-violet-500' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{m.label}</span>
                    <span className="text-xs font-black text-slate-900">{fmt(m.value)}</span>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.color} transition-all duration-700`}
                      style={{ width: `${totalDinero > 0 ? Math.round((m.value / totalDinero) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total recaudado</p>
                <p className="text-2xl font-black text-slate-900">{fmt(totalDinero)}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── ACTIVIDAD POR HORA ── */}
        <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} className="text-violet-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Actividad por Hora</h3>
          </div>
          {actividadPorHora.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Sin actividad registrada</p>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {actividadPorHora.map(([hora, cantidad]) => {
                const height = Math.max((cantidad / maxActividad) * 100, 6);
                return (
                  <div key={hora} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold text-slate-500">{cantidad}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-violet-500 to-cyan-400 transition-all duration-700"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[7px] font-bold text-slate-400 rotate-45 origin-left">{hora}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── COMPARATIVA POR BARRA ── */}
        {consolidadoBarras && consolidadoBarras.length > 0 && (
          <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-pink-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Ventas por Barra</h3>
            </div>
            <div className="space-y-3">
              {consolidadoBarras
                .sort((a, b) => b.ventas - a.ventas)
                .map((b, i) => (
                  <BarHorizontal
                    key={b.nombre}
                    label={b.nombre}
                    value={b.ventas}
                    max={maxBarVentas}
                    color={i === 0 ? 'bg-gradient-to-r from-[#ff0099] to-[#00d2ff]' : i === 1 ? 'bg-pink-500' : 'bg-slate-400'}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
