import React, { useMemo } from 'react';
import { Package, Calculator, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { Producto, Descuento } from '@/types';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';
import { calcularResumen, fmt } from '@/utils/calculos';

interface CierreDraft {
  fin: Record<string, string>;
  dinero: { efectivo: string; datafono: string; nequi: string };
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
}

export default function Cierre({ evento, productos, inventarioInicial, recargas, cortesias, perdidas, descuentos, draft, onDraftChange, onFinalizar, onAtras, bodegaConectada }: Props) {
  const [devolverABodega, setDevolverABodega] = React.useState(true);
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
    productos.forEach(p => {
      invFinalTmp[p.id] = Number(fin[p.id] || 0);
    });
    return calcularResumen(
      productos,
      inventarioInicial,
      recargas,
      cortesias,
      perdidas,
      descuentos,
      invFinalTmp
    );
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SectionHeader
        step="03 CIERRE"
        title="Cierre de Caja y Cuadre"
        sub="Ingrese el conteo físico final y el total de dinero recaudado para generar el informe."
      />

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
            return (
              <div key={p.id} className="flex items-center gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-cyan-200 transition-all group">
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
    </div>
  );
}
