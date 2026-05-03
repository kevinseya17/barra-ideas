
const ExcelJS = require('exceljs');
const path = require('path');

async function readExcel() {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), 'referencia david', 'Booth Case 18-04-2026 (1).xlsx');
  
  try {
    await workbook.xlsx.readFile(filePath);
    console.log('--- ESTRUCTURA DEL EXCEL DE DAVID ---');
    workbook.worksheets.forEach(sheet => {
      console.log(`Pestaña: ${sheet.name}`);
      console.log('Primeras 5 filas:');
      sheet.getRows(1, 10).forEach(row => {
        if (row && row.values) {
          console.log(JSON.stringify(row.values.slice(1)));
        }
      });
      console.log('------------------------------------');
    });
  } catch (err) {
    console.error('Error al leer el Excel:', err.message);
  }
}

readExcel();
