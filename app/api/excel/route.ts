import { NextRequest, NextResponse } from 'next/server';
import { parseExcel } from '@/lib/excel-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('excel') as File;
    if (!file) return NextResponse.json({ error: 'No Excel file provided' }, { status: 400 });
    const data = parseExcel(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Excel processing failed' }, { status: 500 });
  }
}
