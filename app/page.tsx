'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Download, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import JSZip from 'jszip';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Summary {
  total: number;
  success: number;
  failed: number;
}

interface ProcessResult {
  fileName: string;
  id?: string;
  name?: string;
  destination?: string;
  group?: string;
  status: 'success' | 'failed';
  text?: string;
  error?: string;
}

export default function Home() {
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [excelA, setExcelA] = useState<File | null>(null);
  const [excelB, setExcelB] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [idFilter, setIdFilter] = useState('');
  const [contentFilter, setContentFilter] = useState('');

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelAInputRef = useRef<HTMLInputElement>(null);
  const excelBInputRef = useRef<HTMLInputElement>(null);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPdfs(Array.from(e.target.files));
      setError(null);
    }
  };

  const handleExcelAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelA(e.target.files[0]);
      setError(null);
    }
  };

  const handleExcelBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelB(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    try {
      // 1. Parse Excel A (Master with Groups)
      const formDataA = new FormData();
      formDataA.append('excel', excelA!);
      const resA = await fetch('/api/excel', { method: 'POST', body: formDataA });
      if (!resA.ok) throw new Error("Excel A parsing failed.");
      const dataA = await resA.json();

      // 2. Parse Excel B (ID Mappings)
      const formDataB = new FormData();
      formDataB.append('excel', excelB!);
      const resB = await fetch('/api/excel', { method: 'POST', body: formDataB });
      if (!resB.ok) throw new Error("Excel B parsing failed.");
      const dataB = await resB.json();

      // 3. Build ID -> Group Map
      const idToGroupMap = new Map<string, string>();
      
      // We look for common column names for Employee No, ID No, and Group
      dataB.forEach((rowB: any) => {
        const empNo = (rowB['Employee No'] || rowB['EmployeeNo'] || rowB['Emp No'] || rowB['emp_no'] || '').toString().trim();
        const idNo = (rowB['ID No'] || rowB['IDNo'] || rowB['ID Number'] || rowB['id_no'] || '').toString().trim();
        
        if (empNo && idNo) {
          // Find matching group in dataA
          const rowA = dataA.find((r: any) => {
            const aEmpNo = (r['Employee No'] || r['EmployeeNo'] || r['Emp No'] || r['emp_no'] || '').toString().trim();
            return aEmpNo === empNo;
          });
          
          if (rowA) {
            const group = rowA['Group'] || rowA['group'] || rowA['Category'] || rowA['Department'] || 'Uncategorized';
            idToGroupMap.set(idNo, group);
          }
        }
      });

      // 2. Process PDFs in parallel with a limit (batch size 10)
      const zip = new JSZip();
      const localResults: ProcessResult[] = [];
      let successCount = 0;
      let failedCount = 0;

      const BATCH_SIZE = 10;
      for (let i = 0; i < pdfs.length; i += BATCH_SIZE) {
        const batch = pdfs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (file) => {
          try {
            const formData = new FormData();
            formData.append('pdf', file);
            
            const pdfRes = await fetch('/api/pdf', { method: 'POST', body: formData });
            if (!pdfRes.ok) throw new Error("PDF parse fail");
            
            const details = await pdfRes.json();
            
            // Match with joined excel data
            const pdfId = (details.id || '').trim();
            const group = idToGroupMap.get(pdfId) || 'Uncategorized';

            // Add to ZIP
            const pdfBuffer = await file.arrayBuffer();
            zip.folder(group)?.file(file.name, pdfBuffer);

            localResults.push({
              fileName: file.name,
              id: details.id,
              name: details.name,
              destination: details.destination,
              group: group,
              text: details.text,
              status: 'success'
            });
            successCount++;
          } catch (err: any) {
            localResults.push({
              fileName: file.name,
              status: 'failed',
              error: "Extraction error"
            });
            failedCount++;
          }
        }));
        
        const currentProgress = Math.min(100, Math.round(((i + batch.length) / pdfs.length) * 100));
        setProgress(currentProgress);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      setZipBlob(blob);
      setSummary({ total: pdfs.length, success: successCount, failed: failedCount });
      setResults(localResults);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadZip = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gatepass_categorized_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredResults = results.filter(res => {
    const nameMatch = (res.name || '').toLowerCase().includes(nameFilter.toLowerCase());
    const destMatch = (res.destination || '').toLowerCase().includes(destFilter.toLowerCase());
    const idMatch = (res.id || '').toLowerCase().includes(idFilter.toLowerCase());
    const contentMatch = (res.text || '').toLowerCase().includes(contentFilter.toLowerCase());
    return nameMatch && destMatch && idMatch && contentMatch;
  });

  const downloadFilteredZip = async () => {
    if (filteredResults.length === 0) return;
    const zip = new JSZip();
    
    // We need the original PDF files to rebuild the zip
    // Since we don't store buffers in 'results', we'll match by fileName with the 'pdfs' state
    for (const res of filteredResults) {
      const originalFile = pdfs.find(p => p.name === res.fileName);
      if (originalFile) {
        const buffer = await originalFile.arrayBuffer();
        zip.folder(res.group || 'Uncategorized')?.file(res.fileName, buffer);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_gatepass_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 p-6 md:p-12 font-sans overflow-x-hidden selection:bg-indigo-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[160px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[160px] -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 transition-all">
        <header className="mb-16 text-center animate-in fade-in zoom-in duration-1000">
          <div className="inline-block px-4 py-1.5 mb-6 text-[10px] font-black tracking-widest uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
            AI-Powered Document Categorization
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            GatePass Automator
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Process multiple PDFs and organize them instantly using Excel mappings.
          </p>
        </header>

        <section className="grid lg:grid-cols-2 gap-8 mb-12 animate-in slide-in-from-bottom-5 duration-700">
          {/* PDF Input */}
          <div 
            onClick={() => pdfInputRef.current?.click()}
            className={cn(
              "group relative overflow-hidden bg-white/[0.03] border-2 border-dashed border-slate-700/50 rounded-3xl p-10 hover:border-indigo-500/50 hover:bg-white/[0.05] transition-all cursor-pointer text-center",
              pdfs.length > 0 && "border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_50px_rgba(99,102,241,0.1)]"
            )}
          >
            <input type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfChange} ref={pdfInputRef} />
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <FileText className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">GatePass PDFs</h3>
              <p className="text-slate-500 text-sm italic">
                {pdfs.length > 0 ? `${pdfs.length} files staged` : "Drop PDF files or click to browse"}
              </p>
            </div>
          </div>

          {/* Excel Input A */}
          <div 
            onClick={() => excelAInputRef.current?.click()}
            className={cn(
              "group relative overflow-hidden bg-white/[0.03] border-2 border-dashed border-slate-700/50 rounded-3xl p-8 hover:border-emerald-500/50 hover:bg-white/[0.05] transition-all cursor-pointer text-center",
              excelA && "border-emerald-500/40 bg-emerald-500/5"
            )}
          >
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelAChange} ref={excelAInputRef} />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">Master Excel (Groups)</h3>
              <p className="text-slate-500 text-xs italic">
                {excelA ? excelA.name : "Employee No + Groups"}
              </p>
            </div>
          </div>

          {/* Excel Input B */}
          <div 
            onClick={() => excelBInputRef.current?.click()}
            className={cn(
              "group relative overflow-hidden bg-white/[0.03] border-2 border-dashed border-slate-700/50 rounded-3xl p-8 hover:border-blue-500/50 hover:bg-white/[0.05] transition-all cursor-pointer text-center",
              excelB && "border-blue-500/40 bg-blue-500/5"
            )}
          >
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelBChange} ref={excelBInputRef} />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                <FileSpreadsheet className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">ID Mapping Excel</h3>
              <p className="text-slate-500 text-xs italic">
                {excelB ? excelB.name : "Employee No + ID No"}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 mb-12 flex items-center gap-4 animate-in fade-in duration-300">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            <p className="text-rose-400 font-semibold">{error}</p>
          </div>
        )}

        {isProcessing && (
          <div className="mb-12 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-indigo-400 font-black uppercase text-xs tracking-widest">Processing Cloud</h4>
              <span className="text-3xl font-black">{progress}%</span>
            </div>
            <div className="w-full h-4 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50 p-1">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] animate-gradient rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium italic">Analyzing documents & building ZIP...</span>
              </div>
            </div>
          </div>
        )}

        {!isProcessing && !summary && (
          <div className="flex justify-center mb-24">
            <button
              onClick={handleSubmit}
              disabled={pdfs.length === 0 || !excelA || !excelB}
              className={cn(
                "relative flex items-center gap-4 px-16 py-6 rounded-3xl font-black text-xl transition-all active:scale-95 shadow-2xl",
                (pdfs.length === 0 || !excelA || !excelB)
                  ? "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/40 text-white"
              )}
            >
              Start Categorization
            </button>
          </div>
        )}

        {summary && (
          <section className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 mb-24">
            <div className="grid grid-cols-3 gap-6">
              <Card label="Processed" value={summary.total.toString()} icon={<Upload className="text-slate-500" />} />
              <Card label="Success" value={summary.success.toString()} icon={<CheckCircle className="text-emerald-500" />} className="bg-emerald-500/5 border-emerald-500/20" />
              <Card label="Error" value={summary.failed.toString()} icon={<XCircle className="text-rose-500" />} className="bg-rose-500/5 border-rose-500/20" />
            </div>

            <div className="flex justify-center">
              <button
                onClick={downloadZip}
                className="group relative flex items-center gap-4 px-12 py-7 bg-white text-slate-950 font-black rounded-3xl hover:bg-indigo-500 hover:text-white transition-all shadow-[0_30px_60px_-10px_rgba(255,255,255,0.2)] hover:shadow-indigo-500/50"
              >
                <Download className="w-7 h-7 group-hover:-translate-y-1 transition-transform duration-300" />
                Download Categorized Package
              </button>
            </div>

            {/* Results List */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-3xl">
              <div className="p-8 border-b border-white/[0.05] flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                  Audit Trail
                </h3>
                
                <div className="flex flex-wrap items-center gap-4">
                  {/* ID Filter */}
                  <div className="relative group/input">
                    <input 
                      type="text" 
                      placeholder="Search ID..." 
                      value={idFilter}
                      onChange={(e) => setIdFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-2.5 text-xs font-bold focus:outline-none focus:border-purple-500/50 transition-all w-32"
                    />
                  </div>
                  
                  {/* Name Filter */}
                  <div className="relative group/input">
                    <input 
                      type="text" 
                      placeholder="Search Name..." 
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all w-48"
                    />
                  </div>
                  
                  {/* Destination Filter */}
                  <div className="relative group/input">
                    <input 
                      type="text" 
                      placeholder="Search Destination..." 
                      value={destFilter}
                      onChange={(e) => setDestFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500/50 transition-all w-48"
                    />
                  </div>
                  
                  {/* Content Filter */}
                  <div className="relative group/input">
                    <input 
                      type="text" 
                      placeholder="Role / Job Title / Anything..." 
                      value={contentFilter}
                      onChange={(e) => setContentFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-2.5 text-xs font-bold focus:outline-none focus:border-amber-500/50 transition-all w-60"
                    />
                  </div>

                  {filteredResults.length < results.length && filteredResults.length > 0 && (
                    <button 
                      onClick={downloadFilteredZip}
                      className="flex items-center gap-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all border border-indigo-500/20"
                    >
                      <Download className="w-4 h-4" />
                      Download ({filteredResults.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto scrollbar-none">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[9px] font-black uppercase text-slate-500 tracking-widest sticky top-0 z-20">
                    <tr>
                      <th className="px-8 py-5">Document</th>
                      <th className="px-8 py-5">Extraction</th>
                      <th className="px-8 py-5">Destination Path</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredResults.map((res, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-300 max-w-[200px] truncate">{res.fileName}</div>
                        </td>
                        <td className="px-8 py-6">
                          {res.id ? (
                            <div className="flex flex-col">
                              <span className="text-indigo-400 font-mono text-xs">{res.id}</span>
                              <span className="text-[10px] uppercase font-black opacity-40">{res.name}</span>
                            </div>
                          ) : <span className="text-slate-600">-</span>}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-medium italic text-sm">{res.destination || "n/a"}</span>
                            <span className="w-4 h-px bg-slate-700" />
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                              res.group === 'Uncategorized' ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-400"
                            )}>{res.group}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {res.status === 'success' ? (
                            <div className="inline-flex items-center gap-2 text-emerald-500 font-bold text-xs">
                              <CheckCircle className="w-4 h-4" />
                              Ready
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-rose-500 font-bold text-xs">
                              <XCircle className="w-4 h-4" />
                              Failed
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s infinite linear;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}

function Card({ label, value, icon, className }: { label: string, value: string, icon: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-white/[0.03] border border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center transition-all hover:scale-[1.02] shadow-xl", className)}>
      <div className="mb-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-inner">{icon}</div>
      <div className="text-4xl font-black mb-1 tabular-nums tracking-tighter">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">{label}</div>
    </div>
  );
}
