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
  designation?: string;
  destination?: string;
  group?: string;
  status: 'success' | 'failed';
  text?: string;
  error?: string;
}

export default function Home() {
  const [pdfs, setPdfs] = useState<File[]>([]);
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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPdfs(Array.from(e.target.files));
      setError(null);
      setSummary(null);
      setResults([]);
    }
  };

  const handleSubmit = async () => {
    try {
      if (pdfs.length === 0) return;
      setIsProcessing(true);
      setProgress(0);
      setError(null);

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
            
            // Current user wants to filter by destination
            const destination = details.destination || 'Uncategorized';

            // Add to ZIP (grouped by destination)
            const pdfBuffer = await file.arrayBuffer();
            zip.folder(destination)?.file(file.name, pdfBuffer);

            localResults.push({
              fileName: file.name,
              id: details.id,
              name: details.name,
              designation: details.designation,
              destination: destination,
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
    link.download = `gatepass_processed_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredResults = results.filter(res => {
    const nameMatch = (res.name || '').toLowerCase().includes(nameFilter.trim().toLowerCase());
    const desigMatch = (res.designation || '').toLowerCase().includes(destFilter.trim().toLowerCase()); // Using destFilter state for Designation
    const idMatch = (res.id || '').toLowerCase().includes(idFilter.trim().toLowerCase());
    const contentMatch = (res.text || '').toLowerCase().includes(contentFilter.trim().toLowerCase());
    return nameMatch && desigMatch && idMatch && contentMatch;
  });

  const downloadFilteredZip = async () => {
    if (filteredResults.length === 0) return;
    const zip = new JSZip();
    
    for (const res of filteredResults) {
      const originalFile = pdfs.find(p => p.name === res.fileName);
      if (originalFile) {
        const buffer = await originalFile.arrayBuffer();
        // Organize by designation in the zip
        zip.folder(res.designation || 'Uncategorized')?.file(res.fileName, buffer);
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
            PDF Processor & GatePass Filter
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            GatePass Automator
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Upload multiple PDFs, extract data automatically, and filter by Name, NIC/PP, or Designation.
          </p>
        </header>

        <section className="flex flex-col items-center mb-12 animate-in slide-in-from-bottom-5 duration-700">
          {/* PDF Input */}
          <div 
            onClick={() => pdfInputRef.current?.click()}
            className={cn(
              "group relative overflow-hidden bg-white/[0.03] border-2 border-dashed border-slate-700/50 rounded-3xl p-16 hover:border-indigo-500/50 hover:bg-white/[0.05] transition-all cursor-pointer text-center w-full max-w-2xl",
              pdfs.length > 0 && "border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_50px_rgba(99,102,241,0.1)]"
            )}
          >
            <input type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfChange} ref={pdfInputRef} />
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <FileText className="w-12 h-12 text-indigo-400" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Upload GatePass PDFs</h3>
              <p className="text-slate-500 text-lg italic">
                {pdfs.length > 0 ? `${pdfs.length} files selected` : "Drop PDF files or click to browse (supports up to 200+ files)"}
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
              <h4 className="text-indigo-400 font-black uppercase text-xs tracking-widest">Processing PDFs</h4>
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
                <span className="text-sm font-medium italic">Analyzing documents...</span>
              </div>
            </div>
          </div>
        )}

        {!isProcessing && !summary && pdfs.length > 0 && (
          <div className="flex justify-center mb-24">
            <button
              onClick={handleSubmit}
              className="relative flex items-center gap-4 px-16 py-6 bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/40 text-white rounded-3xl font-black text-xl transition-all active:scale-95 shadow-2xl"
            >
              Start Processing
            </button>
          </div>
        )}

        {summary && (
          <section className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 mb-24">
            <div className="grid grid-cols-3 gap-6">
              <Card label="Total PDFs" value={summary.total.toString()} icon={<Upload className="text-slate-500" />} />
              <Card label="Success" value={summary.success.toString()} icon={<CheckCircle className="text-emerald-500" />} className="bg-emerald-500/5 border-emerald-500/20" />
              <Card label="Errors" value={summary.failed.toString()} icon={<XCircle className="text-rose-500" />} className="bg-rose-500/5 border-rose-500/20" />
            </div>

            <div className="flex justify-center items-center gap-6">
              <button
                onClick={downloadZip}
                className="group relative flex items-center gap-4 px-10 py-6 bg-white text-slate-950 font-black rounded-3xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl"
              >
                <Download className="w-6 h-6 group-hover:-translate-y-1 transition-transform duration-300" />
                Download All (ZIP)
              </button>
              
              {filteredResults.length < results.length && filteredResults.length > 0 && (
                <button
                  onClick={downloadFilteredZip}
                  className="group relative flex items-center gap-4 px-10 py-6 bg-emerald-600 text-white font-black rounded-3xl hover:bg-emerald-500 transition-all shadow-xl"
                >
                  <Download className="w-6 h-6 group-hover:-translate-y-1 transition-transform duration-300" />
                  Download Filtered ({filteredResults.length})
                </button>
              )}
            </div>

            {/* Results & Filtering */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-3xl">
              <div className="p-8 border-b border-white/[0.05] flex flex-col gap-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                    Processed Gate Passes
                  </h3>
                  <div className="text-xs font-black uppercase text-slate-500 tracking-widest">
                    Showing {filteredResults.length} of {results.length} files
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* ID Filter */}
                  <div className="relative group/input">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-2 tracking-widest">NIC / PP No</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 98056..." 
                      value={idFilter}
                      onChange={(e) => setIdFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                  </div>
                  
                  {/* Name Filter */}
                  <div className="relative group/input">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-2 tracking-widest">Name</label>
                    <input 
                      type="text" 
                      placeholder="Search name..." 
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                  </div>
                  
                  {/* Designation Filter */}
                  <div className="relative group/input">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-2 tracking-widest">Designation</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ELECTRICAL TECHNICIAN" 
                      value={destFilter}
                      onChange={(e) => setDestFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                  </div>
                  
                  {/* Content Filter */}
                  <div className="relative group/input">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-2 tracking-widest">Keywords</label>
                    <input 
                      type="text" 
                      placeholder="Any text in PDF..." 
                      value={contentFilter}
                      onChange={(e) => setContentFilter(e.target.value)}
                      className="bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto scrollbar-none">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[9px] font-black uppercase text-slate-500 tracking-widest sticky top-0 z-20">
                    <tr>
                      <th className="px-8 py-5">Document</th>
                      <th className="px-8 py-5 text-center">NIC / PP NO</th>
                      <th className="px-8 py-5 text-center">Name</th>
                      <th className="px-8 py-5 text-center">Designation</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredResults.map((res, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors group/row">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-600 group-hover/row:text-indigo-400 transition-colors" />
                            <div className="font-bold text-slate-300 max-w-[200px] truncate">{res.fileName}</div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-3 py-1 rounded-lg">{res.id || "N/A"}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-slate-300 font-bold uppercase text-[11px] tracking-wide">{res.name || "Unknown"}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-emerald-400 font-medium italic text-sm">{res.designation || "N/A"}</span>
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
