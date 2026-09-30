/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Download,
  CheckCircle2,
  Loader2,
  Plus,
  Zap,
  Trash2,
  Gauge,
  Archive,
  AlertCircle,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import {
  analyzeFileDpi,
  optimizePdfFileToDpi,
  DpiAnalysisResult,
  OptimizationResultItem,
} from '../lib/pdfDpiOptimizer';
import { downloadBytes, downloadFilesAsZip } from '../lib/pdfTools';
import { GlobalPdfDropOverlay } from './GlobalPdfDropOverlay';

interface DpiCompressToolProps {
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function DpiCompressTool({ onBack }: DpiCompressToolProps) {
  const [analyzedItems, setAnalyzedItems] = useState<DpiAnalysisResult[]>([]);
  const [targetDpi, setTargetDpi] = useState<number>(200);
  const [jpegQuality, setJpegQuality] = useState<number>(0.82);

  // Estados de procesamiento
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [currentFilePageProgress, setCurrentFilePageProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<OptimizationResultItem[] | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Agregar nuevos archivos y analizarlos secuencialmente
  const addFiles = async (filesList: FileList | File[] | null) => {
    if (!filesList) return;
    const pdfFiles = Array.from(filesList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    setErrorMsg(null);
    setResults(null);

    // Creamos placeholders de análisis visibles inmediatamente
    const placeholders: DpiAnalysisResult[] = pdfFiles.map((file, i) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${i}-${Math.random()}`,
      file,
      fileName: file.name,
      originalSize: file.size,
      totalPages: 0,
      maxDetectedDpi: 0,
      avgDetectedDpi: 0,
      needsDownsample: false,
      isAnalyzing: true,
      pagesInfo: [],
    }));

    setAnalyzedItems((prev) => [...prev, ...placeholders]);

    // Analizamos cada archivo de forma secuencial
    for (const item of placeholders) {
      try {
        const analysis = await analyzeFileDpi(item.file, targetDpi + 25);
        setAnalyzedItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...analysis, id: item.id, isAnalyzing: false } : it))
        );
      } catch (err) {
        console.error('Error analizando archivo:', err);
        const fallbackDpi = item.file.size > 2 * 1024 * 1024 ? 1200 : 200;
        setAnalyzedItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  isAnalyzing: false,
                  maxDetectedDpi: fallbackDpi,
                  needsDownsample: fallbackDpi > targetDpi + 25,
                }
              : it
          )
        );
      }
    }
  };

  const removeFile = (id: string) => {
    setAnalyzedItems((prev) => prev.filter((it) => it.id !== id));
    setResults(null);
  };

  const clearAll = () => {
    setAnalyzedItems([]);
    setResults(null);
    setErrorMsg(null);
    setCurrentFilePageProgress(null);
  };

  // Ejecución del lote de optimización
  const handleProcessBatch = async () => {
    if (analyzedItems.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setResults(null);
    setCurrentProcessingIndex(0);

    const processedResults: OptimizationResultItem[] = [];

    try {
      for (let i = 0; i < analyzedItems.length; i++) {
        setCurrentProcessingIndex(i);
        const item = analyzedItems[i];

        setCurrentFilePageProgress({ current: 0, total: item.totalPages || 1 });

        const resultItem = await optimizePdfFileToDpi(
          item.file,
          item,
          targetDpi,
          jpegQuality,
          (page, total) => {
            setCurrentFilePageProgress({ current: page, total });
          }
        );

        processedResults.push(resultItem);
      }

      setResults(processedResults);
    } catch (err: any) {
      console.error('Error en lote:', err);
      setErrorMsg(err.message || 'Ocurrió un error al procesar el lote.');
    } finally {
      setIsProcessing(false);
      setCurrentFilePageProgress(null);
    }
  };

  // Descarga del paquete completo .ZIP con los nombres exactos originales
  const handleDownloadAllZip = async () => {
    if (!results || results.length === 0) return;
    try {
      setIsZipping(true);
      const usedNames = new Set<string>();
      const filesForZip = results.map((res) => {
        let name = res.fileName;
        if (usedNames.has(name.toLowerCase())) {
          const extMatch = name.match(/^(.*?)(\.[^.]*)?$/);
          const base = extMatch?.[1] || name;
          const ext = extMatch?.[2] || '';
          let counter = 1;
          while (usedNames.has(`${base} (${counter})${ext}`.toLowerCase())) {
            counter++;
          }
          name = `${base} (${counter})${ext}`;
        }
        usedNames.add(name.toLowerCase());
        return {
          name,
          bytes: res.bytes,
        };
      });
      await downloadFilesAsZip(filesForZip, `documentos_${targetDpi}dpi_${results.length}_archivos.zip`);
    } catch (err: any) {
      setErrorMsg('No se pudo generar el archivo ZIP: ' + (err.message || ''));
    } finally {
      setIsZipping(false);
    }
  };

  // Descarga individual con nombre exacto
  const handleDownloadSingle = (item: OptimizationResultItem) => {
    downloadBytes(item.bytes, item.fileName);
  };

  // Métricas acumuladas (calculadas dinámicamente según el targetDpi elegido)
  const countNeedOptimization = analyzedItems.filter(
    (i) => !i.isAnalyzing && i.maxDetectedDpi > targetDpi + 25
  ).length;
  const countOptimal = analyzedItems.filter(
    (i) => !i.isAnalyzing && i.maxDetectedDpi <= targetDpi + 25
  ).length;
  const totalOriginalBytes = analyzedItems.reduce((acc, it) => acc + it.originalSize, 0);

  const totalFinalBytes = results
    ? results.reduce((acc, it) => acc + it.finalSize, 0)
    : 0;
  const savedBytes = results ? Math.max(0, totalOriginalBytes - totalFinalBytes) : 0;
  const percentSaved =
    results && totalOriginalBytes > 0
      ? Math.round((savedBytes / totalOriginalBytes) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center relative">
      <GlobalPdfDropOverlay
        onFileDrop={(file) => addFiles([file])}
        onFilesDrop={(files) => addFiles(files)}
        title="Soltá los documentos acá"
        description="Detectaremos automáticamente su resolución DPI."
      />

      {/* Top Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Panel principal</span>
        </button>

        {analyzedItems.length > 0 && !isProcessing && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-2 py-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar lista</span>
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Gauge className="w-5 h-5" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Normalizador Inteligente a 200 DPI
              </h1>
              {analyzedItems.length > 0 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900">
                  {analyzedItems.length} {analyzedItems.length === 1 ? 'documento' : 'documentos'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Detecta escaneos accidentales a 1200 DPI, reduce a 200 DPI y <strong>mantiene 100% intactos</strong> los que ya son livianos o están a 200 DPI.
            </p>
          </div>

          {analyzedItems.length > 0 && !isProcessing && (
            <label
              htmlFor="dpi-upload-more"
              className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar más archivos</span>
              <input
                id="dpi-upload-more"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Empty Upload State */}
        {analyzedItems.length === 0 ? (
          <label
            htmlFor="dpi-upload-input"
            className="block w-full py-16 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl bg-white dark:bg-slate-900 hover:bg-teal-50/20 dark:hover:bg-teal-950/10 cursor-pointer transition-colors text-center group shadow-2xs"
          >
            <Upload className="w-10 h-10 text-teal-600 mx-auto mb-3 transition-transform group-hover:-translate-y-1" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Subí o arrastrá todos los documentos escaneados acá
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Podés subir todo junto (los de 1200 DPI y los de 200 DPI). La app clasificará cada uno y al finalizar te entregará todo con sus nombres exactos.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800">
              <Zap className="w-3.5 h-3.5" />
              <span>Soporta lotes múltiples con nombres originales intactos</span>
            </div>
            <input
              id="dpi-upload-input"
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-4">

            {/* Panel de Resumen y Ajustes de Normalización */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold font-mono">
                  {countNeedOptimization}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    A reducir a 200 DPI
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Escaneos a 600–1200 DPI
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold font-mono">
                  {countOptimal}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Ya en 200 DPI / Livianos
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Se conservan 100% intactos
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pl-3">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block text-right">
                    Peso total original:
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm block text-right">
                    {formatBytes(totalOriginalBytes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Ajustes de Calidad */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span className="font-semibold">Resolución objetivo:</span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setTargetDpi(150)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] cursor-pointer transition-colors ${
                      targetDpi === 150
                        ? 'bg-teal-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    150 DPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDpi(200)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] cursor-pointer transition-colors ${
                      targetDpi === 200
                        ? 'bg-teal-600 text-white font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    200 DPI (Estándar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDpi(300)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] cursor-pointer transition-colors ${
                      targetDpi === 300
                        ? 'bg-teal-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    300 DPI
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                <HelpCircle className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>
                  Los documentos &le; {targetDpi} DPI no se tocarán. Solo se remuestrean los que excedan {targetDpi} DPI.
                </span>
              </div>
            </div>

            {/* Lista de Documentos Analizados */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                {analyzedItems.map((item, idx) => {
                  const isHighDpi = item.maxDetectedDpi > targetDpi + 25;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors gap-3"
                    >
                      {/* Izquierda: Índice, ícono, nombre */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                          #{idx + 1}
                        </span>

                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />

                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                            title={item.fileName}
                          >
                            {item.fileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span>{formatBytes(item.originalSize)}</span>
                            {item.totalPages > 0 && (
                              <>
                                <span>•</span>
                                <span>{item.totalPages} págs</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Centro / Derecha: Badge de Detección */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.isAnalyzing ? (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                            <span>Analizando...</span>
                          </span>
                        ) : isHighDpi ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              ~{item.maxDetectedDpi} DPI
                            </span>
                            <span className="hidden md:inline text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                              &rarr; Bajar a {targetDpi} DPI
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {item.maxDetectedDpi > 0 ? `~${item.maxDetectedDpi} DPI` : 'Liviano / 200 DPI'}
                            </span>
                            <span className="hidden md:inline text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                              Se mantiene original
                            </span>
                          </div>
                        )}

                        {!isProcessing && (
                          <button
                            type="button"
                            onClick={() => removeFile(item.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Quitar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Barra de Progreso en Vivo */}
            {isProcessing && (
              <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    <span>
                      Procesando archivo {currentProcessingIndex + 1} de {analyzedItems.length}...
                    </span>
                  </span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-sm">
                    {Math.round(((currentProcessingIndex + 1) / analyzedItems.length) * 100)}%
                  </span>
                </div>

                {/* Barra general */}
                <div className="w-full h-2.5 bg-teal-150 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-200 ease-out rounded-full"
                    style={{
                      width: `${Math.round(((currentProcessingIndex + 1) / analyzedItems.length) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate">
                  <span className="truncate">
                    {analyzedItems[currentProcessingIndex]?.fileName}
                  </span>
                  {currentFilePageProgress && (
                    <span className="shrink-0 ml-2">
                      Foja {currentFilePageProgress.current} de {currentFilePageProgress.total}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Resultados y Descarga */}
            {results && results.length > 0 ? (
              <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                
                {/* Cabecera de éxito */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200">
                        ¡Lote procesado exitosamente!
                      </h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Todos los documentos conservan sus nombres exactos originales.
                      </p>
                    </div>
                  </div>

                  {/* Resumen de ahorro */}
                  {savedBytes > 0 && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Ahorro de espacio:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        -{formatBytes(savedBytes)} ({percentSaved}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Métricas antes y después */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] text-slate-500 uppercase block font-medium">Archivos totales</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {results.length}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] text-slate-500 uppercase block font-medium">Reducidos a {targetDpi} DPI</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {results.filter((r) => r.wasDownsampled).length}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] text-slate-500 uppercase block font-medium">Intactos (ya en 200 DPI)</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {results.filter((r) => !r.wasDownsampled).length}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] text-slate-500 uppercase block font-medium">Peso final total</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {formatBytes(totalFinalBytes)}
                    </span>
                  </div>
                </div>

                {/* Botón principal de Descarga en ZIP con nombres exactos */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isZipping}
                    onClick={handleDownloadAllZip}
                    className="flex-1 py-3.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isZipping ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Comprimiendo archivo ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        <span>Descargar TODO en un solo archivo .ZIP</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResults(null);
                      setAnalyzedItems([]);
                    }}
                    className="py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Procesar otro lote
                  </button>
                </div>

                {/* Lista individual desplegable de archivos listos para descargar uno a uno si lo desean */}
                <div className="mt-3 border-t border-emerald-200 dark:border-emerald-800 pt-3">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    O descargá individualmente con su nombre original:
                  </p>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    {results.map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {res.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {res.wasDownsampled ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Reducido: {formatBytes(res.originalSize)} &rarr; {formatBytes(res.finalSize)}
                              </span>
                            ) : (
                              <span>Conservado original: {formatBytes(res.originalSize)}</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(res)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-slate-700 dark:text-slate-300 hover:text-teal-600 transition-colors cursor-pointer"
                          title="Descargar este archivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              !isProcessing && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={analyzedItems.length === 0 || analyzedItems.some((it) => it.isAnalyzing)}
                    onClick={handleProcessBatch}
                    className="w-full max-w-md py-3.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                  >
                    <Gauge className="w-4 h-4" />
                    <span>
                      {countNeedOptimization > 0
                        ? `Normalizar lote (${countNeedOptimization} a reducir, ${countOptimal} intactos)`
                        : `Empaquetar lote (${analyzedItems.length} archivos ya óptimos)`}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    Los archivos con 1200 DPI se bajarán a {targetDpi} DPI; los que ya estén en 200 DPI se conservarán intactos.
                  </span>
                </div>
              )
            )}

          </div>
        )}

      </div>
    </div>
  );
}
