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

    const comision = p.comision || 0;
    const totalComision = vendido * comision;
    const totalProducto = vendido + cor;
    const costoProducto = totalProducto * (p.costo || 0);

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
      proveedor,
      comision,
      totalComision,
      totalProducto,
      costoProducto
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
    'Producto', 'Valor', 'Inicial', 'Recarga', 'Cortesia', 'Bajas', 'Final', 'Venta', 'Venta total'
  ];
  const headerRow = ws.addRow(tableHeader);
  headerStyle(ws, headerRow.number, tableHeader.length);

  const ORDEN_PICANTE_CAT: Record<string, number> = { gaseosa: 1, agua: 2, cerveza: 3, otro: 4, licor: 5, snack: 6 };
  const categorias = [...new Set(resumen.map(p => p.categoria))]
    .sort((a, b) => (ORDEN_PICANTE_CAT[a] ?? 99) - (ORDEN_PICANTE_CAT[b] ?? 99));
  categorias.forEach(cat => {
    const catRow = ws.addRow([cat.toUpperCase()]);
    catRow.font = { bold: true };
    catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    
    const prods = resumen.filter(p => p.categoria === cat);
    prods.forEach(p => {
      ws.addRow([
        p.nombre, 
        p.precio, // Precio a la venta público
        p.ini || '', 
        p.rec || '', 
        p.cor || '', 
        p.per || '', 
        p.fin, 
        p.vendido, 
        p.ingresoEsperado
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

  // ── TABLA PRINCIPAL: Consolidado por producto acumulado de todas las barras ──
  const mainHeaders = [
    'Producto', 'Presentacion', 'Valor', 'Inicial', 'Recargas', 'Cortesias', 'Bajas', 'Final',
    'Venta total (UND)', 'Venta total ($)',
    'COMISION', 'TOTAL COMISION',
    'TOTAL PRODUCTO', 'COSTO PRODUCTO'
  ];
  const mainHeaderRow = wsBodega.addRow(mainHeaders);
  headerStyle(wsBodega, mainHeaderRow.number, mainHeaders.length);

  const ORDEN_CAT: Record<string, number> = { gaseosa: 1, agua: 2, cerveza: 3, otro: 4, licor: 5, snack: 6 };
  const categorias = Array.from(new Set(productos.map((p: any) => p.categoria)))
    .sort((a: any, b: any) => (ORDEN_CAT[a] ?? 99) - (ORDEN_CAT[b] ?? 99));

  let grandTotalVenta = 0;
  let grandTotalComision = 0;
  let grandTotalCosto = 0;

  categorias.forEach((cat: any) => {
    // Fila de categoría separadora
    const catFila = wsBodega.addRow([cat.toUpperCase()]);
    catFila.font = { bold: true };
    catFila.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    const catProds = productos.filter((p: any) => p.categoria === cat);
    catProds.forEach((p: any) => {
      // Inicial de bodega
      const inicialBodega = globalData.inventario
        .filter((i: any) => i.evento_id === bodegaEventId && i.producto_id === p.id && i.tipo === 'inicial')
        .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

      // Recargas totales de todas las barras (que vienen de bodega)
      const recargas_barras = barrasIds.reduce((sum: number, bId: string) => {
        return sum + globalData.recargas
          .filter((r: any) => r.evento_id === bId && r.producto_id === p.id && !r.proveedor?.startsWith('RETORNO:'))
          .reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      }, 0);

      // Cortesías acumuladas de todas las barras
      const cortesias_total = globalData.cortesias
        .filter((c: any) => barrasIds.includes(c.evento_id) && c.producto_id === p.id)
        .reduce((a: number, b: any) => a + Number(b.cantidad), 0);

      // Bajas reales de todas las barras
      const bajas_total = globalData.perdidas
        .filter((l: any) =>
          barrasIds.includes(l.evento_id) &&
          l.producto_id === p.id &&
          !l.motivo?.startsWith('Traslado enviado') &&
          !l.motivo?.startsWith('Traslado a ') &&
          !l.motivo?.startsWith('Devolución Bodega') &&
          !l.motivo?.startsWith('Clonación')
        ).reduce((a: number, b: any) => a + Number(b.cantidad), 0);

      // Stock final (suma de finales de todas las barras)
      const final_total = barrasIds.reduce((sum: number, bId: string) => {
        return sum + globalData.inventario
          .filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'final')
          .reduce((a: number, b: any) => a + Number(b.cantidad), 0);
      }, 0);

      // Venta = todo lo que salió que no fue cortesía ni baja
      let vendido = 0;
      barrasIds.forEach((bId: string) => {
        const bIni = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bRec = globalData.recargas.filter((r: any) => r.evento_id === bId && r.producto_id === p.id && !r.proveedor?.startsWith('RETORNO:')).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bFin = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'final').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bBajas = globalData.perdidas.filter((l: any) => l.evento_id === bId && l.producto_id === p.id && !l.motivo?.startsWith('Traslado enviado') && !l.motivo?.startsWith('Traslado a ') && !l.motivo?.startsWith('Devolución Bodega') && !l.motivo?.startsWith('Clonación')).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bCor = globalData.cortesias.filter((c: any) => c.evento_id === bId && c.producto_id === p.id).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const consumo = Math.max(0, bIni + bRec - bFin);
        vendido += Math.max(0, consumo - bCor - bBajas);
      });

      const ventaTotal = vendido * p.precio;
      const comisionUnit = p.comision || 0;
      const totalComision = vendido * comisionUnit;
      const totalProducto = vendido + cortesias_total; // Vendido + Cortesías
      const costoProducto = totalProducto * (p.costo || 0);

      grandTotalVenta += ventaTotal;
      grandTotalComision += totalComision;
      grandTotalCosto += costoProducto;

      const row = wsBodega.addRow([
        p.nombre,
        p.presentacion || '',
        p.precio,
        inicialBodega || '',
        recargas_barras || '',
        cortesias_total || '',
        bajas_total || '',
        final_total,
        vendido,
        ventaTotal,
        comisionUnit || '',
        totalComision || '',
        totalProducto,
        costoProducto || ''
      ]);

      // Formato número para columnas monetarias
      row.getCell(3).numFmt = '$#,##0';
      row.getCell(10).numFmt = '$#,##0';
      row.getCell(11).numFmt = '$#,##0';
      row.getCell(12).numFmt = '$#,##0';
      row.getCell(14).numFmt = '$#,##0';
    });
  });

  // Fila de TOTAL
  wsBodega.addRow([]);
  const totalRow = wsBodega.addRow(['', '', '', '', '', '', '', '', '', 'TOTAL', '', '', '', `$${grandTotalVenta.toLocaleString('es-CO')}`]);
  totalRow.font = { bold: true };
  totalRow.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  totalRow.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };

  // ── SECCIÓN INFERIOR: Resumen financiero ──
  wsBodega.addRow([]);
  wsBodega.addRow([]);

  // Calcular totales necesarios para la sección financiera
  const efectivo_total = globalData.dinero?.efectivo || 0;
  const datafono_total = globalData.dinero?.datafono || 0;
  const gastos_total = (globalData.gastos || []).reduce((a: number, b: any) => a + Number(b.monto), 0);
  const propinas_total = globalData.propinas || 0;
  const utilidad = grandTotalVenta - grandTotalCosto - grandTotalComision - gastos_total;

  // Columna izquierda: FALTANTE POR PAGAR
  // (deudas a proveedores = por calcular)
  const deudas: Record<string, number> = {};
  productos.forEach((p: any) => {
    if (p.proveedor && p.proveedor !== '-') {
      const consumoTotal = barrasIds.reduce((sum: number, bId: string) => {
        const bIni = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'inicial').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bRec = globalData.recargas.filter((r: any) => r.evento_id === bId && r.producto_id === p.id && !r.proveedor?.startsWith('RETORNO:')).reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        const bFin = globalData.inventario.filter((i: any) => i.evento_id === bId && i.producto_id === p.id && i.tipo === 'final').reduce((a: number, b: any) => a + Number(b.cantidad), 0);
        return sum + Math.max(0, bIni + bRec - bFin);
      }, 0);
      deudas[p.proveedor] = (deudas[p.proveedor] || 0) + (consumoTotal * (p.costo || 0));
    }
  });

  const totalDeuda = Object.values(deudas).reduce((a: number, b: number) => a + b, 0);

  const startRow = wsBodega.lastRow!.number + 1;

  // Izquierda: desglose deudas proveedores y resumen pago
  wsBodega.getRow(startRow).getCell(1).value = 'FALTANTE POR PAGAR';
  wsBodega.getRow(startRow).getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
  wsBodega.getRow(startRow).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };

  let r = startRow + 1;
  Object.entries(deudas).forEach(([prov, monto]) => {
    wsBodega.getRow(r).getCell(1).value = prov;
    wsBodega.getRow(r).getCell(2).value = monto;
    wsBodega.getRow(r).getCell(2).numFmt = '$#,##0';
    r++;
  });

  wsBodega.getRow(r).getCell(1).value = 'COMISIONES';
  wsBodega.getRow(r).getCell(2).value = grandTotalComision;
  wsBodega.getRow(r).getCell(2).numFmt = '$#,##0';
  r++;

  wsBodega.getRow(r).getCell(1).value = 'PROPINAS';
  wsBodega.getRow(r).getCell(2).value = propinas_total;
  wsBodega.getRow(r).getCell(2).numFmt = '$#,##0';
  r++;

  const totalPagoRow = wsBodega.getRow(r);
  totalPagoRow.getCell(1).value = 'TOTAL';
  totalPagoRow.getCell(2).value = totalDeuda + grandTotalComision + propinas_total;
  totalPagoRow.getCell(2).numFmt = '$#,##0';
  totalPagoRow.font = { bold: true };
  totalPagoRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
  totalPagoRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };

  // Derecha: Efectivo, Datáfono, Gastos, Total, UTILIDAD
  const col = 9; // columna I en adelante
  let rr = startRow + 1;

  const finItems = [
    { label: 'efectivo', val: efectivo_total },
    { label: 'datafono', val: datafono_total },
    { label: 'gastos', val: -gastos_total },
    { label: 'TOTAL', val: efectivo_total + datafono_total - gastos_total },
  ];
  finItems.forEach(item => {
    wsBodega.getRow(rr).getCell(col).value = item.label;
    wsBodega.getRow(rr).getCell(col + 1).value = item.val;
    wsBodega.getRow(rr).getCell(col + 1).numFmt = '$#,##0';
    if (item.label === 'TOTAL') {
      wsBodega.getRow(rr).getCell(col).font = { bold: true };
      wsBodega.getRow(rr).getCell(col + 1).font = { bold: true };
    }
    rr++;
  });

  // Fila de UTILIDAD (destacada en verde)
  const utilRow = wsBodega.getRow(rr);
  utilRow.getCell(col).value = 'UTILIDAD';
  utilRow.getCell(col + 1).value = utilidad;
  utilRow.getCell(col + 1).numFmt = '$#,##0';
  utilRow.font = { bold: true, size: 12 };
  utilRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  utilRow.getCell(col + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };


  // 2. PESTAÑAS POR BARRAS (BARRA X y CORTESIAS X)
  const barras = globalData.relatedEvents.filter((e: any) => !e.nombre.startsWith('BODEGA -'));

  barras.forEach((bEv: any) => {
    const rawBarName = bEv.nombre.split(' - ').pop() || bEv.nombre;
    const barSheetName = `BARRA ${rawBarName}`.substring(0, 31);
    const corSheetName = `CORTESIAS ${rawBarName}`.substring(0, 31);

    const wsBar = workbook.addWorksheet(barSheetName);
    wsBar.addRow([`REPORTE DE BARRA: ${bEv.nombre}`]).font = { size: 14, bold: true };
    wsBar.addRow([]);

    const barHeaders = [
      'Producto', 'Valor', 'Inicial', 'Recarga', 'Cortesia', 'Bajas', 'Final', 'Venta', 'Venta total'
    ];
    const hBar = wsBar.addRow(barHeaders);
    headerStyle(wsBar, hBar.number, barHeaders.length);

    const ORDEN_PICANTE_CAT: Record<string, number> = { gaseosa: 1, agua: 2, cerveza: 3, otro: 4, licor: 5, snack: 6 };
    const categorias = Array.from(new Set(productos.map(p => p.categoria)))
      .sort((a, b) => (ORDEN_PICANTE_CAT[a] ?? 99) - (ORDEN_PICANTE_CAT[b] ?? 99));

    categorias.forEach(cat => {
      const catProds = productos.filter(p => p.categoria === cat);
      const catRow = wsBar.addRow([cat.toUpperCase()]);
      catRow.font = { bold: true };
      catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

      catProds.forEach(p => {
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
        
        const disp = bIni + bRec;
        const consumo = Math.max(0, disp - bFin);
        const vendidoUnd = Math.max(0, consumo - bCor - bPer);
        const ventaValor = vendidoUnd * p.precio;

        wsBar.addRow([
          p.nombre, 
          p.precio, 
          bIni || '', 
          bRec || '', 
          bCor || '', 
          bPer || '', 
          bFin, 
          vendidoUnd, 
          ventaValor
        ]);
      });
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
