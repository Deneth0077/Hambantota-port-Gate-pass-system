import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/pdf-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File;
    if (!file) return NextResponse.json({ error: 'No PDF' }, { status: 400 });
    const details = await parsePdf(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(details);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
