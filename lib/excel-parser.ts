import * as XLSX from 'xlsx';

/**
 * Reads the Excel file and extracts data as JSON.
 */
export function parseExcel(buffer: Buffer): any[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<any>(sheet);
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}
