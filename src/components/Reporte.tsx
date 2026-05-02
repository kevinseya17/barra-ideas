'use client';
import React from 'react';
import { Download, RefreshCw, TrendingUp, TrendingDown, DollarSign, Package, ArrowLeft, Lightbulb, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ResumenProducto } from '@/types';
import { fmt, exportarCSV } from '@/utils/calculos';
import { Btn, Card, Stat, Badge, catColor, SectionHeader } from './UI';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string; caja_inicial?: number };
  resumen: ResumenProducto[];
  dinero: { efectivo: number; datafono: number; nequi: number };
  onNuevoEvento: () => void;
  onAtras: () => void;
}

export default function Reporte({ evento, resumen, dinero, onNuevoEvento, onAtras }: Props) {
  const totalVentas = resumen.reduce((a, b) => a + b.ingresoEsperado, 0);
  const totalEsperado = totalVentas + (evento.caja_inicial || 0);
  const totalRecibido = dinero.efectivo + dinero.datafono + dinero.nequi;
  const diferencia = totalRecibido - totalEsperado;
  const totalCortesias = resumen.reduce((a, b) => a + b.costoCortesias, 0);
  const totalCostoVendido = resumen.reduce((a, b) => a + b.vendido * b.costo, 0);
  const utilidadBruta = totalVentas - totalCostoVendido;
  const ok = diferencia >= 0;

  const doExport = () => exportarCSV(resumen, evento.nombre, evento.fecha, dinero.efectivo, dinero.datafono, dinero.nequi, evento.caja_inicial || 0);

  // Motor de Inteligencia (Insights)
  const insights = [];
  if (diferencia < 0) {
    const peorFaltante = [...resumen].sort((a, b) => b.ingresoEsperado - a.ingresoEsperado)[0];
    insights.push({ tipo: 'error', txt: `Hay un faltante de caja de ${fmt(Math.abs(diferencia))}. Se sugiere re-contar el producto de mayor impacto: ${peorFaltante.nombre}.` });
  } else if (diferencia > 0) {
    insights.push({ tipo: 'warn', txt: `Hay un sobrante en caja de ${fmt(diferencia)}. Verifica si olvidaste registrar cortesías o si cobraste un producto de más.` });
  } else {
    insights.push({ tipo: 'ok', txt: `¡Caja cuadrada a la perfección! No hay discrepancias matemáticas.` });
  }

  if (totalCortesias > (totalVentas * 0.15)) {
    insights.push({ tipo: 'warn', txt: `Alerta: Las cortesías representan más del 15% del ingreso total esperado. Esto impacta fuertemente la rentabilidad del evento.` });
  }
  
  const perdidasTotales = resumen.reduce((a, b) => a + (b.per * b.costo), 0);
  if (perdidasTotales > 0) {
    insights.push({ tipo: 'error', txt: `Tuviste pérdidas o bajas (ej. botellas rotas) que te costaron ${fmt(perdidasTotales)}. Revisa los motivos reportados en el historial.` });
  } else {
    insights.push({ tipo: 'ok', txt: `Excelente manejo de inventario físico. No se reportaron incidentes ni productos dañados.` });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-10">
        <SectionHeader
          step="AUDITORÍA FINAL DE EVENTO"
          title={evento.nombre}
          sub={`${evento.fecha} · Responsable: ${evento.responsable}`}
          color="text-indigo-600"
        />
        <div className="flex gap-3 shrink-0 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <Btn variant="ghost" icon={<ArrowLeft size={16} />} onClick={onAtras}>
            Corregir Auditoría
          </Btn>
          <Btn variant="indigo" icon={<Download size={16} />} onClick={doExport}>
            Exportar Informe CSV
          </Btn>
          <Btn variant="ghost" icon={<RefreshCw size={16} />} onClick={onNuevoEvento}>
            Nuevo Evento
          </Btn>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
        <Stat
          label="Ventas Brutas"
          value={fmt(totalVentas)}
          color="text-indigo-600"
          icon={<TrendingUp size={20} />}
        />
        <Stat
          label="Total Caja Físico"
          value={fmt(totalRecibido)}
          color="text-slate-900"
          icon={<DollarSign size={20} />}
        />
        <Stat
          label={ok ? 'Balance (Sobrante)' : 'Balance (Faltante)'}
          value={fmt(Math.abs(diferencia))}
          color={ok ? 'text-emerald-600' : 'text-rose-500'}
          sub={ok ? '✓ Cuadre Exitoso' : '🚨 Revisar Incidencias'}
          icon={ok ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        />
        <Stat
          label="Utilidad Estimada"
          value={fmt(utilidadBruta)}
          color="text-violet-600"
          icon={<TrendingUp size={20} />}
        />
        <Stat
          label="Costo Cortesías"
          value={fmt(totalCortesias)}
          color="text-amber-500"
          icon={<Package size={20} />}
        />
      </div>

      {/* Motor de Alertas Inteligentes */}
      <Card className="p-8 mb-10 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Lightbulb size={20} className="text-indigo-500" /> Análisis Inteligente de Auditoría
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border ${
              ins.tipo === 'error' ? 'bg-rose-50/50 border-rose-200 text-rose-800' :
              ins.tipo === 'warn' ? 'bg-amber-50/50 border-amber-200 text-amber-800' :
              'bg-emerald-50/50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="mt-0.5">
                {ins.tipo === 'error' && <AlertCircle size={18} className="text-rose-500" />}
                {ins.tipo === 'warn' && <AlertCircle size={18} className="text-amber-500" />}
                {ins.tipo === 'ok' && <CheckCircle2 size={18} className="text-emerald-500" />}
              </div>
              <p className="text-sm font-bold leading-relaxed">{ins.txt}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Desglose de Dinero */}
        <Card className="p-8 lg:col-span-1">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
            <DollarSign size={20} className="text-slate-400" /> Desglose de Caja
          </h3>
          <div className="space-y-6 mb-10">
            {[
              { label: 'Caja Inicial (Base)', val: evento.caja_inicial || 0, color: 'text-slate-500' },
              { label: 'Efectivo Registrado', val: dinero.efectivo, color: 'text-slate-900' },
              { label: 'Ventas por Datáfono', val: dinero.datafono, color: 'text-slate-900' },
              { label: 'Nequi / Transferencias', val: dinero.nequi, color: 'text-slate-900' }
            ].map(d => (
              <div key={d.label} className="flex justify-between items-end border-b border-slate-50 pb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.label}</p>
                <p className={`text-xl font-bold ${d.color}`}>{fmt(d.val)}</p>
              </div>
            ))}
          </div>

          <div className={`p-6 rounded-3xl border transition-all ${
            ok ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                ok ? 'bg-white text-emerald-600' : 'bg-white text-rose-600'
              }`}>
                {ok ? '✓' : '!'}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold uppercase tracking-wider ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {ok ? 'Estado: Conforme' : 'Estado: Discrepancia'}
                </p>
                <p className={`text-lg font-black mt-1 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {ok ? 'Caja Nivelada' : `Faltante: ${fmt(Math.abs(diferencia))}`}
                </p>
                {!ok && (
                  <p className="text-[10px] font-bold text-rose-400 mt-2 uppercase leading-relaxed">
                    Se recomienda auditar las pérdidas y el registro de cortesías.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabla Detallada */}
        <Card className="p-8 lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package size={20} className="text-slate-400" /> Movimiento de Inventario
            </h3>
            <Badge color="indigo">Total {resumen.length} Productos</Badge>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Producto</th>
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Disp.</th>
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Final</th>
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-amber-500">Cort.</th>
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-rose-500">Pérd.</th>
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-900 uppercase tracking-widest whitespace-nowrap bg-slate-50 rounded-t-lg">Vendido</th>
                  <th className="text-right py-4 px-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest whitespace-nowrap">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resumen.map(p => (
                  <tr key={p.id} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-800">{p.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.categoria}</p>
                    </td>
                    <td className="py-4 px-2 text-center font-bold text-slate-500">{p.disponible}</td>
                    <td className="py-4 px-2 text-center font-bold text-slate-500">{p.fin}</td>
                    <td className="py-4 px-2 text-center font-bold text-amber-500 bg-amber-50/30">{p.cor}</td>
                    <td className="py-4 px-2 text-center font-bold text-rose-500 bg-rose-50/30">{p.per}</td>
                    <td className="py-4 px-2 text-center font-black text-slate-900 bg-slate-50 group-hover:bg-indigo-50 transition-colors">{p.vendido}</td>
                    <td className="py-4 px-2 text-right font-black text-indigo-600 whitespace-nowrap">{fmt(p.ingresoEsperado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={6} className="py-4 px-4 font-bold text-right text-xs uppercase tracking-[0.2em] rounded-bl-3xl">Gran Total Ingreso Esperado</td>
                  <td className="py-4 px-4 font-black text-right text-lg rounded-br-3xl">{fmt(totalEsperado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
