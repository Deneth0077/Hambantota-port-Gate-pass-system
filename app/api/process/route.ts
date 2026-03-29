import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/pdf-parser';
import { parseExcel } from '@/lib/excel-parser';
import { findGroup } from '@/lib/matcher';
import JSZip from 'jszip';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfFiles = formData.getAll('pdfs') as File[];
    const excelFile = formData.get('excel') as File;

    if (!pdfFiles.length || !excelFile) {
      return NextResponse.json({ error: 'Missing PDFs or Excel file' }, { status: 400 });
    }

    // 1. Parse Excel
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const excelData = parseExcel(excelBuffer);

    // 2. Process all PDFs
    const zip = new JSZip();
    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    // We process sequentially or in batches to avoid CPU/RAM issues with 200 PDFs
    for (const file of pdfFiles) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const details = await parsePdf(buffer);
        const group = findGroup(details.destination, excelData);
        
        // Add to ZIP under the group folder
        const folder = zip.folder(group);
        if (folder) {
          folder.file(file.name, buffer);
        }

        results.push({
          fileName: file.name,
          id: details.id,
          name: details.name,
          destination: details.destination,
          group: group,
          status: 'success'
        });
        successCount++;
      } catch (err: any) {
        console.error(`Failed to process ${file.name}:`, err);
        results.push({
          fileName: file.name,
          status: 'failed',
          error: err.message || 'Parsing error'
        });
        failedCount++;
      }
    }

    // 3. Generate ZIP (Base64 for response, though Blob is better for large files)
    // To handle 200 files, we might want to return the zip as a stream, 
    // but for the UI to show summary + download, we'll return JSON.
    const zipBase64 = await zip.generateAsync({ type: 'base64' });

    return NextResponse.json({
      summary: {
        total: pdfFiles.length,
        success: successCount,
        failed: failedCount,
      },
      results,
      zip: zipBase64
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
