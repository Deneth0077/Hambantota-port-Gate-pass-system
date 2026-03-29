import { ExcelRow } from './excel-parser';

export interface CategorizedPdf {
  fileName: string;
  id: string;
  name: string;
  destination: string;
  group: string;
  status: 'success' | 'failed';
  error?: string;
}

export function findGroup(destination: string, excelData: ExcelRow[]): string {
  // We try a case-insensitive match for the destination.
  const normalizedDest = (destination || '').trim().toLowerCase();
  
  const match = excelData.find(d => 
    d.destination.toLowerCase() === normalizedDest
  );
  
  if (match) return match.group;
  
  // If no direct match, could try partial matches or just return Uncategorized.
  return 'Uncategorized';
}
