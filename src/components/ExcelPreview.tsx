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
                <span>Hoja: {isBodega ? 'BODEGA PRINCIPAL (Consolidado General de Evento)' : `BARRA - ${evento.nombre}`}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400">Pestaña Activa</span>
              </div>

              {isBodega ? (() => {
                const barrasIds: string[] = globalData?.relatedEvents
                  ?.filter((e: any) => !e.nombre.startsWith('BODEGA -'))
                  .map((e: any) => e.id) || [];

                let grandTotalVenta = 0;
                let grandTotalComision = 0;
                let grandTotalCosto = 0;

                const bodegaRows = categorias.map(cat => {
                  const catProds = productos.filter(p => p.categoria === cat);
                  const rows = catProds.map(p => {
                    const inicial_total = globalData?.inventario
                      ?.filter((i: any) => i.producto_id === p.id && i.tipo === 'inicial' && i.proveedor !== 'BODEGA CENTRAL' && !i.proveedor?.startsWith('Traslado desde'))
                      .reduce((a: number, b: any) => a + Number(b.cantidad), 0) || 0;

                    const recargas_total = globalData?.recargas
                      ?.filter((r: any) => r.producto_id === p.id && !r.proveedor?.startsWith('RETORNO:') && !r.proveedor?.startsWith('Devolución') && !r.proveedor?.startsWith('Traslado desde') && r.proveedor !== 'BODEGA CENTRAL')
                      .reduce((a: number, b: any) => a + Number(b.cantidad), 0) || 0;

                    const cortesias_total = globalData?.cortesias
                      ?.filter((c: any) => c.producto_id === p.id)
                      .reduce((a: number, b: any) => a + Number(b.cantidad), 0) || 0;

                    const bajas_total = globalData?.perdidas
                      ?.filter((l: any) => l.producto_id === p.id && !l.motivo?.startsWith('Traslado enviado') && !l.motivo?.startsWith('Traslado a ') && !l.motivo?.startsWith('Devolución Bodega') && !l.motivo?.startsWith('Clonación'))
                      .reduce((a: number, b: any) => a + Number(b.cantidad), 0) || 0;

                    const final_total = globalData?.inventario
                      ?.filter((i: any) => i.producto_id === p.id && i.tipo === 'final')
                      .reduce((a: number, b: any) => a + Number(b.cantidad), 0) || 0;

                    const consumo_sys = Math.max(0, inicial_total + recargas_total - final_total);
                    const vendido = Math.max(0, consumo_sys - cortesias_total - bajas_total);
                    const ventaTotal = vendido * p.precio;
                    const comisionUnit = p.comision || 0;
                    const totalComision = vendido * comisionUnit;
                    const totalProducto = vendido + cortesias_total;
                    const costoProducto = totalProducto * (p.costo || 0);
                    grandTotalVenta += ventaTotal;
                    grandTotalComision += totalComision;
                    grandTotalCosto += costoProducto;
                    return { p, inicial_total, recargas_total, cortesias_total, bajas_total, final_total, vendido, ventaTotal, comisionUnit, totalComision, totalProducto, costoProducto };
                  });
                  return { cat, rows };
                });

                const efectivo_total = (globalData?.dineros || []).reduce((a: number, b: any) => a + Number(b.efectivo || 0), 0);
                const datafono_total = (globalData?.dineros || []).reduce((a: number, b: any) => a + Number(b.datafono || 0), 0);
                const nequi_total    = (globalData?.dineros || []).reduce((a: number, b: any) => a + Number(b.nequi    || 0), 0);
                const gastos_total = (globalData?.gastos || []).reduce((a: number, b: any) => a + Number(b.monto), 0);
                const propinas_total = globalData?.propinas || 0;
                const utilidad = grandTotalVenta - grandTotalCosto - grandTotalComision - gastos_total;

                return (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700">
                            <th className="p-3 border-r border-slate-700/60">Producto</th>
                            <th className="p-3 border-r border-slate-700/60">Presentacion</th>
                            <th className="p-3 border-r border-slate-700/60 text-right">Valor</th>
                            <th className="p-3 border-r border-slate-700/60 text-center">Inicial</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-indigo-300">Recargas</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-amber-300">Cortesias</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-rose-300">Bajas</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-cyan-300">Final</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-emerald-300">Venta total (UND)</th>
                            <th className="p-3 border-r border-slate-700/60 text-right text-emerald-400 font-black">Venta total ($)</th>
                            <th className="p-3 border-r border-slate-700/60 text-right text-amber-300">COMISION</th>
                            <th className="p-3 border-r border-slate-700/60 text-right text-amber-400">TOTAL COMISION</th>
                            <th className="p-3 border-r border-slate-700/60 text-center text-indigo-300">TOTAL PRODUCTO</th>
                            <th className="p-3 text-right text-violet-300">COSTO PRODUCTO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-200">
                          {bodegaRows.map(({ cat, rows }) => (
                            <React.Fragment key={cat}>
                              <tr className="bg-slate-800/70">
                                <td colSpan={14} className="px-4 py-2 font-black text-[10px] text-slate-300 uppercase tracking-widest border-y border-slate-700">{cat.toUpperCase()}</td>
                              </tr>
                              {rows.map(({ p, inicial_total, recargas_total, cortesias_total, bajas_total, final_total, vendido, ventaTotal, comisionUnit, totalComision, totalProducto, costoProducto }) => (
                                <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                                  <td className="p-3 border-r border-slate-800 font-bold text-slate-100">{p.nombre}</td>
                                  <td className="p-3 border-r border-slate-800 text-slate-400">{(p as any).presentacion || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(p.precio)}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-slate-300">{inicial_total || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-400">{recargas_total || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{cortesias_total || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-rose-400">{bajas_total || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-cyan-400">{final_total}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-black text-emerald-400 bg-emerald-950/20">{vendido}</td>
                                  <td className="p-3 border-r border-slate-800 text-right font-black text-emerald-400 bg-emerald-950/30">{fmt(ventaTotal)}</td>
                                  <td className="p-3 border-r border-slate-800 text-right font-mono text-amber-300">{comisionUnit ? fmt(comisionUnit) : ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-right font-mono text-amber-400">{totalComision ? fmt(totalComision) : ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-300 bg-indigo-950/20">{totalProducto}</td>
                                  <td className="p-3 text-right font-mono text-violet-300 bg-violet-950/20">{costoProducto ? fmt(costoProducto) : ''}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                          <tr className="bg-emerald-900/40 border-t-2 border-emerald-600/40">
                            <td colSpan={9} className="p-3 text-right font-black text-emerald-300 uppercase tracking-widest text-[10px]">TOTAL</td>
                            <td className="p-3 text-right font-black text-emerald-400 bg-emerald-950/50">{fmt(grandTotalVenta)}</td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right font-black text-amber-400">{grandTotalComision ? fmt(grandTotalComision) : ''}</td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right font-black text-violet-300">{grandTotalCosto ? fmt(grandTotalCosto) : ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 overflow-hidden">
                        <div className="px-4 py-2 bg-amber-900/40 text-amber-300 text-[10px] font-black uppercase tracking-widest">FALTANTE POR PAGAR</div>
                        <div className="divide-y divide-slate-800/60">
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">COMISIONES</span><span className="text-amber-400 font-black">{fmt(grandTotalComision)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">PROPINAS</span><span className="text-amber-400 font-black">{fmt(propinas_total)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs bg-amber-900/30"><span className="text-amber-300 font-black uppercase">TOTAL</span><span className="text-amber-300 font-black">{fmt(grandTotalComision + propinas_total)}</span></div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 overflow-hidden">
                        <div className="px-4 py-2 bg-emerald-900/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest">RECAUDADO</div>
                        <div className="divide-y divide-slate-800/60">
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">EFECTIVO</span><span className="text-slate-200 font-black">{fmt(efectivo_total)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">DATÁFONO</span><span className="text-slate-200 font-black">{fmt(datafono_total)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">NEQUI / QR</span><span className="text-violet-300 font-black">{fmt(nequi_total)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs"><span className="text-slate-400 font-bold">GASTOS</span><span className="text-rose-400 font-black">-{fmt(gastos_total)}</span></div>
                          <div className="flex justify-between px-4 py-2 text-xs bg-slate-800/40"><span className="text-slate-300 font-black uppercase">TOTAL</span><span className="text-slate-200 font-black">{fmt(efectivo_total + datafono_total + nequi_total - gastos_total)}</span></div>
                          <div className="flex justify-between px-4 py-3 bg-emerald-900/40">
                            <span className="text-emerald-300 font-black uppercase text-sm">UTILIDAD</span>
                            <span className={`font-black text-sm ${utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(utilidad)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                /* BARRA INDIVIDUAL (cuando la bodega muestra su pestaña como barra) */
                <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700">
                        <th className="p-3 border-r border-slate-700/60 text-center w-12 text-slate-500">#</th>
                        <th className="p-3 border-r border-slate-700/60 font-bold">Producto</th>
                        <th className="p-3 border-r border-slate-700/60 text-right font-bold">Valor</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold">Inicial</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold text-indigo-300">Recarga</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold text-amber-300">Cortesia</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold text-rose-300">Bajas</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold text-cyan-300">Final</th>
                        <th className="p-3 border-r border-slate-700/60 text-center font-bold text-emerald-300">Venta</th>
                        <th className="p-3 text-right font-bold text-emerald-400">Venta total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                      {categorias.map(cat => {
                        const prods = productos.filter(p => p.categoria === cat);
                        return (
                          <React.Fragment key={cat}>
                            <tr className="bg-slate-800/40"><td colSpan={10} className="px-4 py-2 border-y border-slate-800 text-emerald-400 font-black text-[10px] uppercase">▶ {cat.toUpperCase()}</td></tr>
                            {prods.map((p, idx) => {
                              const ini = Number(inventarioInicial[p.id]?.cantidad || 0);
                              const rec = recargas.filter(r => r.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
                              const cor = cortesias.filter(c => c.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
                              const per = perdidas.filter(l => l.producto_id === p.id && !l.motivo?.startsWith('Traslado enviado') && !l.motivo?.startsWith('Traslado a ') && !l.motivo?.startsWith('Devolución Bodega') && !l.motivo?.startsWith('Clonación')).reduce((a, b) => a + Number(b.cantidad), 0);
                              const fin = finCount[p.id] !== undefined ? Number(finCount[p.id]) : Math.max(0, ini + rec - cor - per);
                              const vendidoUnd = Math.max(0, ini + rec - fin - cor - per);
                              const ventaTotal = vendidoUnd * p.precio;
                              return (
                                <tr key={p.id} className="hover:bg-slate-800/60 transition-colors">
                                  <td className="p-3 text-center border-r border-slate-800 text-[10px] text-slate-600">{idx + 1}</td>
                                  <td className="p-3 border-r border-slate-800 font-bold text-slate-100">{p.nombre}</td>
                                  <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(p.precio)}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-slate-300">{ini || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-400">{rec || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{cor || ''}</td>
                                  <td className="p-3 border-r border-slate-800 text-center font-bold text-rose-400">{per || ''}</td>
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
              )}
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
                          <th className="p-3 border-r border-slate-700 font-bold">Producto</th>
                          <th className="p-3 border-r border-slate-700 text-right font-bold">Valor</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold">Inicial</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold text-indigo-400">Recarga</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold text-amber-400">Cortesia</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold text-rose-400">Bajas</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold text-cyan-400">Final</th>
                          <th className="p-3 border-r border-slate-700 text-center font-bold text-emerald-400">Venta</th>
                          <th className="p-3 text-right font-bold text-emerald-400">Venta total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {categorias.map(cat => {
                          const prodsCat = productos.filter(p => p.categoria === cat);
                          return (
                            <React.Fragment key={cat}>
                              <tr className="bg-slate-800/60 font-black text-[10px] text-slate-300 uppercase tracking-widest">
                                <td colSpan={9} className="px-4 py-2 bg-slate-800 border-y border-slate-700 text-emerald-400">
                                  {cat.toUpperCase()}
                                </td>
                              </tr>
                              {prodsCat.map(p => {
                                const bIni = globalData.inventario.filter((i: any) => i.evento_id === bEv.id && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                                const bRec = globalData.recargas.filter((r: any) => r.evento_id === bEv.id && r.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
                                const bCor = globalData.cortesias.filter((c: any) => c.evento_id === bEv.id && c.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
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

                                return (
                                  <tr key={p.id} className="hover:bg-slate-800/60">
                                    <td className="p-3 border-r border-slate-800 font-bold">{p.nombre}</td>
                                    <td className="p-3 border-r border-slate-800 text-right font-mono text-slate-400">{fmt(p.precio)}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-bold">{bIni || ''}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-bold text-indigo-400">{bRec || ''}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-bold text-amber-400">{bCor || ''}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-bold text-rose-400">{bPer || ''}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-bold text-cyan-400">{bFin}</td>
                                    <td className="p-3 border-r border-slate-800 text-center font-black text-emerald-400">{vendidoUnd}</td>
                                    <td className="p-3 text-right font-black text-emerald-400">{fmt(ventaVal)}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
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
