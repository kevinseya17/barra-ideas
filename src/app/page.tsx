'use client';
import React, { useState, useEffect } from 'react';
import { Producto, Recarga, Cortesia, Perdida, LogEntry, Evento, Gasto, Descuento } from '@/types';
import { uid, nowTime, calcularResumen } from '@/utils/calculos';
import * as api from '@/lib/api';
import { Moon, Sun, Settings, BarChart3, RefreshCw, AlertTriangle, PackageOpen } from 'lucide-react';
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
  isDark: true,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const stepIdx = STEPS.indexOf(state.step);

  // Monitor de Conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar estado guardado al iniciar
  useEffect(() => {
    const init = async () => {
      // 1. Intentar cargar de localStorage (rápido)
      const saved = loadState();
      if (saved.step !== 'apertura' || saved.evento) {
        setState(saved);
      }

      // 2. SIEMPRE verificar en la nube si hay un evento abierto (seguro)
      const evActivo = await api.getEventoActivo();
      if (evActivo) {
        // Si el evento en la nube es distinto al de local o no hay local, rehidratar
        if (!saved.evento || saved.evento.id !== evActivo.id) {
          rehydrateFromCloud(evActivo);
        }
      }
    };
    init();
  }, []);

  const rehydrateFromCloud = async (ev: Evento) => {
    const [prods, provs, data] = await Promise.all([
      api.getProductos(),
      api.getProveedores(),
      api.getEventoData(ev.id)
    ]);

    const invInicial: Record<string, { cantidad: number; proveedor: string }> = {};
    data.inventario.filter(i => i.tipo === 'inicial').forEach(i => {
      invInicial[i.producto_id] = { cantidad: i.cantidad, proveedor: i.proveedor || '' };
    });

    setState(s => ({
      ...s,
      step: 'operacion',
      evento: ev,
      productos: prods,
      proveedores: provs,
      inventarioInicial: invInicial,
      recargas: data.recargas,
      cortesias: data.cortesias,
      perdidas: data.perdidas,
      descuentos: data.descuentos,
      gastos: data.gastos,
      log: [{ id: uid(), time: nowTime(), msg: '🔄 Estado restaurado desde la nube', tipo: 'info' }, ...s.log]
    }));
  };

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
    const id = uid();
    const localRec = { ...r, id, evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `➕ Recarga: ${r.cantidad} unidades de ${pName(r.producto_id)} (Proveedor: ${r.proveedor || 'Sin especificar'})`, tipo: 'recarga', metadata: { ...localRec } };
    
    setState(s => ({ 
      ...s, 
      recargas: [localRec, ...s.recargas],
      log: [logEntry, ...s.log]
    }));
    
    setIsSyncing(true);
    await api.createRecarga(localRec);
    setIsSyncing(false);
  };

  const handleAddCortesia = async (c: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const id = uid();
    const localCor = { ...c, id, evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `🎁 Cortesía: ${c.cantidad} de ${pName(c.producto_id)} para ${c.persona}`, tipo: 'cortesia', metadata: { ...localCor } };
    
    setState(s => ({ 
      ...s, 
      cortesias: [localCor, ...s.cortesias],
      log: [logEntry, ...s.log]
    }));
    
    setIsSyncing(true);
    await api.createCortesia(localCor);
    setIsSyncing(false);
  };

  const handleAddPerdida = async (p: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const id = uid();
    const localPer = { ...p, id, evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `⚠️ Pérdida: ${p.cantidad} de ${pName(p.producto_id)} - ${p.motivo}`, tipo: 'perdida', metadata: { ...localPer } };
    
    setState(s => ({ 
      ...s, 
      perdidas: [localPer, ...s.perdidas],
      log: [logEntry, ...s.log]
    }));
    
    setIsSyncing(true);
    await api.createPerdida(localPer);
    setIsSyncing(false);
  };

  const handleAddDescuento = async (d: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const id = uid();
    const localDesc = { ...d, id, evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `🏷️ Descuento: ${d.cantidad} de ${pName(d.producto_id)} al ${d.porcentaje}% off`, tipo: 'descuento', metadata: { ...localDesc } };
    
    setState(s => ({ 
      ...s, 
      descuentos: [localDesc, ...s.descuentos],
      log: [logEntry, ...s.log]
    }));
    
    setIsSyncing(true);
    await api.createDescuento(localDesc);
    setIsSyncing(false);
  };

  const handleAddGasto = async (g: any) => {
    if (!state.evento) return;
    const time = nowTime();
    const id = uid();
    const localGasto = { ...g, id, evento_id: state.evento.id, hora: time };
    const logEntry: LogEntry = { id: uid(), time, msg: `💸 Gasto (${g.metodo}): $${g.monto.toLocaleString()} por ${g.concepto}`, tipo: 'gasto', metadata: { ...localGasto } };
    
    setState(s => ({ 
      ...s, 
      gastos: [localGasto, ...s.gastos],
      log: [logEntry, ...s.log]
    }));
    
    setIsSyncing(true);
    await api.createGasto(localGasto);
    setIsSyncing(false);
  };

  const handleUpdateLogEntry = async (logId: string, newData: any) => {
    const entry = state.log.find(l => l.id === logId);
    if (!entry || !entry.metadata?.id) return;

    const { id, tipo } = entry.metadata;
    const tableMap: Record<string, string> = {
      recarga: 'recargas',
      cortesia: 'cortesias',
      perdida: 'perdidas',
      descuento: 'descuentos',
      gasto: 'gastos'
    };

    const table = tableMap[entry.tipo];
    if (table) {
      await api.updateRecord(table, id, newData);
    }

    setState(s => {
      // 1. Actualizar el array específico (recargas, gastos, etc.)
      const updateArray = (arr: any[]) => arr.map(item => item.id === id ? { ...item, ...newData } : item);
      
      // 2. Re-generar el mensaje del log si es necesario
      const updatedLog = s.log.map(l => {
        if (l.id !== logId) return l;
        let newMsg = l.msg;
        if (l.tipo === 'recarga') newMsg = `➕ Recarga (Mod): ${newData.cantidad} unidades de ${pName(newData.producto_id)}`;
        if (l.tipo === 'gasto') newMsg = `💸 Gasto (Mod): $${Number(newData.monto).toLocaleString()} por ${newData.concepto}`;
        if (l.tipo === 'cortesia') newMsg = `🎁 Cortesía (Mod): ${newData.cantidad} de ${pName(newData.producto_id)} para ${newData.persona}`;
        if (l.tipo === 'descuento') newMsg = `🏷️ Descuento (Mod): ${newData.cantidad} de ${pName(newData.producto_id)} al ${newData.porcentaje}% off`;
        if (l.tipo === 'perdida') newMsg = `⚠️ Pérdida (Mod): ${newData.cantidad} de ${pName(newData.producto_id)}`;
        
        return { ...l, msg: newMsg, metadata: { ...l.metadata, ...newData } };
      });

      return {
        ...s,
        log: updatedLog,
        recargas: entry.tipo === 'recarga' ? updateArray(s.recargas) : s.recargas,
        cortesias: entry.tipo === 'cortesia' ? updateArray(s.cortesias) : s.cortesias,
        perdidas: entry.tipo === 'perdida' ? updateArray(s.perdidas) : s.perdidas,
        descuentos: entry.tipo === 'descuento' ? updateArray(s.descuentos) : s.descuentos,
        gastos: entry.tipo === 'gasto' ? updateArray(s.gastos) : s.gastos,
      };
    });
  };

  const handleRemoveLogEntry = async (logId: string) => {
    const entry = state.log.find(l => l.id === logId);
    if (!entry || !entry.metadata?.id) return;

    const { id, tipo } = entry.metadata;
    const tableMap: Record<string, string> = {
      recarga: 'recargas',
      cortesia: 'cortesias',
      perdida: 'perdidas',
      descuento: 'descuentos',
      gasto: 'gastos'
    };

    const table = tableMap[entry.tipo];
    if (table) {
      await api.deleteRecord(table, id);
    }

    setState(s => ({
      ...s,
      log: s.log.filter(l => l.id !== logId),
      recargas: s.recargas.filter(r => r.id !== id),
      cortesias: s.cortesias.filter(c => c.id !== id),
      perdidas: s.perdidas.filter(p => p.id !== id),
      descuentos: s.descuentos.filter(d => d.id !== id),
      gastos: s.gastos.filter(g => g.id !== id),
    }));
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

  const handleSiguienteNoche = () => {
    // Convertir inventarioFinal (Record<string, number>) al formato de inventarioInicial
    const nuevoInvInicial: Record<string, { cantidad: number; proveedor: string }> = {};
    Object.entries(state.inventarioFinal).forEach(([prodId, cantidad]) => {
      if (cantidad > 0) {
        const proveedorAnterior = state.inventarioInicial[prodId]?.proveedor || '';
        nuevoInvInicial[prodId] = { cantidad, proveedor: proveedorAnterior };
      }
    });

    localStorage.removeItem(STORAGE_KEY);
    setState({
      ...INIT,
      productos: state.productos,
      proveedores: state.proveedores,
      inventarioInicial: nuevoInvInicial,
      step: 'apertura',
    });
  };

  const toggleDark = () => setState(s => ({ ...s, isDark: !s.isDark }));

  return (
    <div className={`${state.isDark ? 'dark' : ''} antialiased transition-colors duration-500`}>
      <style>{`
        .dark .bg-white { background-color: rgba(255,255,255,0.03); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.05); }
        .dark .bg-slate-50 { background-color: #000000 !important; }
        .dark .bg-slate-100 { background-color: rgba(255,255,255,0.08) !important; }
        .dark .text-slate-950, .dark .text-slate-900 { color: #ffffff !important; }
        .dark .text-slate-800 { color: #f8fafc !important; }
        .dark .text-slate-700 { color: #f1f5f9 !important; }
        .dark .text-slate-600 { color: #e2e8f0 !important; }
        .dark .text-slate-500 { color: #e2e8f0 !important; }
        .dark .text-slate-400 { color: #cbd5e1 !important; }
        .dark .text-slate-300 { color: #94a3b8 !important; }
        .dark .border-slate-200 { border-color: rgba(255,255,255,0.1) !important; }
        .dark .border-slate-100 { border-color: rgba(255,255,255,0.05) !important; }
        .dark .border-slate-200\\/60 { border-color: rgba(255,255,255,0.05) !important; }
        
        /* Fix specialized colors in dark mode */
        .dark .text-amber-900 { color: #fef3c7 !important; }
        .dark .text-amber-800 { color: #fde68a !important; }
        .dark .text-amber-700 { color: #fcd34d !important; }
        .dark .bg-amber-50 { background-color: rgba(251, 191, 36, 0.15) !important; border-color: rgba(251, 191, 36, 0.2) !important; }
        .dark .bg-amber-100 { background-color: rgba(251, 191, 36, 0.2) !important; }
        .dark .text-amber-600 { color: #fbbf24 !important; }

        .dark .bg-cyan-50 { background-color: rgba(0, 210, 255, 0.15) !important; border-color: rgba(0, 210, 255, 0.2) !important; }
        .dark .bg-cyan-100 { background-color: rgba(0, 210, 255, 0.2) !important; }
        .dark .text-cyan-900 { color: #cffafe !important; }
        .dark .text-cyan-800 { color: #a5f3fc !important; }
        .dark .text-cyan-700 { color: #67e8f9 !important; }
        .dark .text-cyan-600 { color: #00d2ff !important; }

        .dark .text-indigo-600 { color: #00d2ff !important; }
        .dark .bg-indigo-50 { background-color: rgba(0, 210, 255, 0.1) !important; }

        .dark .text-rose-600 { color: #fb7185 !important; }
        .dark .bg-rose-50 { background-color: rgba(225, 29, 72, 0.1) !important; border-color: rgba(225, 29, 72, 0.2) !important; }
        
        .dark .text-orange-600 { color: #fb923c !important; }
        .dark .bg-orange-50 { background-color: rgba(234, 88, 12, 0.1) !important; border-color: rgba(234, 88, 12, 0.2) !important; }

        .dark .text-blue-600 { color: #60a5fa !important; }
        .dark .bg-blue-50 { background-color: rgba(37, 99, 235, 0.1) !important; border-color: rgba(37, 99, 235, 0.2) !important; }

        .dark .text-magenta-600, .dark .text-[#ff0099] { color: #ff4db8 !important; }
        .dark .bg-magenta-50 { background-color: rgba(255, 0, 153, 0.1) !important; border-color: rgba(255, 0, 153, 0.2) !important; }
        
        .dark input, .dark select { background-color: rgba(255,255,255,0.03) !important; color: #ffffff !important; border-color: rgba(255,255,255,0.15) !important; }
        .dark input:focus, .dark select:focus { border-color: #00d2ff !important; background-color: rgba(255,255,255,0.05) !important; }
        .dark input::placeholder { color: #9ca3af !important; }
        .dark .bg-slate-100\\/50 { background-color: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; }
        .dark .bg-indigo-600 { background: linear-gradient(to right, #00d2ff, #ff0099) !important; border: none !important; }
        .dark .shadow-sm { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3) !important; }
      `}</style>
      <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans transition-colors duration-500 text-slate-900 bg-grid">
        {/* Luces de fondo premium */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-cyan-500/20 blur-[140px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute top-[20%] right-0 w-[600px] h-[600px] bg-pink-500/15 blur-[120px] rounded-full -z-10 translate-x-1/4 animate-float" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[100px] rounded-full -z-10 translate-y-1/2" />

        <nav className={`${state.isDark ? 'bg-black/90 border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]' : 'bg-white/90 border-slate-200 shadow-sm'} backdrop-blur-xl border-b sticky top-0 z-40 transition-colors duration-500`}>
          <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl overflow-hidden bg-black border-2 ${state.isDark ? 'border-slate-700 shadow-[0_0_25px_rgba(0,210,255,0.4)]' : 'border-slate-200 shadow-md'} group hover:border-[#00d2ff] transition-all duration-500`}>
                  <img 
                    src="/logo.jpeg" 
                    alt="ideas+I Logo" 
                    className="w-full h-full object-cover transform group-hover:scale-125 transition-transform duration-700"
                  />
                </div>
                <div>
                  <span className={`text-2xl font-[1000] tracking-tighter block leading-none ${state.isDark ? 'text-white' : 'text-slate-900'}`}>
                    ideas<span className="text-[#ff0099]">+</span>I
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#00d2ff] shadow-[0_0_8px_#00d2ff]" />
                      <span className="w-2 h-2 rounded-full bg-[#ff0099] shadow-[0_0_8px_#ff0099] animate-pulse" />
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${state.isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Premium Management
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex border p-1.5 rounded-2xl gap-1 overflow-x-auto backdrop-blur-sm ${state.isDark ? 'bg-black/50 border-white/10' : 'bg-slate-100/80 border-slate-200'}`}>
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => i <= stepIdx && setState(st => ({ ...st, step: s }))}
                  disabled={i > stepIdx}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                    state.step === s 
                    ? (state.isDark ? 'bg-gradient-to-r from-[#00d2ff] to-[#ff0099] text-white shadow-[0_0_25px_rgba(0,210,255,0.4)] scale-110' : 'bg-gradient-to-r from-[#00d2ff] to-[#ff0099] text-white shadow-lg scale-105')
                    : i < stepIdx 
                      ? (state.isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-cyan-600 shadow-sm')
                      : (state.isDark ? 'text-white/30 cursor-not-allowed' : 'text-slate-400 cursor-not-allowed opacity-50')
                  }`}
                >
                  {STEP_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* GRUPO DE ESTADO */}
              <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all shadow-sm ${
                !isOnline ? (state.isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-500') :
                isSyncing ? (state.isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-500') :
                (state.isDark ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-600')
              }`}>
                {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : 
                 !isOnline ? <AlertTriangle size={14} /> : 
                 <div className={`w-1.5 h-1.5 rounded-full ${state.isDark ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-[#00d2ff] shadow-[0_0_8px_#00d2ff]'}`} />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {!isOnline ? 'Sin Conexión' : isSyncing ? 'Sincronizando' : 'Nube Segura'}
                </span>
              </div>

              {/* GRUPO DE ACCIONES */}
              <div className={`flex items-center gap-2 p-1 rounded-2xl border transition-all ${
                state.isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100/80 border-slate-200'
              }`}>
                <button 
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", `backup_barrapro_${state.evento?.nombre || 'evento'}_${new Date().toISOString().split('T')[0]}.json`);
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                  }} 
                  className={`p-2.5 rounded-xl transition-all hover:shadow-sm ${
                    state.isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'
                  }`}
                  title="Descargar copia de seguridad (Backup)"
                >
                  <PackageOpen size={18} />
                </button>

                <button 
                  onClick={() => setState(s => ({ ...s, step: 'admin' }))} 
                  className={`p-2.5 rounded-xl transition-all hover:shadow-sm ${
                    state.isDark ? 'text-white/70 hover:text-[#00d2ff] hover:bg-white/10' : 'text-slate-400 hover:text-[#00d2ff] hover:bg-white'
                  }`}
                  title="Configuración de Base de Datos"
                >
                  <Settings size={18} />
                </button>

                <button 
                  onClick={toggleDark} 
                  className={`p-2.5 rounded-xl transition-all hover:shadow-sm ${
                    state.isDark ? 'text-white/70 hover:text-[#ff0099] hover:bg-white/10' : 'text-slate-400 hover:text-[#ff0099] hover:bg-white'
                  }`}
                >
                  {state.isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>

              {state.evento && (
                <div className={`hidden lg:flex items-center gap-3 px-5 py-2.5 rounded-2xl border shadow-sm shrink-0 ml-2 ${
                  state.isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-[#ff0099] uppercase tracking-widest leading-none mb-1">Activo</span>
                    <span className={`text-xs font-black tracking-tight ${state.isDark ? 'text-white' : 'text-slate-900'}`}>{state.evento.nombre}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse shadow-[0_0_8px_#00d2ff]" />
                </div>
              )}
            </div>
          </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6">
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
              onRemoveLogEntry={handleRemoveLogEntry}
              onUpdateLogEntry={handleUpdateLogEntry}
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
              onSiguienteNoche={handleSiguienteNoche}
              onAtras={() => setState(s => ({ ...s, step: 'cierre' }))}
            />
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
