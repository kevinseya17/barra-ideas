'use client';
import React, { useState, useEffect } from 'react';
import { Producto, Recarga, Cortesia, Perdida, LogEntry, Evento, Gasto, Descuento } from '@/types';
import { uid, nowTime, calcularResumen } from '@/utils/calculos';
import * as api from '@/lib/api';
import { Moon, Sun, Settings } from 'lucide-react';
import Apertura from '@/components/Apertura';
import Operacion from '@/components/Operacion';
import Cierre from '@/components/Cierre';
import Reporte from '@/components/Reporte';
import AdminPanel from '@/components/AdminPanel';

type Step = 'apertura' | 'operacion' | 'cierre' | 'reporte' | 'admin';
const STEPS: Step[] = ['apertura', 'operacion', 'cierre', 'reporte'];
const STEP_LABELS: Record<Step, string> = {
  apertura: '01 Apertura', operacion: '02 Operación', cierre: '03 Cierre', reporte: '04 Reporte', admin: '05 Admin'
};

interface AppState {
  step: Step;
  evento: Omit<Evento, 'created_at'> | null;
  productos: Producto[];
  proveedores: string[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  recargas: Recarga[];
  cortesias: Cortesia[];
  perdidas: Perdida[];
  descuentos: Descuento[];
  gastos: Gasto[];
  inventarioFinal: Record<string, number>;
  dinero: { efectivo: number; datafono: number; nequi: number };
  log: LogEntry[];
  isDark: boolean;
}

const INIT: AppState = {
  step: 'apertura',
  evento: null,
  productos: [],
  proveedores: [],
  inventarioInicial: {},
  recargas: [],
  cortesias: [],
  perdidas: [],
  descuentos: [],
  gastos: [],
  inventarioFinal: {}, 
  dinero: { efectivo: 0, datafono: 0, nequi: 0 }, 
  log: [],
  isDark: false,
};

const STORAGE_KEY = 'barrapro_state_v2';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INIT;
    return { ...INIT, ...JSON.parse(raw) };
  } catch {
    return INIT;
  }
}

