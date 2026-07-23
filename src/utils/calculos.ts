import { Producto, ResumenProducto, LogEntry } from '@/types';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportarPDF = (titulo: string, headers: string[], data: any[][], fileName: string) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(titulo, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado por BarraPRO - ${new Date().toLocaleString()}`, 14, 30);
  
  autoTable(doc, {
    startY: 40,
    head: [headers],
    body: data,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
    styles: { fontSize: 8 }
  });
  
  doc.save(`${fileName}.pdf`);
};

export const exportarExcelSimple = async (titulo: string, headers: string[], data: any[][], fileName: string) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Datos');
  
  ws.addRow([titulo]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  });
  
  data.forEach(d => ws.addRow(d));
  ws.columns.forEach(col => { col.width = 25; });
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
};

export const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

export const uid = () => crypto.randomUUID();

export const nowTime = () =>
  new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export const getBaseEventName = (nombre: string): string => {
  if (!nombre) return '';
  const sinBodega = nombre.replace(/^BODEGA - /, '');
  const partes = sinBodega.split(' - ');
  if (partes.length > 1) {
    return partes.slice(0, -1).join(' - ');
  }
  return sinBodega;
};

export const calcularResumen = (
  productos: Producto[],
  inventarioInicial: Record<string, { cantidad: number; proveedor: string }> | Record<string, number>,
  recargas: { producto_id: string; cantidad: number }[],
  cortesias: { producto_id: string; cantidad: number }[],
  perdidas: { producto_id: string; cantidad: number }[],
  descuentos: { producto_id: string; cantidad: number; porcentaje: number; valor_descontado: number }[],
  inventarioFinal: Record<string, number>
): ResumenProducto[] => {
  return productos.map((p) => {
    // Manejar ambos formatos de inventario inicial (con o sin proveedor)
    const rawIni = inventarioInicial[p.id];
    const ini = typeof rawIni === 'object' ? rawIni.cantidad : (rawIni ?? 0);
    const proveedor = typeof rawIni === 'object' ? rawIni.proveedor : '-';
    
    const rec = recargas
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    const cor = cortesias
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    const per = perdidas
      .filter((x) => x.producto_id === p.id)
      .reduce((a, b) => a + Number(b.cantidad), 0);
    
    const descItems = descuentos.filter((x) => x.producto_id === p.id);
    const desc = descItems.reduce((a, b) => a + Number(b.cantidad), 0);
    const valorDescontadoTotales = descItems.reduce((a, b) => a + Number(b.valor_descontado), 0);

    const fin = inventarioFinal[p.id] ?? 0;
    const disponible = ini + rec;
    const consumo = Math.max(0, disponible - fin);
    
    // Lo vendido normal (sin descuento) es todo lo que salió que no fue cortesía, pérdida, ni descuento.
    const vendido = Math.max(0, consumo - cor - per - desc);
    
    // El ingreso total es lo vendido full price + lo vendido con descuento (precio original - valor descontado)
    const ingresoVentaNormal = vendido * p.precio;
    const ingresoDescuentos = (desc * p.precio) - valorDescontadoTotales;
    
    // Si no hubo consumo real (Disp - Fin <= 0), el ingreso debe ser 0.
    const ingresoEsperado = consumo > 0 ? (ingresoVentaNormal + ingresoDescuentos) : 0;

    return {
      ...p,
      ini,
      rec,
      cor,
      per,
      desc,
      valorDescontadoTotales,
      valorCortesiaTotales: cor * p.precio,
      valorPerdidaTotales: per * p.precio,
      ventaPotencial: consumo * p.precio,
      fin,
      disponible,
      consumo,
      vendido,
      ingresoEsperado,
      costoCortesias: cor * p.costo,
      proveedor
    };
  });
};


export const exportarExcel = async (
  resumen: ResumenProducto[],
  productos: { id: string; nombre: string; costo: number; precio: number }[],
  nombreEvento: string,
  fecha: string,
  efectivo: number,
  datafono: number,
  nequi: number,
  cajaInicial: number = 0,
  deudas: Record<string, number> = {},
  log: LogEntry[] = [],
  gastos: { concepto: string, monto: number, metodo: string, hora?: string }[] = [],
  recargas: { producto_id: string, cantidad: number, hora?: string, proveedor: string }[] = [],
  cortesias: { producto_id: string, cantidad: number, hora?: string, persona: string, motivo: string }[] = [],
  perdidas: { producto_id: string, cantidad: number, hora?: string, motivo: string }[] = [],
  descuentos: { producto_id: string, cantidad: number, hora?: string, porcentaje: number, valor_descontado: number, motivo: string }[] = []
) => {
  const workbook = new ExcelJS.Workbook();
  const pName = (id: string) => productos.find(x => x.id === id)?.nombre || id;

  // Estilos comunes
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const headerStyle = (ws: ExcelJS.Worksheet, rowNum: number, colCount: number) => {
    const row = ws.getRow(rowNum);
    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo 600
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  };

  const applyBorders = (ws: ExcelJS.Worksheet, startRow: number, endRow: number, colCount: number) => {
    for (let r = startRow; r <= endRow; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= colCount; c++) {
        row.getCell(c).border = borderStyle;
      }
    }
  };

  // ═══════════════════════════════════════════
  // PESTAÑA 1: BARRA (CON BORDES Y COLORES)
  // ═══════════════════════════════════════════
  const ws = workbook.addWorksheet('BARRA');
  
  ws.addRow(['REPORTE DE VENTAS E INVENTARIO - BARRAPRO']).font = { size: 16, bold: true };
  ws.addRow(['Evento:', nombreEvento, '', 'Fecha:', fecha]);
  ws.addRow([]);

  const tableHeader = [
    'PRODUCTO', 'PRECIO', 'INICIAL', 'RECARGAS', 'FINAL', 'CONSUMO', 
    'CORTESÍAS (UND)', 'VALOR CORT. ($)', 
    'DESC. (UND)', 'VALOR DESC. ($)', 
    'BAJAS (UND)', 'VALOR BAJAS ($)', 
    'VENDIDO (UND)', 'INGRESO REAL ($)', 
    '', 'COSTO UNIT', 'COSTO TOTAL', 'PROVEEDOR'
  ];
  const headerRow = ws.addRow(tableHeader);
  headerStyle(ws, headerRow.number, tableHeader.length);

  const ORDEN_PICANTE_CAT: Record<string, number> = { gaseosa: 1, agua: 2, cerveza: 3, otro: 4, licor: 5, snack: 6 };
  const categorias = [...new Set(resumen.map(p => p.categoria))]
    .sort((a, b) => (ORDEN_PICANTE_CAT[a] ?? 99) - (ORDEN_PICANTE_CAT[b] ?? 99));
  categorias.forEach(cat => {
    const catRow = ws.addRow([`>>> CATEGORÍA: ${cat.toUpperCase()}`]);
    catRow.font = { bold: true };
    catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    
    const prods = resumen.filter(p => p.categoria === cat);
    prods.forEach(p => {
      ws.addRow([
        p.nombre, 
        p.precio, 
        p.ini, 
        p.rec, 
        p.fin, 
        p.consumo, 
        p.cor, 
        p.valorCortesiaTotales, 
        p.desc || 0, 
        p.valorDescontadoTotales, 
        p.per, 
        p.valorPerdidaTotales,
        p.vendido + (p.desc || 0), // Total unidades que generaron algún ingreso
        p.ingresoEsperado, 
        '', 
        p.costo, 
        p.consumo * p.costo, 
        p.proveedor || '-',
      ]);
    });
  });

  ws.addRow([]);
  const totalVentas = resumen.reduce((a, b) => a + b.ingresoEsperado, 0);
  const totalRecibido = efectivo + datafono + nequi;
  const totalCostoVendido = resumen.reduce((a, b) => a + b.vendido * b.costo, 0);
  const totalGastosEfectivo = gastos.filter(g => g.metodo === 'efectivo').reduce((a, b) => a + Number(b.monto), 0);

  // Cuadro de Resumen de Caja
  ws.addRow(['RESUMEN DE CAJA']).font = { bold: true };
  const r1 = ws.addRow(['', '', '', '', '', '', '', '', '', 'MÉTODO', 'MONTO']);
  headerStyle(ws, r1.number, 11);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'EFECTIVO', efectivo]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'DATÁFONO', datafono]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'NEQUI / QR', nequi]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'TOTAL RECAUDADO', totalRecibido]).font = { bold: true };
  
  ws.addRow([]);
  ws.addRow(['CONCILIACIÓN FINAL']).font = { bold: true };
  const r2 = ws.addRow(['', '', '', '', '', '', '', '', '', 'CONCEPTO', 'VALOR']);
  headerStyle(ws, r2.number, 11);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'VENTAS BRUTAS', totalVentas]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'CAJA INICIAL (BASE)', cajaInicial]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'GASTOS EFECTIVO', -totalGastosEfectivo]);
  const esperado = totalVentas + cajaInicial - totalGastosEfectivo;
  ws.addRow(['', '', '', '', '', '', '', '', '', 'ESPERADO EN CAJA', esperado]).font = { bold: true };
  ws.addRow(['', '', '', '', '', '', '', '', '', 'DIFERENCIA', totalRecibido - esperado]).font = { bold: true };

  // Aplicar bordes a toda la hoja
  ws.eachRow(row => {
    row.eachCell(cell => {
      if (cell.value !== null) cell.border = borderStyle;
    });
  });

  // Ajustar anchos
  ws.columns.forEach(col => { col.width = 15; });
  ws.getColumn(1).width = 30;

  // ═══════════════════════════════════════════
  // OTRAS PESTAÑAS (Con el mismo estilo)
  // ═══════════════════════════════════════════
  const createDetailSheet = (name: string, headers: string[], data: any[][]) => {
    const s = workbook.addWorksheet(name);
    s.addRow([name.toUpperCase()]).font = { size: 14, bold: true };
    const h = s.addRow(headers);
    headerStyle(s, h.number, headers.length);
    data.forEach(d => s.addRow(d));
    applyBorders(s, 2, data.length + 2, headers.length);
    s.columns.forEach((col, i) => { col.width = i === 1 ? 35 : 15; });
  };

  if (recargas.length > 0) createDetailSheet('Recargas', ['HORA', 'PRODUCTO', 'CANT', 'PROVEEDOR'], recargas.map(r => [r.hora, pName(r.producto_id), r.cantidad, r.proveedor]));
  
  if (cortesias.length > 0) {
    createDetailSheet(
      'Cortesías', 
      ['HORA', 'PRODUCTO', 'CANT', 'P. VENTA UNIT ($)', 'VALOR TOTAL ($)', 'PARA', 'MOTIVO'], 
      cortesias.map(c => {
        const prod = productos.find(p => p.id === c.producto_id);
        const precio = prod?.precio || 0;
        return [c.hora, pName(c.producto_id), c.cantidad, precio, c.cantidad * precio, c.persona, c.motivo];
      })
    );
  }

  if (perdidas.length > 0) createDetailSheet('Bajas', ['HORA', 'PRODUCTO', 'CANT', 'MOTIVO'], perdidas.map(p => [p.hora, pName(p.producto_id), p.cantidad, p.motivo]));
  
  if (descuentos.length > 0) {
    createDetailSheet(
      'Descuentos', 
      ['HORA', 'PRODUCTO', 'CANT', 'P. ORIGINAL ($)', 'SUBTOTAL ($)', '% DESC', 'VALOR DESC ($)', 'INGRESO FINAL ($)', 'MOTIVO'], 
      descuentos.map(d => {
        const prod = productos.find(p => p.id === d.producto_id);
        const precio = prod?.precio || 0;
        const subtotal = d.cantidad * precio;
        return [
          d.hora, 
          pName(d.producto_id), 
          d.cantidad, 
          precio, 
          subtotal, 
          `${d.porcentaje}%`, 
          d.valor_descontado, 
          subtotal - d.valor_descontado, 
          d.motivo
        ];
      })
    );
  }

  // ═══════════════════════════════════════════
  // PESTAÑA: LIQUIDACIÓN PROVEEDORES
  // ═══════════════════════════════════════════
  const wsp = workbook.addWorksheet('LIQUIDACIÓN');
  wsp.addRow(['BARRAPRO - LIQUIDACIÓN DE CUENTAS POR PROVEEDOR']).font = { size: 14, bold: true };
  wsp.addRow(['Evento:', nombreEvento]);
  wsp.addRow(['Fecha:', fecha]);
  wsp.addRow([]);

  // Consolidar datos por proveedor
  const provDetails: Record<string, Record<string, { ini: number, rec: number, fin: number, consumo: number, costo: number, nombre: string }>> = {};
  
  // 1. Del Inventario Inicial y Resumen
  resumen.forEach(p => {
    if (p.proveedor && p.proveedor !== '-') {
      if (!provDetails[p.proveedor]) provDetails[p.proveedor] = {};
      if (!provDetails[p.proveedor][p.id]) provDetails[p.proveedor][p.id] = { ini: 0, rec: 0, fin: 0, consumo: 0, costo: p.costo, nombre: p.nombre };
      provDetails[p.proveedor][p.id].ini = p.ini;
      provDetails[p.proveedor][p.id].fin = p.fin;
      provDetails[p.proveedor][p.id].consumo = p.consumo;
    }
  });

  // 2. De las Recargas
  recargas.forEach(r => {
    if (r.proveedor && r.proveedor !== '-') {
      if (!provDetails[r.proveedor]) provDetails[r.proveedor] = {};
      const p = resumen.find(x => x.id === r.producto_id);
      if (p) {
        if (!provDetails[r.proveedor][r.producto_id]) provDetails[r.proveedor][r.producto_id] = { ini: 0, rec: 0, fin: 0, consumo: 0, costo: p.costo, nombre: p.nombre };
        provDetails[r.proveedor][r.producto_id].rec += r.cantidad;
        // El consumo se recalcula automáticamente si viene del resumen
      }
    }
  });

  // Renderizar tablas por proveedor
  Object.entries(provDetails).forEach(([provName, items]) => {
    const titleRow = wsp.addRow([`PROVEEDOR: ${provName.toUpperCase()}`]);
    titleRow.font = { bold: true, size: 12 };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

    const pHeader = ['PRODUCTO', 'STOCK INICIAL', 'RECARGAS', 'STOCK FINAL', 'CONSUMO TOTAL', 'COSTO UNIT', 'VALOR A PAGAR'];
    const phRow = wsp.addRow(pHeader);
    headerStyle(wsp, phRow.number, pHeader.length);

    let totalProv = 0;
    Object.values(items).forEach(item => {
      const subtotal = item.consumo * item.costo;
      if (item.ini + item.rec > 0) {
        totalProv += subtotal;
        wsp.addRow([item.nombre, item.ini, item.rec, item.fin, item.consumo, item.costo, subtotal]);
      }
    });

    const fRow = wsp.addRow(['TOTAL A PAGAR POR CONSUMO REAL', '', '', '', '', '', totalProv]);
    fRow.font = { bold: true };
    fRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; 
    
    wsp.addRow([]); 
  });

  // Ajustar anchos y bordes en Liquidación
  wsp.eachRow(row => {
    row.eachCell(cell => {
      if (cell.value !== null) cell.border = borderStyle;
    });
  });
  wsp.columns.forEach((col, i) => { col.width = i === 0 ? 35 : 18; });

  // Descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Reporte_Final_${nombreEvento.replace(/ /g, '_')}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const exportarExcelPicante = async (
  nombreEvento: string,
  fecha: string,
  productos: Producto[],
  globalData: any
) => {
  if (!globalData || !globalData.relatedEvents) return;
  const workbook = new ExcelJS.Workbook();
  const pName = (id: string) => productos.find(x => x.id === id)?.nombre || id;

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
  };
  
  const headerStyle = (ws: ExcelJS.Worksheet, rowNum: number, colCount: number) => {
    const row = ws.getRow(rowNum);
    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  };

  // 1. PESTAÑA BODEGA PRINCIPAL — Consolidado General del Evento
  // Identificar el evento de la bodega
  const bodegaEvent = globalData.relatedEvents.find((e: any) => e.nombre.startsWith('BODEGA -') || e.nombre === nombreEvento);
  const bodegaEventId = bodegaEvent?.id;
  // IDs de todas las barras (no bodega)
  const barrasIds: string[] = globalData.relatedEvents
    .filter((e: any) => !e.nombre.startsWith('BODEGA -'))
    .map((e: any) => e.id);

  const wsBodega = workbook.addWorksheet('BODEGA PRINCIPAL');
  wsBodega.addRow([`REPORTE GENERAL Y CONSOLIDADO - ${nombreEvento.toUpperCase()}`]).font = { size: 14, bold: true };
  wsBodega.addRow([`Fecha: ${fecha}`]);
  wsBodega.addRow([]);

  // Sección 1: Movimientos de la Bodega
  wsBodega.addRow(['── MOVIMIENTOS DE BODEGA ──']).font = { bold: true, italic: true, color: { argb: 'FF94A3B8' } };
  const bHeaders = [
    'PRODUCTO', 'CATEGORÍA', 'PRECIO',
    'INICIAL BODEGA', 'DESPACHOS A BARRAS', 'RETORNOS DE BARRAS', 'BAJAS EN BODEGA', 'STOCK FINAL BODEGA'
  ];
  const bRow = wsBodega.addRow(bHeaders);
  headerStyle(wsBodega, bRow.number, bHeaders.length);

  productos.forEach(p => {
    const pIni = globalData.inventario
      .filter((i: any) => i.evento_id === bodegaEventId && i.producto_id === p.id && i.tipo === 'inicial')
      .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Despachos = salidas de bodega hacia barras
    const pDespachos = globalData.perdidas
      .filter((l: any) =>
        l.evento_id === bodegaEventId &&
        l.producto_id === p.id &&
        (l.motivo?.startsWith('Traslado a ') || l.motivo?.startsWith('Clonación hacia '))
      ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Retornos = lo que las barras devolvieron a bodega (entran como recargas con proveedor RETORNO)
    const pRetornos = globalData.recargas
      .filter((r: any) =>
        r.evento_id === bodegaEventId &&
        r.producto_id === p.id &&
        r.proveedor?.startsWith('RETORNO:')
      ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Bajas reales SOLO de la bodega (botella rota en bodega, etc.)
    const pBajasBodega = globalData.perdidas
      .filter((l: any) =>
        l.evento_id === bodegaEventId &&
        l.producto_id === p.id &&
        !l.motivo?.startsWith('Traslado a ') &&
        !l.motivo?.startsWith('Traslado enviado') &&
        !l.motivo?.startsWith('Clonación') &&
        !l.motivo?.startsWith('Devolución')
      ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    const pFin = globalData.inventario
      .filter((i: any) => i.evento_id === bodegaEventId && i.producto_id === p.id && i.tipo === 'final')
      .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    if (pIni > 0 || pDespachos > 0) {
      wsBodega.addRow([p.nombre, p.categoria, p.precio, pIni, pDespachos, pRetornos, pBajasBodega, pFin]);
    }
  });

  // Sección 2: Consolidado de todas las barras
  wsBodega.addRow([]);
  wsBodega.addRow(['── CONSOLIDADO TOTAL DE BARRAS (Acumulado de todas las barras) ──']).font = { bold: true, italic: true, color: { argb: 'FF94A3B8' } };
  const cHeaders = [
    'PRODUCTO', 'CATEGORÍA', 'PRECIO',
    'CORTESÍAS TOTALES', 'VALOR CORT. ($)',
    'BAJAS TOTALES (UND)', 'DESCUENTOS (UND)',
    'VENDIDO TOTAL (UND)', 'INGRESO TOTAL ($)'
  ];
  const cRow = wsBodega.addRow(cHeaders);
  headerStyle(wsBodega, cRow.number, cHeaders.length);

  productos.forEach(p => {
    // Cortesías de todas las barras
    const tCor = globalData.cortesias
      .filter((c: any) => barrasIds.includes(c.evento_id) && c.producto_id === p.id)
      .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Bajas reales de todas las barras (excluye traslados)
    const tBajas = globalData.perdidas
      .filter((l: any) =>
        barrasIds.includes(l.evento_id) &&
        l.producto_id === p.id &&
        !l.motivo?.startsWith('Traslado enviado') &&
        !l.motivo?.startsWith('Traslado a ') &&
        !l.motivo?.startsWith('Devolución Bodega') &&
        !l.motivo?.startsWith('Clonación')
      ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Descuentos de todas las barras
    const tDesc = globalData.descuentos
      .filter((d: any) => barrasIds.includes(d.evento_id) && d.producto_id === p.id)
      .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

    // Vendido total (todo lo consumido en barras que no fue cortesía ni baja)
    let tVendido = 0;
    barrasIds.forEach(bId => {
      const bIni = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bRec = globalData.recargas.filter((r: any) => r.evento_id === bId && r.producto_id === p.id && !r.proveedor?.startsWith('RETORNO:')).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bFin = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'final').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bBajas = globalData.perdidas.filter((l: any) => l.evento_id === bId && l.producto_id === p.id && !l.motivo?.startsWith('Traslado enviado') && !l.motivo?.startsWith('Traslado a ') && !l.motivo?.startsWith('Devolución Bodega') && !l.motivo?.startsWith('Clonación')).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bCor = globalData.cortesias.filter((c: any) => c.evento_id === bId && c.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const consumo = Math.max(0, bIni + bRec - bFin);
      tVendido += Math.max(0, consumo - bCor - bBajas);
    });

    const tIngreso = tVendido * p.precio;

    if (tCor > 0 || tBajas > 0 || tVendido > 0) {
      wsBodega.addRow([p.nombre, p.categoria, p.precio, tCor, tCor * p.precio, tBajas, tDesc, tVendido, tIngreso]);
    }
  });


  // 2. PESTAÑAS POR BARRAS (BARRA X y CORTESIAS X)
  const barras = globalData.relatedEvents.filter((e: any) => !e.nombre.startsWith('BODEGA -'));

  barras.forEach((bEv: any) => {
    const rawBarName = bEv.nombre.split(' - ').pop() || bEv.nombre;
    const barSheetName = `BARRA ${rawBarName}`.substring(0, 31);
    const corSheetName = `CORTESIAS ${rawBarName}`.substring(0, 31);

    const wsBar = workbook.addWorksheet(barSheetName);
    wsBar.addRow([`REPORTE DE BARRA: ${bEv.nombre}`]).font = { size: 14, bold: true };
    wsBar.addRow([]);

    const barHeaders = ['PRODUCTO', 'PRECIO', 'INICIAL', 'RECARGAS', 'CORTESÍAS', 'BAJAS', 'FINAL', 'VENTA TOTAL (UND)', 'VENTA TOTAL ($)'];
    const hBar = wsBar.addRow(barHeaders);
    headerStyle(wsBar, hBar.number, barHeaders.length);

    productos.forEach(p => {
      const bIni = globalData.inventario.filter((i: any) => i.evento_id === bEv.id && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bRec = globalData.recargas.filter((r: any) => r.evento_id === bEv.id && r.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bCor = globalData.cortesias.filter((c: any) => c.evento_id === bEv.id && c.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      // BAJAS REALES de la barra: solo rotas/dañadas, NO traslados enviados a otras barras/bodega
      const bPer = globalData.perdidas.filter((l: any) =>
        l.evento_id === bEv.id &&
        l.producto_id === p.id &&
        !l.motivo?.startsWith('Traslado enviado') &&
        !l.motivo?.startsWith('Traslado a ') &&
        !l.motivo?.startsWith('Devolución Bodega') &&
        !l.motivo?.startsWith('Clonación')
      ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      const bFin = globalData.inventario.filter((i: any) => i.evento_id === bEv.id && i.producto_id === p.id && i.tipo === 'final').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      
      const disp = bIni + bRec;
      const consumo = Math.max(0, disp - bFin);
      const vendidoUnd = Math.max(0, consumo - bCor - bPer);
      const ventaValor = vendidoUnd * p.precio;

      if (disp > 0 || bFin > 0) {
        wsBar.addRow([p.nombre, p.precio, bIni, bRec, bCor, bPer, bFin, vendidoUnd, ventaValor]);
      }
    });

    // Pestaña Cortesías de esta barra
    const bCortesias = globalData.cortesias.filter((c: any) => c.evento_id === bEv.id);
    if (bCortesias.length > 0) {
      const wsCor = workbook.addWorksheet(corSheetName);
      wsCor.addRow([`CORTESÍAS DE ${bEv.nombre.toUpperCase()}`]).font = { size: 14, bold: true };
      const cHeaders = ['HORA', 'PRODUCTO', 'CANT', 'P. VENTA UNIT ($)', 'VALOR TOTAL ($)', 'PARA', 'MOTIVO'];
      const hCor = wsCor.addRow(cHeaders);
      headerStyle(wsCor, hCor.number, cHeaders.length);

      bCortesias.forEach((c: any) => {
        const prod = productos.find(x => x.id === c.producto_id);
        const precio = prod?.precio || 0;
        wsCor.addRow([c.hora || '', pName(c.producto_id), c.cantidad, precio, c.cantidad * precio, c.persona || '', c.motivo || '']);
      });
    }
  });

  workbook.eachSheet(sheet => {
    sheet.eachRow(row => {
      row.eachCell(cell => {
        if (cell.value !== null) cell.border = borderStyle;
      });
    });
    sheet.columns.forEach((col, i) => { col.width = i === 0 ? 32 : 18; });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `evento_${nombreEvento.replace(/ /g, '_')}_cierre_bodega.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
