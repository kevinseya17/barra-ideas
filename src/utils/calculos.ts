import { Producto, ResumenProducto } from '@/types';

export const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

export const uid = () => Math.random().toString(36).slice(2, 10);

export const nowTime = () =>
  new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export const calcularResumen = (
  productos: Producto[],
  inventarioInicial: { producto_id: string; cantidad: number }[],
  recargas: { producto_id: string; cantidad: number }[],
  cortesias: { producto_id: string; cantidad: number }[],
  perdidas: { producto_id: string; cantidad: number }[],
  inventarioFinal: { producto_id: string; cantidad: number }[]
): ResumenProducto[] => {
  return productos.map((p) => {
    const ini = inventarioInicial.find((x) => x.producto_id === p.id)?.cantidad ?? 0;
    const rec = recargas
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    const cor = cortesias
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    const per = perdidas
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    const fin = inventarioFinal.find((x) => x.producto_id === p.id)?.cantidad ?? 0;
    const disponible = ini + rec;
    const consumo = Math.max(0, disponible - fin);
    const vendido = Math.max(0, consumo - cor - per);
    return {
      ...p,
      ini,
      rec,
      cor,
      per,
      fin,
      disponible,
      consumo,
      vendido,
      ingresoEsperado: vendido * p.precio,
      costoCortesias: cor * p.costo,
    };
  });
};

export const exportarCSV = (
  resumen: ResumenProducto[],
  nombreEvento: string,
  fecha: string,
  efectivo: number,
  datafono: number,
  nequi: number,
  cajaInicial: number = 0
) => {
  // Función para escapar textos con comas para Excel
  const escape = (text: string | number) => `"${String(text).replace(/"/g, '""')}"`;

  // Encabezado del Evento
  const headerEvento = [
    ['REPORTE DE AUDITORIA DE BARRA'],
    ['Evento:', escape(nombreEvento)],
    ['Fecha:', escape(fecha)],
    [''],
  ];

  // Tabla Principal
  const headers = [
    'Producto', 'Categoría', 'Unidad', 'Inventario Inicial', 'Recargas',
    'Disponible Total', 'Inventario Final', 'Cortesías', 'Pérdidas',
    'Unidades Vendidas', 'Precio Venta', 'Costo Unitario', 'Venta Bruta Esperada',
  ].map(escape);

  const rows = resumen.map((p) => [
    escape(p.nombre), escape(p.categoria), escape(p.unidad),
    p.ini, p.rec, p.disponible, p.fin, p.cor, p.per,
    p.vendido, p.precio, p.costo, p.ingresoEsperado,
  ]);

  // Cálculos Financieros
  const totalVentas = resumen.reduce((a, b) => a + b.ingresoEsperado, 0);
  const totalEsperadoCaja = totalVentas + cajaInicial;
  const totalRecibido = efectivo + datafono + nequi;
  const diferencia = totalRecibido - totalEsperadoCaja;
  const costoCortesias = resumen.reduce((a, b) => a + b.costoCortesias, 0);

  const extra = [
    [''],
    ['RESUMEN FINANCIERO Y CUADRE DE CAJA'],
    ['Caja Inicial (Base)', cajaInicial],
    ['Ventas Brutas Esperadas', totalVentas],
    ['Total Esperado en Caja', totalEsperadoCaja],
    [''],
    ['DINERO RECAUDADO'],
    ['Efectivo Físico', efectivo],
    ['Datáfono / Tarjetas', datafono],
    ['Nequi / Transferencias', nequi],
    ['Total Dinero Registrado', totalRecibido],
    [''],
    ['RESULTADO DE AUDITORIA'],
    ['Diferencia (Sobrante/Faltante)', diferencia],
    ['Costo de Cortesías Entregadas', costoCortesias],
  ].map(row => row.map(cell => typeof cell === 'string' && cell !== '' ? escape(cell) : cell));

  const csv = [...headerEvento, headers, ...rows, ...extra]
    .map((r) => r.join(','))
    .join('\n');

  // El BOM \uFEFF asegura que Excel lea los tildes y caracteres en español (UTF-8) correctamente
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // Limpiar el nombre del archivo para que no tenga caracteres prohibidos en Windows/Mac
  const safeName = nombreEvento.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Evento';
  const safeDate = fecha.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Fecha';
  a.download = `Auditoria_${safeName}_${safeDate}.csv`;
  
  // Agregar al DOM, hacer click y remover (necesario para algunos navegadores)
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
};