export default function BarraProApp() {
  const [state, setState] = useState<AppState>(INIT);
  const stepIdx = STEPS.indexOf(state.step);

  // Cargar estado guardado al iniciar
  useEffect(() => {
    const saved = loadState();
    if (saved.step !== 'apertura' || saved.evento) {
      setState(saved);
    }
  }, []);

  // Guardar estado en localStorage cada vez que cambia
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const addLog = (msg: string, tipo: LogEntry['tipo'], metadata?: any) =>
    setState(s => ({ ...s, log: [{ id: uid(), time: nowTime(), msg, tipo, metadata }, ...s.log] }));

  const pName = (id: string) => state.productos.find(p => p.id === id)?.nombre || id;

  const handleApertura = async (
    eventoInfo: { nombre: string; fecha: string; responsable: string; caja_inicial: number },
    productos: Producto[],
    proveedores: string[],
    invInicial: Record<string, { cantidad: number; proveedor: string }>
  ) => {
    const ev = await api.createEvento(eventoInfo);
    if (!ev) return alert('Error al conectar con la base de datos Supabase');
    setState(s => ({ ...s, evento: ev, productos, proveedores, inventarioInicial: invInicial, step: 'operacion' }));
    addLog(`✅ Evento "${ev.nombre}" abierto`, 'info');
  };

  const handleSaveInicial = (inv: Record<string, { cantidad: number; proveedor: string }>) => {
    setState(s => ({ ...s, inventarioInicial: inv }));
    addLog('📦 Inventario inicial registrado', 'info', inv);
    if (state.evento) {
      const items = Object.entries(inv).map(([producto_id, data]) => ({
        evento_id: state.evento!.id,
        producto_id,
        tipo: 'inicial' as const,
        cantidad: data.cantidad,
        proveedor: data.proveedor
      }));
      api.saveInventarioBatch(items);
    }
  };

  const handleAddRecarga = async (r: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const localRec = { ...r, id: uid(), evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `➕ Recarga: ${r.cantidad} unidades de ${pName(r.producto_id)} (Proveedor: ${r.proveedor || 'Sin especificar'})`, tipo: 'recarga', metadata: { ...r, hora: time } };
    
    setState(s => ({ 
      ...s, 
      recargas: [localRec, ...s.recargas],
      log: [logEntry, ...s.log]
    }));
    
    api.createRecarga(localRec);
  };

  const handleAddCortesia = async (c: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const localCor = { ...c, id: uid(), evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `🎁 Cortesía: ${c.cantidad} de ${pName(c.producto_id)} para ${c.persona}`, tipo: 'cortesia', metadata: { ...c, hora: time } };
    
    setState(s => ({ 
      ...s, 
      cortesias: [localCor, ...s.cortesias],
      log: [logEntry, ...s.log]
    }));
    
    api.createCortesia(localCor);
  };

  const handleAddPerdida = async (p: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const localPer = { ...p, id: uid(), evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `⚠️ Pérdida: ${p.cantidad} de ${pName(p.producto_id)} - ${p.motivo}`, tipo: 'perdida', metadata: { ...p, hora: time } };
    
    setState(s => ({ 
      ...s, 
      perdidas: [localPer, ...s.perdidas],
      log: [logEntry, ...s.log]
    }));
    
    api.createPerdida(localPer);
  };

  const handleAddDescuento = async (d: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const localDesc = { ...d, id: uid(), evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `🏷️ Descuento: ${d.cantidad} de ${pName(d.producto_id)} al ${d.porcentaje}% off`, tipo: 'descuento', metadata: { ...d, hora: time } };
    
    setState(s => ({ 
      ...s, 
      descuentos: [localDesc, ...s.descuentos],
      log: [logEntry, ...s.log]
    }));
    
    api.createDescuento(localDesc);
  };

  const handleAddGasto = async (g: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const localGasto = { ...g, id: uid(), evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `💸 Gasto (${g.metodo}): $${g.monto.toLocaleString()} por ${g.concepto}`, tipo: 'gasto', metadata: { ...g, hora: time } };
    
    setState(s => ({ 
      ...s, 
      gastos: [localGasto, ...s.gastos],
      log: [logEntry, ...s.log]
    }));
    
    api.createGasto(localGasto);
  };

  const handleCierre = async (
    inventarioFinal: Record<string, number>,
    dinero: { efectivo: number; datafono: number; nequi: number }
  ) => {
    if (!state.evento) return;
    setState(s => ({ ...s, inventarioFinal, dinero, step: 'reporte' }));
    addLog('🔒 Cierre registrado. Generando reporte…', 'cierre');
    
    const items = Object.entries(inventarioFinal).map(([prodId, cant]) => ({
      evento_id: state.evento!.id,
      producto_id: prodId,
      tipo: 'final' as const,
      cantidad: cant
    }));
    await api.saveInventarioBatch(items);
    await api.createCierreDinero({ ...dinero, evento_id: state.evento.id });
    await api.closeEvento(state.evento.id);
  };

  const resumen = calcularResumen(
    state.productos,
    state.inventarioInicial,
    state.recargas,
    state.cortesias,
    state.perdidas,
    state.descuentos,
    state.inventarioFinal
  );

  // Calcular deudas por proveedor (inventario inicial + recargas agrupados por proveedor)
  const deudas: Record<string, number> = {};
  // Desde inventario inicial
  Object.entries(state.inventarioInicial).forEach(([prodId, data]) => {
    const prod = state.productos.find(p => p.id === prodId);
    if (!prod || !data.proveedor || !data.cantidad) return;
    deudas[data.proveedor] = (deudas[data.proveedor] || 0) + data.cantidad * prod.costo;
  });
  // Desde recargas
  state.recargas.forEach(r => {
    const prod = state.productos.find(p => p.id === r.producto_id);
    if (!prod || !r.proveedor) return;
    deudas[r.proveedor] = (deudas[r.proveedor] || 0) + r.cantidad * prod.costo;
  });

  const toggleDark = () => setState(s => ({ ...s, isDark: !s.isDark }));

  return (
    <div className={`${state.isDark ? 'dark' : ''} antialiased transition-colors duration-500`}>
      <style>{`
        .dark .bg-white { background-color: #1e293b !important; }
        .dark .bg-slate-50 { background-color: #0f172a !important; }
        .dark .text-slate-900 { color: #f8fafc !important; }
        .dark .text-slate-600 { color: #cbd5e1 !important; }
        .dark .text-slate-500 { color: #94a3b8 !important; }
        .dark .text-slate-400 { color: #64748b !important; }
        .dark .border-slate-200 { border-color: #334155 !important; }
        .dark .border-slate-100 { border-color: #1e293b !important; }
        .dark .border-slate-200\\/60 { border-color: #334155 !important; }
        .dark input { background-color: #0f172a !important; color: #f8fafc !important; border-color: #334155 !important; }
        .dark input::placeholder { color: #475569 !important; }
        .dark .bg-slate-100\\/50 { background-color: #1e293b !important; border-color: #334155 !important; }
      `}</style>
      <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans transition-colors duration-500 text-slate-900">
        {/* Luces de fondo premium */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-100/30 blur-[140px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-200/40 blur-[120px] rounded-full -z-10 translate-x-1/4 -translate-y-1/4" />

        <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 shrink-0">
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight block leading-none">BarraPRO</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise Event Management</p>
                </div>
              </div>
            </div>

            <div className="flex bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl gap-1 overflow-x-auto">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => i <= stepIdx && setState(st => ({ ...st, step: s }))}
                  disabled={i > stepIdx}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    state.step === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-500/20'
                    : i < stepIdx ? 'text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm'
                    : 'text-slate-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  {STEP_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setState(s => ({ ...s, step: 'admin' }))} 
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm"
              >
                <Settings size={14} /> Base de Datos
              </button>
              <button onClick={toggleDark} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                {state.isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {state.evento && (
                <div className="hidden lg:flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-[0.15em] leading-none mb-1">Evento Activo</span>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">{state.evento.nombre}</span>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {state.step === 'apertura' && <Apertura onContinuar={handleApertura} eventoInicial={state.evento} productosIniciales={state.productos.length > 0 ? state.productos : undefined} proveedoresIniciales={state.proveedores.length > 0 ? state.proveedores : undefined} invInicial={state.inventarioInicial} onAdmin={() => setState(s => ({ ...s, step: 'admin' }))} />}
          {state.step === 'admin' && (
            <AdminPanel onAtras={() => setState(s => ({ ...s, step: 'apertura' }))} />
          )}
          {state.step === 'operacion' && state.evento && (
            <Operacion
              evento={state.evento} productos={state.productos}
              proveedores={state.proveedores}
              inventarioInicial={state.inventarioInicial}
              recargas={state.recargas} cortesias={state.cortesias}
              perdidas={state.perdidas} 
              descuentos={state.descuentos}
              gastos={state.gastos}
              log={state.log}
              onSaveInicial={handleSaveInicial}
              onAddRecarga={handleAddRecarga} onAddCortesia={handleAddCortesia}
              onAddPerdida={handleAddPerdida}
              onAddDescuento={handleAddDescuento}
              onAddGasto={handleAddGasto}
              onCierre={() => setState(s => ({ ...s, step: 'cierre' }))}
              onAtras={() => setState(s => ({ ...s, step: 'apertura' }))}
            />
          )}
          {state.step === 'cierre' && state.evento && (
            <Cierre
              evento={state.evento} productos={state.productos}
              inventarioInicial={state.inventarioInicial} recargas={state.recargas}
              cortesias={state.cortesias} perdidas={state.perdidas}
              onFinalizar={handleCierre}
              onAtras={() => setState(s => ({ ...s, step: 'operacion' }))}
            />
          )}
          {state.step === 'reporte' && state.evento && (
            <Reporte 
              evento={state.evento} 
              resumen={resumen} 
              productos={state.productos}
              recargas={state.recargas}
              cortesias={state.cortesias}
              perdidas={state.perdidas}
              descuentos={state.descuentos}
              gastos={state.gastos}
              invInicial={state.inventarioInicial}
              dinero={state.dinero} 
              log={state.log}
              onNuevoEvento={() => { localStorage.removeItem(STORAGE_KEY); setState(INIT); }} 
              onAtras={() => setState(s => ({ ...s, step: 'cierre' }))}
            />
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
