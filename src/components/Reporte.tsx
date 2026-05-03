'use client';
import React from 'react';
import { Download, RefreshCw, TrendingUp, TrendingDown, DollarSign, Package, ArrowLeft, Lightbulb, AlertCircle, CheckCircle2, Banknote, FileText } from 'lucide-react';
import { ResumenProducto } from '@/types';
import { fmt, exportarExcel, exportarPDF, exportarExcelSimple } from '@/utils/calculos';
import { Btn, Card, Stat, Badge, catColor, SectionHeader } from './UI';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string; caja_inicial?: number };
  resumen: ResumenProducto[];
  recargas: any[];
  cortesias: any[];
  perdidas: any[];
  descuentos: any[];
  gastos: any[];
  productos: any[];
  invInicial: Record<string, { cantidad: number; proveedor: string }>;
  dinero: { efectivo: number; datafono: number; nequi: number };
  log: any[];
  onNuevoEvento: () => void;
  onAtras: () => void;
}

export default function Reporte({ evento, resumen, recargas, cortesias, perdidas, descuentos, gastos, productos, invInicial, dinero, log, onNuevoEvento, onAtras }: Props) {
  const totalVentas = resumen.reduce((a, b) => a + b.ingresoEsperado, 0);
  const totalGastosEfectivo = gastos.filter(g => g.metodo === 'efectivo').reduce((a, b) => a + Number(b.monto), 0);
  const totalEsperado = totalVentas + (evento.caja_inicial || 0) - totalGastosEfectivo;
  const totalRecibido = dinero.efectivo + dinero.datafono + dinero.nequi;
  const diferencia = totalRecibido - totalEsperado;
  const totalCortesias = resumen.reduce((a, b) => a + b.costoCortesias, 0);
  const totalCostoVendido = resumen.reduce((a, b) => a + b.vendido * b.costo, 0);
  const utilidadBruta = totalVentas - totalCostoVendido;
  const ok = diferencia >= 0;

  const pName = (id: string) => productos.find(p => p.id === id)?.nombre || id;

  const doExport = () => exportarExcel(resumen, productos, evento.nombre, evento.fecha, dinero.efectivo, dinero.datafono, dinero.nequi, evento.caja_inicial || 0, deudas, log, gastos, recargas, cortesias, perdidas, descuentos);

  // Cálculo de Cuentas por Pagar por Proveedor (Consumo Real)
  const deudas: Record<string, number> = {};
  
  // 1. Sumar Entradas (Inicial + Recargas) y Restar Final
  resumen.forEach(p => {
    if (p.proveedor && p.proveedor !== '-') {
      // Deuda = (Consumo) * Costo
      // Consumo ya es (ini + rec - fin)
      const subtotal = p.consumo * p.costo;
      deudas[p.proveedor] = (deudas[p.proveedor] || 0) + subtotal;
    }
  });

  const totalDeuda = Object.values(deudas).reduce((a, b) => a + b, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-10">
        <Stat
          label="Ventas Brutas"
          value={fmt(totalVentas)}
          color="text-indigo-600"
          icon={<TrendingUp size={20} />}
        />
        <Stat
          label="Gastos en Caja"
          value={fmt(totalGastosEfectivo)}
          color="text-orange-500"
          icon={<DollarSign size={20} />}
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
              { label: 'Ventas Totales', val: totalVentas, color: 'text-slate-900' },
              { label: 'Gastos (Efectivo)', val: -totalGastosEfectivo, color: 'text-rose-500 font-bold' },
              { label: '------------------', val: 0, color: 'text-slate-200' },
              { label: 'TOTAL ESPERADO', val: totalEsperado, color: 'text-indigo-600 font-black' },
            ].filter(x => x.label !== '------------------' || totalGastosEfectivo > 0).map((d, i) => (
              <div key={i} className={`flex justify-between items-end ${d.label === '------------------' ? '' : 'border-b border-slate-50 pb-4'}`}>
                {d.label === '------------------' ? (
                  <div className="w-full border-t border-dashed border-slate-200 my-2" />
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.label}</p>
                    <p className={`text-xl font-bold ${d.color}`}>{fmt(d.val)}</p>
                  </>
                )}
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
                  {ok ? 'Físico en Caja' : 'Diferencia en Caja'}
                </p>
                <p className={`text-lg font-black mt-1 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmt(totalRecibido)}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                  {ok ? `Sobrante: ${fmt(diferencia)}` : `Faltante: ${fmt(Math.abs(diferencia))}`}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* DETALLE DE GASTOS (NUEVO) */}
        <Card className="p-8 lg:col-span-1 border-rose-100 bg-rose-50/10">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
            <Banknote size={20} className="text-rose-500" /> Salidas de Efectivo
          </h3>
          <div className="space-y-4 mb-8">
            {gastos.map((g, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{g.metodo.toUpperCase()} · {g.hora}</p>
                  <p className="font-bold text-slate-900">{g.concepto}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-rose-600">-{fmt(g.monto)}</p>
                </div>
              </div>
            ))}
            {gastos.length === 0 && (
              <p className="text-slate-400 text-sm italic text-center py-4">No se registraron gastos.</p>
            )}
          </div>

          <div className="pt-6 border-t border-rose-200 flex justify-between items-center">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-widest">Total Gastos</p>
            <p className="text-2xl font-black text-rose-700">-{fmt(gastos.reduce((a, b) => a + Number(b.monto), 0))}</p>
          </div>
        </Card>

        {/* CUENTAS POR PAGAR */}
        <Card className="p-8 lg:col-span-1 border-amber-100 bg-amber-50/10">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
            <Package size={20} className="text-amber-500" /> Cuentas por Pagar
          </h3>
          <div className="space-y-4 mb-8">
            {Object.entries(deudas).map(([proveedor, monto]) => (
              <div key={proveedor} className="p-4 rounded-2xl bg-white border border-amber-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Proveedor</p>
                  <p className="font-bold text-slate-900">{proveedor}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-600">{fmt(monto)}</p>
                </div>
              </div>
            ))}
            {Object.keys(deudas).length === 0 && (
              <p className="text-slate-400 text-sm italic text-center py-4">No hay deudas pendientes.</p>
            )}
          </div>

          <div className="pt-6 border-t border-amber-200 flex justify-between items-center">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Total a Liquidar</p>
            <p className="text-2xl font-black text-amber-700">{fmt(totalDeuda)}</p>
          </div>
        </Card>
      </div>

      <SectionHeader title="Auditoría de Movimientos" sub="Detalle granular de cada acción registrada durante el evento" icon={<Lightbulb size={20} />} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        {/* CORTESIAS */}
        <Card className="p-6 border-emerald-100 bg-emerald-50/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package size={18} className="text-emerald-500" /> Cortesías
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => exportarPDF('Reporte de Cortesías', ['HORA', 'PRODUCTO', 'CANT', 'PARA', 'MOTIVO'], cortesias.map(c => [c.hora, pName(c.producto_id), c.cantidad, c.persona, c.motivo]), 'Cortesias')}
                className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors" title="PDF"
              >
                <FileText size={14} />
              </button>
              <button 
                onClick={() => exportarExcelSimple('Reporte de Cortesías', ['HORA', 'PRODUCTO', 'CANT', 'PARA', 'MOTIVO'], cortesias.map(c => [c.hora, pName(c.producto_id), c.cantidad, c.persona, c.motivo]), 'Cortesias')}
                className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors" title="Excel"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {cortesias.map((c, i) => {
              const p = productos.find(x => x.id === c.producto_id);
              const costoTotal = (p?.costo || 0) * c.cantidad;
              return (
                <div key={i} className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{c.hora || '--:--'}</p>
                    <p className="text-[10px] font-bold text-slate-400">ID: {c.id?.slice(0,4)}</p>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{pName(c.producto_id)}</p>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                    <p className="text-xs text-slate-500">Cant: <span className="font-bold text-slate-900">{c.cantidad}</span></p>
                    <p className="text-xs font-bold text-slate-400 italic">costo: {fmt(costoTotal)}</p>
                  </div>
                  <p className="text-[10px] mt-2 text-slate-400 italic">Autorizado para: <span className="text-emerald-600 font-bold">{c.persona}</span></p>
                </div>
              );
            })}
            {cortesias.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sin registros de cortesía.</p>}
          </div>
        </Card>

        {/* PERDIDAS */}
        <Card className="p-6 border-rose-100 bg-rose-50/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500" /> Bajas / Pérdidas
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => exportarPDF('Reporte de Bajas y Pérdidas', ['HORA', 'PRODUCTO', 'CANT', 'MOTIVO'], perdidas.map(p => [p.hora, pName(p.producto_id), p.cantidad, p.motivo]), 'Bajas_Perdidas')}
                className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors" title="PDF"
              >
                <FileText size={14} />
              </button>
              <button 
                onClick={() => exportarExcelSimple('Reporte de Bajas y Pérdidas', ['HORA', 'PRODUCTO', 'CANT', 'MOTIVO'], perdidas.map(p => [p.hora, pName(p.producto_id), p.cantidad, p.motivo]), 'Bajas_Perdidas')}
                className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-700 transition-colors" title="Excel"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {perdidas.map((p, i) => {
              const prod = productos.find(x => x.id === p.producto_id);
              const costoTotal = (prod?.costo || 0) * p.cantidad;
              return (
                <div key={i} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{p.hora || '--:--'}</p>
                    <p className="text-xs font-bold text-rose-500">-{fmt(costoTotal)}</p>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{pName(p.producto_id)}</p>
                  <div className="mt-3 p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                    <p className="text-[10px] text-rose-800 font-bold uppercase tracking-widest mb-1">Motivo de la baja</p>
                    <p className="text-xs text-rose-900 italic font-medium">"{p.motivo}"</p>
                  </div>
                  <p className="text-[10px] mt-2 text-slate-400 text-right font-bold uppercase">Cant: {p.cantidad} unds</p>
                </div>
              );
            })}
            {perdidas.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sin registros de pérdidas.</p>}
          </div>
        </Card>

        {/* DESCUENTOS */}
        <Card className="p-6 border-indigo-100 bg-indigo-50/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown size={18} className="text-indigo-500" /> Descuentos
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => exportarPDF('Reporte de Descuentos', ['HORA', 'PRODUCTO', 'CANT', '%', 'MOTIVO'], descuentos.map(d => [d.hora, pName(d.producto_id), d.cantidad, d.porcentaje, d.motivo]), 'Descuentos')}
                className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors" title="PDF"
              >
                <FileText size={14} />
              </button>
              <button 
                onClick={() => exportarExcelSimple('Reporte de Descuentos', ['HORA', 'PRODUCTO', 'CANT', '%', 'MOTIVO'], descuentos.map(d => [d.hora, pName(d.producto_id), d.cantidad, d.porcentaje, d.motivo]), 'Descuentos')}
                className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-700 transition-colors" title="Excel"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {descuentos.map((d, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-indigo-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{d.hora || '--:--'}</p>
                  <Badge color="indigo">-{d.porcentaje}%</Badge>
                </div>
                <p className="font-bold text-slate-900 text-sm">{pName(d.producto_id)}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                  <p className="text-xs text-slate-500">Unidades: <span className="font-bold text-slate-900">{d.cantidad}</span></p>
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                </div>
              </div>
            ))}
            {descuentos.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sin descuentos aplicados.</p>}
          </div>
        </Card>

        {/* RECARGAS */}
        <Card className="p-6 border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw size={18} className="text-slate-500" /> Recargas
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => exportarPDF('Reporte de Recargas e Ingresos', ['HORA', 'PRODUCTO', 'CANT', 'PROVEEDOR'], recargas.map(r => [r.hora, pName(r.producto_id), r.cantidad, r.proveedor]), 'Recargas')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors" title="PDF"
              >
                <FileText size={14} />
              </button>
              <button 
                onClick={() => exportarExcelSimple('Reporte de Recargas e Ingresos', ['HORA', 'PRODUCTO', 'CANT', 'PROVEEDOR'], recargas.map(r => [r.hora, pName(r.producto_id), r.cantidad, r.proveedor]), 'Recargas')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors" title="Excel"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {recargas.map((r, i) => {
              const prod = productos.find(x => x.id === r.producto_id);
              const inversion = (prod?.costo || 0) * r.cantidad;
              return (
                <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.hora || '--:--'}</p>
                    <p className="text-xs font-bold text-slate-900">+{r.cantidad}</p>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{pName(r.producto_id)}</p>
                  <div className="mt-3 flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Proveedor</p>
                      <p className="text-xs text-slate-700 font-bold">{r.proveedor}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">Inv: {fmt(inversion)}</p>
                  </div>
                </div>
              );
            })}
            {recargas.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sin recargas de inventario.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Tabla Detallada */}
        <Card className="p-8 lg:col-span-3">
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
                  <th className="text-center py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-indigo-500">Desc.</th>
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
                    <td className="py-4 px-2 text-center font-bold text-indigo-500 bg-indigo-50/30">{p.desc || 0}</td>
                    <td className="py-4 px-2 text-center font-bold text-rose-500 bg-rose-50/30">{p.per}</td>
                    <td className="py-4 px-2 text-center font-black text-slate-900 bg-slate-50 group-hover:bg-indigo-50 transition-colors">{p.vendido}</td>
                    <td className="py-4 px-2 text-right font-black text-indigo-600 whitespace-nowrap">{fmt(p.ingresoEsperado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={6} className="py-4 px-4 font-bold text-right text-xs uppercase tracking-[0.2em] rounded-bl-3xl">Total Ingreso por Ventas</td>
                  <td className="py-4 px-4 font-black text-right text-lg rounded-br-3xl">{fmt(totalVentas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
