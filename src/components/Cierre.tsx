'use client';
import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { Producto } from '@/types';
import { Btn, Card, Field, inputCls, Badge, catColor, SectionHeader } from './UI';

interface Props {
  evento: { nombre: string; fecha: string; responsable: string };
  productos: Producto[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  recargas: { producto_id: string; cantidad: number }[];
  cortesias: { producto_id: string; cantidad: number }[];
  perdidas: { producto_id: string; cantidad: number }[];
  onFinalizar: (inventarioFinal: Record<string, number>, dinero: { efectivo: number; datafono: number; nequi: number }) => void;
  onAtras: () => void;
}

export default function Cierre({ evento, productos, inventarioInicial, recargas, cortesias, perdidas, onFinalizar, onAtras }: Props) {
  const [fin, setFin] = useState<Record<string, string>>({});
  const [dinero, setDinero] = useState({ efectivo: '', datafono: '', nequi: '' });

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
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SectionHeader
        step="03 CIERRE"
        title="Cierre de Caja y Cuadre"
        sub="Ingrese el conteo físico final y el total de dinero recaudado para generar el informe."
      />

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
