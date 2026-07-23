import React, { useMemo } from 'react';
import { Package, Calculator, TrendingUp, DollarSign, AlertCircle, ArrowDownCircle, ArrowUpCircle, Boxes, BarChart3, FileSpreadsheet } from 'lucide-react';
import { Producto, Descuento } from '@/types';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';
import { calcularResumen, fmt } from '@/utils/calculos';
import ExcelPreview from './ExcelPreview';

interface CierreDraft {
  fin: Record<string, string>;
  dinero: { efectivo: string; datafono: string; nequi: string };
}

interface BodegaMovimiento {
  producto_id: string;
  inicial: number;
  despachado: number;
  retornado: number;
  stockActual: number;
}

interface Props {
  evento: { nombre: string; fecha: string; responsable: string };
  productos: Producto[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  recargas: { producto_id: string; cantidad: number }[];
  cortesias: { producto_id: string; cantidad: number }[];
  perdidas: { producto_id: string; cantidad: number }[];
  descuentos: Descuento[];
  draft: CierreDraft;
  onDraftChange: (draft: CierreDraft) => void;
  onFinalizar: (inventarioFinal: Record<string, number>, dinero: { efectivo: number; datafono: number; nequi: number }, devolverABodega?: boolean) => void;
  onAtras: () => void;
  bodegaConectada?: boolean;
  // props nuevas para modo Bodega
  esBodega?: boolean;
  bodegaMovimientos?: BodegaMovimiento[];
  consolidadoBarras?: { nombre: string; ventas: number; caja: number; total: number }[];
}

export default function Cierre({
  evento, productos, inventarioInicial, recargas, cortesias, perdidas, descuentos,
  draft, onDraftChange, onFinalizar, onAtras, bodegaConectada,
  esBodega, bodegaMovimientos, consolidadoBarras
}: Props) {
  const [devolverABodega, setDevolverABodega] = React.useState(true);
  const [showExcelPreview, setShowExcelPreview] = React.useState(false);
  const fin = draft.fin;
  const dinero = draft.dinero;

  const setFin = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    onDraftChange({ ...draft, fin: updater(draft.fin) });
  };

  const setDinero = (updater: (prev: typeof draft.dinero) => typeof draft.dinero) => {
    onDraftChange({ ...draft, dinero: updater(draft.dinero) });
  };

  // CÁLCULO EN TIEMPO REAL
  const resumen = useMemo(() => {
    const invFinalTmp: Record<string, number> = {};
    productos.forEach(p => { invFinalTmp[p.id] = Number(fin[p.id] || 0); });
    return calcularResumen(productos, inventarioInicial, recargas, cortesias, perdidas, descuentos, invFinalTmp);
  }, [productos, inventarioInicial, recargas, cortesias, perdidas, descuentos, fin]);

  const esperadoVentas = resumen.reduce((a, b) => a + b.ingresoEsperado, 0);
  const totalRecaudado = Number(dinero.efectivo || 0) + Number(dinero.datafono || 0) + Number(dinero.nequi || 0);
  const diferencia = totalRecaudado - esperadoVentas;

  const disponible = (id: string) => {
    const ini = inventarioInicial[id]?.cantidad ?? 0;
    const rec = recargas.filter(r => r.producto_id === id).reduce((a, b) => a + Number(b.cantidad), 0);
    return ini + rec;
  };

  const guardar = () => {
    const inv = Object.fromEntries(productos.map(p => [p.id, Number(fin[p.id] || 0)]));
    onFinalizar(inv, {
      efectivo: Number(dinero.efectivo || 0),
      datafono: Number(dinero.datafono || 0),
      nequi: Number(dinero.nequi || 0),
    }, devolverABodega);
  };

  // ─── BODEGA: cálculos consolidados ────────────────────────────────────────
  const totalVentasConsolidadas = consolidadoBarras?.reduce((s, b) => s + b.ventas, 0) ?? 0;

