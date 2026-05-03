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
  productos: { id: string; nombre: string; costo: number }[],
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

  const tableHeader = ['PRODUCTO', 'PRESENTACIÓN', 'PRECIO', 'INICIAL', 'RECARGAS', 'CORTESÍAS', 'DESC.', 'BAJAS', 'FINAL', 'VENDIDO', 'INGRESO BRUTO', '', 'COSTO UNIT', 'COSTO TOTAL', 'PROVEEDOR'];
  const headerRow = ws.addRow(tableHeader);
  headerStyle(ws, headerRow.number, tableHeader.length);

  const categorias = [...new Set(resumen.map(p => p.categoria))];
  categorias.forEach(cat => {
    const catRow = ws.addRow([`>>> CATEGORÍA: ${cat.toUpperCase()}`]);
    catRow.font = { bold: true };
    catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    
    const prods = resumen.filter(p => p.categoria === cat);
    prods.forEach(p => {
      // Intentar obtener el proveedor del inventario inicial o de la primera recarga
      ws.addRow([
        p.nombre, p.unidad, p.precio, p.ini, p.rec, p.cor, p.desc || 0, p.per, p.fin, p.vendido, p.ingresoEsperado, '', p.costo, p.vendido * p.costo, p.proveedor || '-',
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
  if (cortesias.length > 0) createDetailSheet('Cortesías', ['HORA', 'PRODUCTO', 'CANT', 'PARA', 'MOTIVO'], cortesias.map(c => [c.hora, pName(c.producto_id), c.cantidad, c.persona, c.motivo]));
  if (perdidas.length > 0) createDetailSheet('Bajas', ['HORA', 'PRODUCTO', 'CANT', 'MOTIVO'], perdidas.map(p => [p.hora, pName(p.producto_id), p.cantidad, p.motivo]));
  if (descuentos.length > 0) createDetailSheet('Descuentos', ['HORA', 'PRODUCTO', 'CANT', '%', 'DESC', 'MOTIVO'], descuentos.map(d => [d.hora, pName(d.producto_id), d.cantidad, d.porcentaje, d.valor_descontado, d.motivo]));

  // ═══════════════════════════════════════════
  // PESTAÑA: LIQUIDACIÓN PROVEEDORES
  // ═══════════════════════════════════════════
  const wsp = workbook.addWorksheet('LIQUIDACIÓN');
  wsp.addRow(['BARRAPRO - LIQUIDACIÓN DE CUENTAS POR PROVEEDOR']).font = { size: 14, bold: true };
  wsp.addRow(['Evento:', nombreEvento]);
  wsp.addRow(['Fecha:', fecha]);
  wsp.addRow([]);

  // Consolidar datos por proveedor
  const provDetails: Record<string, Record<string, { ini: number, rec: number, costo: number, nombre: string }>> = {};
  
  // 1. Del Inventario Inicial
  resumen.forEach(p => {
    if (p.proveedor && p.proveedor !== '-') {
      if (!provDetails[p.proveedor]) provDetails[p.proveedor] = {};
      if (!provDetails[p.proveedor][p.id]) provDetails[p.proveedor][p.id] = { ini: 0, rec: 0, costo: p.costo, nombre: p.nombre };
      provDetails[p.proveedor][p.id].ini = p.ini;
    }
  });

  // 2. De las Recargas
  recargas.forEach(r => {
    if (r.proveedor && r.proveedor !== '-') {
      if (!provDetails[r.proveedor]) provDetails[r.proveedor] = {};
      const p = productos.find(x => x.id === r.producto_id);
      if (p) {
        if (!provDetails[r.proveedor][r.producto_id]) provDetails[r.proveedor][r.producto_id] = { ini: 0, rec: 0, costo: p.costo, nombre: p.nombre };
        provDetails[r.proveedor][r.producto_id].rec += r.cantidad;
      }
    }
  });

  // Renderizar tablas por proveedor
  Object.entries(provDetails).forEach(([provName, items]) => {
    const titleRow = wsp.addRow([`PROVEEDOR: ${provName.toUpperCase()}`]);
    titleRow.font = { bold: true, size: 12 };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

    const pHeader = ['PRODUCTO', 'STOCK INICIAL', 'RECARGAS', 'TOTAL UNDS', 'COSTO UNIT', 'VALOR A PAGAR'];
    const phRow = wsp.addRow(pHeader);
    headerStyle(wsp, phRow.number, pHeader.length);

    let totalProv = 0;
    Object.values(items).forEach(item => {
      const totalUnds = item.ini + item.rec;
      const subtotal = totalUnds * item.costo;
      if (totalUnds > 0) {
        totalProv += subtotal;
        wsp.addRow([item.nombre, item.ini, item.rec, totalUnds, item.costo, subtotal]);
      }
    });

    const fRow = wsp.addRow(['TOTAL A LIQUIDAR CON ESTE PROVEEDOR', '', '', '', '', totalProv]);
    fRow.font = { bold: true };
    fRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Amarillo para el total
    
    wsp.addRow([]); // Espacio entre proveedores
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
