'use client';
import React, { useState, useEffect } from 'react';
import {
  History, ArrowLeft, Eye, RotateCcw, Calendar, User,
  DollarSign, PackageCheck, Loader2, ChevronRight, Clock,
  TrendingUp, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { Evento, Producto, Recarga, Cortesia, Perdida, Descuento, Gasto, CierreDinero } from '@/types';
import * as api from '@/lib/api';
import { calcularResumen } from '@/utils/calculos';
import Reporte from './Reporte';
import { Badge, Card } from './UI';

interface EventoConResumen extends Evento {
  cierre?: CierreDinero | null;
  totalIngresos?: number;
}

interface HistorialProps {
  onAtras: () => void;
  onRetomarEvento: (ev: Evento) => void;
  isDark: boolean;
}

interface EventoDetalle {
  evento: Evento;
  productos: Producto[];
  recargas: Recarga[];
  cortesias: Cortesia[];
  perdidas: Perdida[];
  descuentos: Descuento[];
  gastos: Gasto[];
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }>;
  inventarioFinal: Record<string, number>;
  dinero: { efectivo: number; datafono: number; nequi: number };
}

export default function Historial({ onAtras, onRetomarEvento, isDark }: HistorialProps) {
  const [eventos, setEventos] = useState<EventoConResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<EventoDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConsolidated, setIsConsolidated] = useState(false);

  const cargarEventos = async () => {
    setLoading(true);
    const evs = await api.getEventos();
    const prods = await api.getProductos();

    // Enriquecer con datos del cierre
    const enriquecidos = await Promise.all(evs.map(async (ev) => {
      const cierre = await api.getCierreDinero(ev.id);
      const totalIngresos = cierre ? cierre.efectivo + cierre.datafono + cierre.nequi : undefined;
      return { ...ev, cierre, totalIngresos };
    }));

    setEventos(enriquecidos);
    setLoading(false);
  };

  useEffect(() => { cargarEventos(); }, []);

  const verDetalle = async (ev: Evento) => {
    setLoadingDetalle(ev.id);
    const [data, prods] = await Promise.all([
      api.getEventoData(ev.id),
      api.getProductos(),
    ]);
    const cierre = await api.getCierreDinero(ev.id);

    const invInicial: Record<string, { cantidad: number; proveedor: string }> = {};
    data.inventario.filter(i => i.tipo === 'inicial').forEach(i => {
      invInicial[i.producto_id] = { cantidad: i.cantidad, proveedor: i.proveedor || '' };
    });

    const invFinal: Record<string, number> = {};
    data.inventario.filter(i => i.tipo === 'final').forEach(i => {
      invFinal[i.producto_id] = i.cantidad;
    });

    setDetalle({
      evento: ev,
      productos: prods,
      recargas: data.recargas,
      cortesias: data.cortesias,
      perdidas: data.perdidas,
      descuentos: data.descuentos,
      gastos: data.gastos,
      inventarioInicial: invInicial,
      inventarioFinal: invFinal,
      dinero: {
        efectivo: cierre?.efectivo ?? 0,
        datafono: cierre?.datafono ?? 0,
        nequi: cierre?.nequi ?? 0,
      },
    });
    setLoadingDetalle(null);
  };

  const consolidarSeleccionados = async () => {
    if (selectedIds.length < 2) return;
    setLoadingDetalle('consolidating');
    
    try {
      const allData = await Promise.all(selectedIds.map(api.getEventoData));
      const prods = await api.getProductos();
      const todosCierres = await Promise.all(selectedIds.map(api.getCierreDinero));

      // Objeto base para consolidar
      const consolidado: EventoDetalle = {
        evento: { 
          id: 'consolidado', 
          nombre: `CONSOLIDADO (${selectedIds.length} BARRAS)`, 
          fecha: 'Varios', 
          responsable: 'Admin', 
          caja_inicial: 0, 
          estado: 'cerrado' 
        },
        productos: prods,
        recargas: [],
        cortesias: [],
        perdidas: [],
        descuentos: [],
        gastos: [],
        inventarioInicial: {},
        inventarioFinal: {},
        dinero: { efectivo: 0, datafono: 0, nequi: 0 }
      };

      allData.forEach((data, idx) => {
        consolidado.recargas.push(...data.recargas);
        consolidado.cortesias.push(...data.cortesias);
        consolidado.perdidas.push(...data.perdidas);
        consolidado.descuentos.push(...data.descuentos);
        consolidado.gastos.push(...data.gastos);
        
        // Sumar Inventarios
        data.inventario.forEach(item => {
          if (item.tipo === 'inicial') {
            const current = consolidado.inventarioInicial[item.producto_id] || { cantidad: 0, proveedor: item.proveedor || '' };
            consolidado.inventarioInicial[item.producto_id] = { 
              cantidad: current.cantidad + item.cantidad, 
              proveedor: current.proveedor 
            };
          } else {
            const current = consolidado.inventarioFinal[item.producto_id] || 0;
            consolidado.inventarioFinal[item.producto_id] = current + item.cantidad;
          }
        });

        // Sumar Dinero
        const cierre = todosCierres[idx];
        if (cierre) {
          consolidado.dinero.efectivo += cierre.efectivo;
          consolidado.dinero.datafono += cierre.datafono;
          consolidado.dinero.nequi += cierre.nequi;
        }
      });

      setDetalle(consolidado);
      setIsConsolidated(true);
    } catch (err) {
      console.error(err);
      alert("Error al consolidar reportes");
    } finally {
      setLoadingDetalle(null);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Si hay un detalle activo, mostrar el Reporte de ese evento
  if (detalle) {
    const resumen = calcularResumen(
      detalle.productos,
      detalle.inventarioInicial,
      detalle.recargas,
      detalle.cortesias,
      detalle.perdidas,
      detalle.descuentos,
      detalle.inventarioFinal,
    );
    return (
      <div>
        <button
          onClick={() => setDetalle(null)}
          className={`mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <ArrowLeft size={14} /> Volver al Historial
        </button>
        <Reporte
          evento={detalle.evento}
          resumen={resumen}
          productos={detalle.productos}
          recargas={detalle.recargas}
          cortesias={detalle.cortesias}
          perdidas={detalle.perdidas}
          descuentos={detalle.descuentos}
          gastos={detalle.gastos}
          invInicial={detalle.inventarioInicial}
          dinero={detalle.dinero}
          log={[]}
          onNuevoEvento={() => setDetalle(null)}
          onSiguienteNoche={() => setDetalle(null)}
          onAtras={() => { setDetalle(null); setIsConsolidated(false); }}
          soloLectura
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onAtras}
            className={`p-3 rounded-full shadow-sm transition-all ${
              isDark
                ? 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                : 'bg-white text-slate-500 hover:text-slate-900 hover:shadow'
            }`}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={`text-2xl font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <History className="text-[#00d2ff]" /> Historial de Eventos
            </h1>
            <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Todos los eventos registrados en la nube
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 1 && (
            <button
              onClick={consolidarSeleccionados}
              disabled={loadingDetalle === 'consolidating'}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00d2ff] to-[#ff0099] text-white rounded-xl text-xs font-[1000] uppercase tracking-widest shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all"
            >
              {loadingDetalle === 'consolidating' ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
              Consolidar {selectedIds.length} Barras
            </button>
          )}
          <button
            onClick={cargarEventos}
            className={`p-3 rounded-xl transition-colors ${
              isDark ? 'text-[#00d2ff] hover:bg-white/10' : 'text-[#00d2ff] bg-white shadow-sm hover:bg-cyan-50'
            }`}
            title="Recargar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`flex flex-col items-center justify-center py-24 gap-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Loader2 size={32} className="animate-spin text-[#00d2ff]" />
          <p className="text-sm font-bold uppercase tracking-widest">Cargando historial...</p>
        </div>
      ) : eventos.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-24 gap-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <History size={48} className="opacity-30" />
          <p className="text-sm font-bold uppercase tracking-widest">No hay eventos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map(ev => {
            const isOpen = ev.estado === 'abierto';
            const isLoading = loadingDetalle === ev.id;
            const fecha = new Date(ev.created_at || '');
            const fechaStr = isNaN(fecha.getTime()) ? ev.fecha : fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
            const horaStr = isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={ev.id}
                className={`group rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? (isDark
                      ? 'bg-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40'
                      : 'bg-cyan-50 border-cyan-200 hover:border-cyan-400')
                    : (isDark
                      ? 'bg-white/3 border-white/5 hover:border-white/15 hover:bg-white/5'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm')
                }`}
              >
                <div className="p-5 flex items-center gap-4">
                  {/* Checkbox selección */}
                  <div className="pl-2 flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-white/10 checked:bg-[#00d2ff] transition-all cursor-pointer"
                      checked={selectedIds.includes(ev.id)}
                      onChange={() => toggleSelection(ev.id)}
                    />
                  </div>

                  {/* Icono estado */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isOpen
                      ? 'bg-cyan-500/20 text-[#00d2ff]'
                      : (isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400')
                  }`}>
                    {isOpen ? <AlertCircle size={22} /> : <CheckCircle size={22} />}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black text-base truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {ev.nombre}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isOpen
                          ? 'bg-cyan-500/20 text-[#00d2ff]'
                          : (isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500')
                      }`}>
                        {isOpen ? '⚡ Abierto' : '✓ Cerrado'}
                      </span>
                    </div>
                    <div className={`flex items-center gap-4 mt-1.5 text-xs flex-wrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {fechaStr}
                      </span>
                      {horaStr && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {horaStr}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User size={11} /> {ev.responsable}
                      </span>
                      {ev.totalIngresos !== undefined && ev.totalIngresos > 0 && (
                        <span className={`flex items-center gap-1 font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          <TrendingUp size={11} /> ${ev.totalIngresos.toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isOpen && (
                      <button
                        onClick={() => onRetomarEvento(ev)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          isDark
                            ? 'bg-[#ff0099]/20 text-[#ff0099] hover:bg-[#ff0099]/30'
                            : 'bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100'
                        }`}
                        title="Retomar este evento"
                      >
                        <RotateCcw size={13} /> Retomar
                      </button>
                    )}
                    <button
                      onClick={() => verDetalle(ev)}
                      disabled={isLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        isDark
                          ? 'bg-[#00d2ff]/10 text-[#00d2ff] hover:bg-[#00d2ff]/20'
                          : 'bg-cyan-50 text-cyan-600 border border-cyan-200 hover:bg-cyan-100'
                      }`}
                      title="Ver reporte completo"
                    >
                      {isLoading
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Eye size={13} />
                      }
                      Ver reporte
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats footer */}
      {!loading && eventos.length > 0 && (
        <div className={`mt-8 grid grid-cols-3 gap-4`}>
          {[
            {
              label: 'Total Eventos',
              value: eventos.length,
              icon: <History size={16} />,
              color: isDark ? 'text-[#00d2ff]' : 'text-cyan-600',
              bg: isDark ? 'bg-cyan-500/10' : 'bg-cyan-50',
            },
            {
              label: 'Cerrados',
              value: eventos.filter(e => e.estado === 'cerrado').length,
              icon: <CheckCircle size={16} />,
              color: isDark ? 'text-emerald-400' : 'text-emerald-600',
              bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
            },
            {
              label: 'En Curso',
              value: eventos.filter(e => e.estado === 'abierto').length,
              icon: <AlertCircle size={16} />,
              color: isDark ? 'text-[#ff0099]' : 'text-pink-600',
              bg: isDark ? 'bg-pink-500/10' : 'bg-pink-50',
            },
          ].map(stat => (
            <div key={stat.label} className={`rounded-2xl p-4 border ${isDark ? 'border-white/5' : 'border-slate-100'} ${stat.bg}`}>
              <div className={`flex items-center gap-2 mb-1 ${stat.color}`}>
                {stat.icon}
                <span className="text-[10px] font-black uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