  // Para el cierre de bodega: lo que se despachó = lo que las barras debieron vender + lo devuelto
  // Validación: Despachado = VentasBarras(en unidades) + Retornado + ConteoFísicoBodega
  const bodegaValidacion = useMemo(() => {
    if (!esBodega || !bodegaMovimientos) return null;
    return bodegaMovimientos.map(m => {
      const conteoFisico = Number(fin[m.producto_id] || 0);
      const diferencia = m.stockActual - conteoFisico; // > 0: faltan; < 0: sobran
      return { ...m, conteoFisico, diferencia };
    });
  }, [esBodega, bodegaMovimientos, fin]);

  const bodegaCuadra = bodegaValidacion?.every(v => Math.abs(v.diferencia) === 0) ?? false;

  // ─── RENDER MODO BODEGA ───────────────────────────────────────────────────
  if (esBodega) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <SectionHeader
          step="03 CIERRE BODEGA"
          title="Liquidación y Cuadre de Bodega Central"
          sub="Registra el conteo físico final de bodega y valida que las barras cuadren."
        />

        {/* ── CONSOLIDADO DE BARRAS ── */}
        {consolidadoBarras && consolidadoBarras.length > 0 && (
          <Card className="p-6 mb-8 border-l-4 border-l-[#ff0099] bg-gradient-to-br from-[#ff0099]/5 to-transparent">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#ff0099]/10 flex items-center justify-center text-[#ff0099]">
                <BarChart3 size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Ventas Consolidadas del Evento</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Suma de todas las barras · Solo barras cerradas muestran recaudo real</p>
              </div>
            </div>

            {/* Tabla detallada por barra */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3 text-left">Barra</th>
                    <th className="px-3 py-3 text-right">Ventas Est.</th>
                    <th className="px-3 py-3 text-right text-emerald-600">Efectivo</th>
                    <th className="px-3 py-3 text-right text-blue-600">Datáfono</th>
                    <th className="px-3 py-3 text-right text-violet-600">Nequi</th>
                    <th className="px-3 py-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {consolidadoBarras.map((b, i) => {
                    const bc = b as any;
                    const tieneDinero = bc.cerrada && (bc.efectivo > 0 || bc.datafono > 0 || bc.nequi > 0);
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800 text-xs uppercase tracking-tight">{b.nombre}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600 text-xs">{fmt(b.ventas)}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-700 text-xs">{tieneDinero ? fmt(bc.efectivo) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-600 text-xs">{tieneDinero ? fmt(bc.datafono) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-violet-600 text-xs">{tieneDinero ? fmt(bc.nequi) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            bc.cerrada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {bc.cerrada ? '✓ Cerrada' : '⏳ Abierta'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-[#ff0099]/10 to-[#00d2ff]/10 border-t-2 border-slate-200">
                    <td className="px-4 py-3 font-black text-slate-900 uppercase tracking-widest text-xs">TOTAL</td>
                    <td className="px-3 py-3 text-right font-black text-emerald-600">{fmt(totalVentasConsolidadas)}</td>
                    <td className="px-3 py-3 text-right font-black text-emerald-700">{fmt(consolidadoBarras.reduce((s, b) => s + ((b as any).efectivo ?? 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-black text-blue-600">{fmt(consolidadoBarras.reduce((s, b) => s + ((b as any).datafono ?? 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-black text-violet-600">{fmt(consolidadoBarras.reduce((s, b) => s + ((b as any).nequi ?? 0), 0))}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-[10px] font-black text-[#ff0099]">
                        Total: {fmt(consolidadoBarras.reduce((s, b) => s + ((b as any).efectivo ?? 0) + ((b as any).datafono ?? 0) + ((b as any).nequi ?? 0), 0))}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* ── LA CÁMARA: MOVIMIENTOS DE BODEGA ── */}
        {bodegaMovimientos && bodegaMovimientos.length > 0 && (
          <Card className="p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                <Boxes size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">La Cámara · Movimientos de Bodega</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inicial → Despachado → Retornado → Stock esperado</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {bodegaMovimientos.map(m => {
                const prod = productos.find(p => p.id === m.producto_id);
                const nombre = prod?.nombre || m.producto_id;
                const cat = prod?.categoria || 'otro';
                return (
                  <div key={m.producto_id} className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-cyan-200 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{nombre}</p>
                      <Badge color={catColor[cat]} className="mt-1">{cat}</Badge>
                    </div>
                    {/* Inicial */}
                    <div className="text-center min-w-[56px]">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Inicial</p>
                      <p className="text-base font-black text-slate-700">{m.inicial}</p>
                    </div>
                    {/* Flecha despacho */}
                    <div className="text-center min-w-[56px]">
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Despacho</p>
                      <div className="flex items-center justify-center gap-1">
                        <ArrowDownCircle size={13} className="text-rose-400" />
                        <p className="text-base font-black text-rose-500">-{m.despachado}</p>
                      </div>
                    </div>
                    {/* Flecha retorno */}
                    <div className="text-center min-w-[56px]">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Retorno</p>
                      <div className="flex items-center justify-center gap-1">
                        <ArrowUpCircle size={13} className="text-emerald-500" />
                        <p className="text-base font-black text-emerald-600">+{m.retornado}</p>
                      </div>
                    </div>
                    {/* Stock actual esperado */}
                    <div className="text-center min-w-[64px] px-3 py-2 rounded-xl bg-cyan-50 border border-cyan-100">
                      <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-0.5">Esperado</p>
                      <p className="text-base font-black text-cyan-700">{m.stockActual}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />Inicial = cantidad con la que abriste bodega</span>
              <span className="flex items-center gap-1.5"><ArrowDownCircle size={12} className="text-rose-400" />Despacho = lo que salió a las barras</span>
              <span className="flex items-center gap-1.5"><ArrowUpCircle size={12} className="text-emerald-500" />Retorno = lo que las barras devolvieron</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />Esperado = lo que debe haber físicamente</span>
            </div>
          </Card>
        )}

        {/* ── CONTEO FÍSICO FINAL DE BODEGA ── */}
        <Card className="p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Package size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Conteo Físico Final · Bodega</h2>
          </div>

          {bodegaValidacion && bodegaValidacion.length > 0 ? (
            <div className="space-y-3">
              {bodegaValidacion.map(v => {
                const prod = productos.find(p => p.id === v.producto_id);
                const nombre = prod?.nombre || v.producto_id;
                const dif = v.diferencia;
                const cuadra = dif === 0;
                return (
                  <div key={v.producto_id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${cuadra ? 'bg-emerald-50/40 border-emerald-100' : 'bg-rose-50/40 border-rose-100'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{nombre}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Esperado en bodega: <span className="text-cyan-600">{v.stockActual}</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conteo Real</p>
                      <input
                        type="number"
                        className={`${inputCls} w-28 text-center text-lg font-bold py-2 focus:border-[#00d2ff]`}
                        placeholder={String(v.stockActual)}
                        value={fin[v.producto_id] ?? ''}
                        onChange={e => setFin(f => ({ ...f, [v.producto_id]: e.target.value }))}
                      />
                    </div>
                    {fin[v.producto_id] !== undefined && fin[v.producto_id] !== '' && (
                      <div className={`min-w-[64px] text-center px-3 py-2 rounded-xl ${cuadra ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest">Diff</p>
                        <p className="font-black text-sm">{dif > 0 ? `-${dif}` : dif < 0 ? `+${Math.abs(dif)}` : '✓'}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Fallback: lista de productos si no hay bodegaMovimientos (bodega sin datos de traslados)
            <div className="space-y-3">
              {productos.map(p => (
                <div key={p.id} className="flex items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-cyan-200 transition-all group">
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-cyan-600 transition-colors">{p.nombre}</p>
                    <Badge color={catColor[p.categoria]} className="mt-1">{p.categoria}</Badge>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conteo Final</p>
                    <input
                      type="number"
                      className={`${inputCls} w-32 text-center text-lg font-bold py-2 focus:border-[#00d2ff]`}
                      placeholder="0"
                      value={fin[p.id] ?? ''}
                      onChange={e => setFin(f => ({ ...f, [p.id]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── ESTADO DEL CUADRE ── */}
        {bodegaValidacion && bodegaValidacion.some(v => fin[v.producto_id] !== undefined && fin[v.producto_id] !== '') && (
          <Card className={`p-6 mb-8 border-l-4 flex items-center gap-5 ${bodegaCuadra ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-rose-500 bg-rose-50/30'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${bodegaCuadra ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {bodegaCuadra ? '✅' : '⚠️'}
            </div>
            <div>
              <h3 className={`font-black text-sm uppercase tracking-widest ${bodegaCuadra ? 'text-emerald-700' : 'text-rose-700'}`}>
                {bodegaCuadra ? '¡Bodega Cuadrada! Todo coincide.' : 'Hay diferencias en el conteo físico.'}
              </h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${bodegaCuadra ? 'text-emerald-500' : 'text-rose-400'}`}>
                {bodegaCuadra
                  ? 'El conteo físico coincide exactamente con los movimientos registrados.'
                  : 'Revisa el conteo o anota las diferencias antes de finalizar.'}
              </p>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between mt-10">
          <button onClick={onAtras} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center gap-2">
            ← Regresar a Operación
          </button>
          <Btn variant="brand" size="lg" onClick={guardar} className="shadow-xl shadow-pink-100">
            Finalizar Evento Completo →
          </Btn>
        </div>
      </div>
    );
  }

  // ─── RENDER MODO BARRA (comportamiento original) ─────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <SectionHeader
          step="03 CIERRE"
          title="Cierre de Caja y Cuadre"
          sub="Ingrese el conteo físico final y el total de dinero recaudado para generar el informe."
        />
        <button
          onClick={() => setShowExcelPreview(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-200 hover:shadow-lg transition-all active:scale-95 shrink-0"
        >
          <FileSpreadsheet size={16} />
          <span>📊 Vista Previa Excel</span>
        </button>
      </div>

      {/* Panel de Status en Tiempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 border-l-4 border-l-cyan-500 bg-cyan-50/30">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={16} className="text-cyan-600" />
            <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">Ventas Esperadas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{fmt(esperadoVentas)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Calculado según inventario</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-indigo-500 bg-indigo-50/30">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={16} className="text-indigo-600" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Dinero en Caja</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{fmt(totalRecaudado)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Total ingresado abajo</p>
        </Card>

        <Card className={`p-5 border-l-4 transition-colors ${Math.abs(diferencia) < 100 ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-rose-500 bg-rose-50/30'}`}>
          <div className="flex items-center gap-3 mb-2">
            {Math.abs(diferencia) < 100 ? <Calculator size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <span className={`text-[10px] font-black uppercase tracking-widest ${Math.abs(diferencia) < 100 ? 'text-emerald-600' : 'text-rose-600'}`}>Diferencia (Cuadre)</span>
          </div>
          <p className={`text-2xl font-black ${Math.abs(diferencia) < 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {diferencia > 0 ? '+' : ''}{fmt(diferencia)}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${Math.abs(diferencia) < 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Math.abs(diferencia) < 100 ? '✨ ¡Caja Cuadrada!' : '⚠️ Revisa el inventario'}
          </p>
        </Card>
      </div>

      {/* Inventario final */}
      <Card className="p-8 mb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <Package size={20} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Conteo Físico de Inventario</h2>
        </div>

        <div className="space-y-4">
          {productos.map(p => {
            const disp = disponible(p.id);
            // Cálculo en tiempo real del valor vendido (descontando cortesías, pérdidas y descuentos)
            const finVal = fin[p.id] !== undefined && fin[p.id] !== '' ? Number(fin[p.id]) : null;
            const consumoUnd = finVal !== null ? Math.max(0, disp - finVal) : null;

            // Unidades que NO generan ingreso
            const corUnd = cortesias.filter(c => c.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
            const perUnd = perdidas.filter(d => d.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
            const descUnd = descuentos.filter(d => d.producto_id === p.id).reduce((a, b) => a + Number(b.cantidad), 0);
            const descValor = descuentos.filter(d => d.producto_id === p.id).reduce((a, b) => a + Number((b as any).valor_descontado || 0), 0);

            const vendidoUnd = consumoUnd !== null ? Math.max(0, consumoUnd - corUnd - perUnd) : null;
            const vendidoValor = vendidoUnd !== null
              ? Math.max(0, (vendidoUnd * p.precio) - descValor)
              : null;
            return (
              <div key={p.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-cyan-200 transition-all group">
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-cyan-600 transition-colors">{p.nombre}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge color={catColor[p.categoria]}>{p.categoria}</Badge>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                        Sistema: <span className="text-cyan-500">{disp}</span> {p.unidad}s
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Conteo Final</p>
                    <input
                      type="number"
                      className={`${inputCls} w-36 text-center text-lg font-bold py-2 focus:border-[#00d2ff]`}
                      placeholder="0"
                      value={fin[p.id] ?? ''}
                      onChange={e => setFin(f => ({ ...f, [p.id]: e.target.value }))}
                    />
                  </div>
                </div>
                {/* Cálculo en tiempo real: vendiste X → $Y */}
                {vendidoUnd !== null && (
                  <div className={`mt-3 pt-3 border-t border-slate-200 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      ({disp} en sistema - {finVal} final)
                    </p>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${vendidoUnd >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendiste ~</span>
                      <span className={`font-black text-sm ${vendidoUnd >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {vendidoUnd >= 0 ? vendidoUnd : `⚠️ ${Math.abs(vendidoUnd)}`} {p.unidad}s
                      </span>
                      {vendidoValor !== null && vendidoUnd > 0 && (
                        <>
                          <span className="text-slate-300">→</span>
                          <span className="font-black text-sm text-emerald-600">{fmt(vendidoValor)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Dinero */}
      <Card className="p-8 mb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
            <span className="text-lg font-bold">$</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Recaudo de Caja</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <Field label="Total Efectivo">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input type="number" className={`${inputCls} pl-8`} value={dinero.efectivo} onChange={e => setDinero(d => ({ ...d, efectivo: e.target.value }))} placeholder="0" />
            </div>
          </Field>
          <Field label="Total Datáfono">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input type="number" className={`${inputCls} pl-8`} value={dinero.datafono} onChange={e => setDinero(d => ({ ...d, datafono: e.target.value }))} placeholder="0" />
            </div>
          </Field>
          <Field label="Nequi / Transferencia">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input type="number" className={`${inputCls} pl-8`} value={dinero.nequi} onChange={e => setDinero(d => ({ ...d, nequi: e.target.value }))} placeholder="0" />
            </div>
          </Field>
        </div>
      </Card>

      {/* Opción de Bodega */}
      {bodegaConectada && (
        <Card className="p-6 mb-8 bg-cyan-50/50 border border-cyan-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-md">
              <Package size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Retorno de Inventario</h4>
              <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest mt-1">Los sobrantes volverán automáticamente a la Bodega Central</p>
            </div>
          </div>
          <button
            onClick={() => setDevolverABodega(!devolverABodega)}
            className={`w-14 h-8 rounded-full transition-all relative ${devolverABodega ? 'bg-[#00d2ff]' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${devolverABodega ? 'left-7' : 'left-1 shadow-sm'}`} />
          </button>
        </Card>
      )}

      <div className="flex items-center justify-between mt-10">
        <button onClick={onAtras} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center gap-2">
          ← Regresar a Operación
        </button>
        <Btn variant="brand" size="lg" onClick={guardar} className="shadow-xl shadow-cyan-100">
          Finalizar y Generar Reporte →
        </Btn>
      </div>

      {showExcelPreview && (
        <ExcelPreview
          evento={evento}
          productos={productos}
          inventarioInicial={inventarioInicial}
          recargas={recargas}
          cortesias={cortesias}
          perdidas={perdidas}
          descuentos={descuentos}
          finCount={Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, Number(v || 0)]))}
          dinero={{
            efectivo: Number(dinero.efectivo || 0),
            datafono: Number(dinero.datafono || 0),
            nequi: Number(dinero.nequi || 0),
          }}
          onClose={() => setShowExcelPreview(false)}
        />
      )}
    </div>
  );
}
