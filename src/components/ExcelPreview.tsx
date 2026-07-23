'use client';
import React, { useState } from 'react';
import { Producto } from '@/types';
import { fmt, getBaseEventName } from '@/utils/calculos';
import { Table, FileSpreadsheet, X, Layers, User, Package, Download } from 'lucide-react';
import { Btn, Badge } from './UI';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string; caja_inicial?: number };
  productos: Producto[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  recargas: any[];
  cortesias: any[];
  perdidas: any[];
  descuentos: any[];
  finCount?: Record<string, number>;
  dinero?: { efectivo: number; datafono: number; nequi: number };
  gastos?: any[];
  globalData?: any;
  onClose: () => void;
}

export default function ExcelPreview({
  evento, productos, inventarioInicial, recargas, cortesias, perdidas, descuentos, finCount = {}, dinero, gastos = [], globalData, onClose
}: Props) {
  const isBodega = evento.nombre.startsWith('BODEGA -');
  const baseName = getBaseEventName(evento.nombre);

  // Lista de hojas a mostrar en el simulador de Excel
  const barrasRelacionadas = globalData?.relatedEvents?.filter((e: any) => !e.nombre.startsWith('BODEGA -')) || [];
  
  const tabsDisponibles = [
    { id: 'bodega', label: isBodega ? 'BODEGA PRINCIPAL' : `HOJA BARRA (${evento.responsable.toUpperCase()})` },
    ...(isBodega ? barrasRelacionadas.map((b: any) => ({ id: `bar_${b.id}`, label: `BARRA ${b.nombre.split(' - ').pop()}` })) : []),
    { id: 'cortesias', label: 'CORTESÍAS DETALLE' },
  ];

  const [activeSheet, setActiveSheet] = useState(tabsDisponibles[0].id);

  // Categorías de productos
  // Orden igual al Excel PICANTE
  const ORDEN_PICANTE: Record<string, number> = { gaseosa: 1, agua: 2, cerveza: 3, otro: 4, licor: 5, snack: 6 };
  const categorias = Array.from(new Set(productos.map(p => p.categoria)))
    .sort((a, b) => (ORDEN_PICANTE[a] ?? 99) - (ORDEN_PICANTE[b] ?? 99));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-[2.5rem] border border-emerald-500/30 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* HEADER ESTILO EXCEL */}
        <div className="bg-emerald-900/90 border-b border-emerald-700/50 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300 text-[9px] font-black uppercase tracking-widest border border-emerald-400/30">VISTA PREVIA EN VIVO</span>
                <span className="text-[10px] text-slate-300 font-bold">· Modelo PICANTE</span>
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">
                Libro Excel — {evento.nombre}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 text-slate-300 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 border border-transparent transition-all flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* CINTA DE OPCIONES / FORMULAS (ESTILO EXCEL) */}
        <div className="bg-slate-800 border-b border-slate-700/60 px-6 py-2 flex items-center gap-4 text-xs shrink-0 text-slate-300">
          <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-700 text-emerald-400 font-bold text-[11px]">fx = INICIAL + RECARGAS - CORTESÍAS - BAJAS - FINAL</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">· Actualización automática en tiempo real</span>
        </div>

        {/* CUERPO DE LA HOJA DE CÁLCULO */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-6 scrollbar-thin scrollbar-thumb-slate-700">
          {activeSheet === 'bodega' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                <span>Hoja: {isBodega ? 'BODEGA PRINCIPAL (Consolidado General)' : `BARRA - ${evento.nombre}`}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400">Pestaña Activa</span>
              </div>

              {/* GRID SIMULADOR DE EXCEL */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700">
                      <th className="p-3 border-r border-slate-700/60 text-center w-12 text-slate-500">#</th>
                      <th className="p-3 border-r border-slate-700/60">PRODUCTO</th>
                      <th className="p-3 border-r border-slate-700/60 text-right">PRECIO</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-slate-800/80">INICIAL</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-indigo-950/40 text-indigo-300">RECARGAS</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-amber-950/40 text-amber-300">CORTESÍAS</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-rose-950/40 text-rose-300">BAJAS</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-cyan-950/40 text-cyan-300">FINAL</th>
                      <th className="p-3 border-r border-slate-700/60 text-center bg-emerald-950/60 text-emerald-300">VENDIDO (UND)</th>
                      <th className="p-3 text-right bg-emerald-950/80 text-emerald-400">VENTA TOTAL ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {categorias.map(cat => {
                      const prods = productos.filter(p => p.categoria === cat);
                      return (
                        <React.Fragment key={cat}>
                          <tr className="bg-slate-800/40 font-black text-[10px] text-slate-400 uppercase tracking-widest">
                            <td colSpan={10} className="px-4 py-2 bg-slate-850/60 border-y border-slate-800 text-emerald-400">
                              ▶ CATEGORÍA: {cat}
                            </td>
                          </tr>
                          {prods.map((p, idx) => {
                            const ini = Number(inventarioInicial[p.id]?.cantidad || 0);
                            const rec = recargas.filter(r => r.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
                            const cor = cortesias.filter(c => c.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
                            const per = perdidas.filter(l => l.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
                            const fin = finCount[p.id] !== undefined ? Number(finCount[p.id]) : Math.max(0, ini + rec - cor - per);
                            const consumo = Math.max(0, ini + rec - fin);
                            const vendidoUnd = Math.max(0, consumo - cor - per);
                            const ventaTotal = vendidoUnd * p.precio;

                            return (
                              <tr key={p.id} className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-3 text-center border-r border-slate-800 text-[10px] font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-3 border-r border-slate-800 font-bold text-slate-100">{p.nombre}</td>
                                <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(p.precio)}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-bold text-slate-300">{ini}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-400">{rec > 0 ? `+${rec}` : '0'}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{cor > 0 ? cor : '0'}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-bold text-rose-400">{per > 0 ? per : '0'}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-bold text-cyan-400">{fin}</td>
                                <td className="p-3 border-r border-slate-800 text-center font-black text-emerald-400 bg-emerald-950/20">{vendidoUnd}</td>
                                <td className="p-3 text-right font-black text-emerald-400 bg-emerald-950/30">{fmt(ventaTotal)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSheet.startsWith('bar_') && globalData && (
            <div className="space-y-4">
              {(() => {
                const bId = activeSheet.replace('bar_', '');
                const bEv = globalData.relatedEvents.find((e: any) => e.id === bId);
                if (!bEv) return null;

                return (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
                    <div className="p-4 bg-slate-800/80 border-b border-slate-700 text-emerald-400 font-bold text-xs">
                      Simulación Excel: Pestaña "BARRA {bEv.nombre.split(' - ').pop()}"
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700">
                          <th className="p-3 border-r border-slate-700">PRODUCTO</th>
                          <th className="p-3 border-r border-slate-700 text-right">PRECIO</th>
                          <th className="p-3 border-r border-slate-700 text-center">INICIAL</th>
                          <th className="p-3 border-r border-slate-700 text-center text-indigo-400">RECARGAS</th>
                          <th className="p-3 border-r border-slate-700 text-center text-amber-400">CORTESÍAS</th>
                          <th className="p-3 border-r border-slate-700 text-center text-rose-400">BAJAS</th>
                          <th className="p-3 border-r border-slate-700 text-center text-cyan-400">FINAL</th>
                          <th className="p-3 border-r border-slate-700 text-center text-emerald-400">VENDIDO (UND)</th>
                          <th className="p-3 text-right text-emerald-400">VENTA TOTAL ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {productos.map(p => {
                          const bIni = globalData.inventario.filter((i: any) => i.evento_id === bEv.id && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                          const bRec = globalData.recargas.filter((r: any) => r.evento_id === bEv.id && r.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                          const bCor = globalData.cortesias.filter((c: any) => c.evento_id === bEv.id && c.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                          // Solo pérdidas reales de esa barra (excluye traslados a otras barras/bodega y clonaciones)
                          const bPer = globalData.perdidas.filter((l: any) =>
                            l.evento_id === bEv.id &&
                            l.producto_id === p.id &&
                            !l.motivo?.startsWith('Traslado enviado') &&
                            !l.motivo?.startsWith('Traslado a ') &&
                            !l.motivo?.startsWith('Devolución Bodega') &&
                            !l.motivo?.startsWith('Clonación')
                          ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                          const bFin = globalData.inventario.filter((i: any) => i.evento_id === bEv.id && i.producto_id === p.id && i.tipo === 'final').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                          const consumo = Math.max(0, bIni + bRec - bFin);
                          const vendidoUnd = Math.max(0, consumo - bCor - bPer);
                          const ventaVal = vendidoUnd * p.precio;

                          if (bIni + bRec === 0 && bFin === 0) return null;

                          return (
                            <tr key={p.id} className="hover:bg-slate-800/60">
                              <td className="p-3 border-r border-slate-800 font-bold">{p.nombre}</td>
                              <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(p.precio)}</td>
                              <td className="p-3 border-r border-slate-800 text-center">{bIni}</td>
                              <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-400">{bRec}</td>
                              <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{bCor}</td>
                              <td className="p-3 border-r border-slate-800 text-center font-bold text-rose-400">{bPer}</td>
                              <td className="p-3 border-r border-slate-800 text-center font-bold text-cyan-400">{bFin}</td>
                              <td className="p-3 border-r border-slate-800 text-center font-black text-emerald-400">{vendidoUnd}</td>
                              <td className="p-3 text-right font-black text-emerald-400">{fmt(ventaVal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {activeSheet === 'cortesias' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
              <div className="p-4 bg-amber-950/40 border-b border-amber-800/40 text-amber-300 font-bold text-xs flex items-center justify-between">
                <span>Pestaña Cortesías Detalladas</span>
                <span className="text-[10px] text-slate-400 font-mono">Total {cortesias.length} registros</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-[10px] font-black text-amber-400 uppercase tracking-widest border-b border-slate-700">
                    <th className="p-3 border-r border-slate-700 text-center w-24">HORA</th>
                    <th className="p-3 border-r border-slate-700">PRODUCTO</th>
                    <th className="p-3 border-r border-slate-700 text-center">CANT</th>
                    <th className="p-3 border-r border-slate-700 text-right">VALOR UNIT ($)</th>
                    <th className="p-3 border-r border-slate-700 text-right">VALOR TOTAL ($)</th>
                    <th className="p-3 border-r border-slate-700 text-emerald-400 font-black">PARA (OBLIGATORIO)</th>
                    <th className="p-3">MOTIVO / NOTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {cortesias.map((c, idx) => {
                    const prod = productos.find(p => p.id === c.producto_id);
                    const precio = prod?.precio || 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/60">
                        <td className="p-3 border-r border-slate-800 text-center font-mono text-slate-400 text-[11px]">{c.hora || '--:--'}</td>
                        <td className="p-3 border-r border-slate-800 font-bold text-slate-100">{prod?.nombre || c.producto_id}</td>
                        <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{c.cantidad}</td>
                        <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(precio)}</td>
                        <td className="p-3 border-r border-slate-800 text-right font-black text-amber-400">{fmt(c.cantidad * precio)}</td>
                        <td className="p-3 border-r border-slate-800 font-bold text-emerald-300 bg-emerald-950/20">{c.persona}</td>
                        <td className="p-3 italic text-slate-400">{c.motivo || '-'}</td>
                      </tr>
                    );
                  })}
                  {cortesias.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">No hay cortesías registradas en este evento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PESTAÑAS HOJAS DE EXCEL (TABS INFERIORES SIMULADOR) */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-3 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2 shrink-0">Pestañas Excel:</span>
          {tabsDisponibles.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveSheet(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeSheet === t.id
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750 hover:text-slate-200'
              }`}
            >
              <Table size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
