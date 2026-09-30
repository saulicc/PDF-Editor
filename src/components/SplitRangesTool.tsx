/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Download,
  Loader2,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Info,
  Layers,
  ChevronRight,
  Split,
  RefreshCw,
  Zap,
  Eye,
  FileText,
  Sliders,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { DocumentInfo } from '../types';
import { loadUserPdfDocument } from '../lib/pdfRenderer';
import {
  splitPdfByRanges,
  mergeRangesToSinglePdf,
  extractPagesAsSeparateFiles,
  extractPages,
  downloadBytes,
  downloadFilesAsZip,
  SplitRange,
} from '../lib/pdfTools';
import { usePdfThumbnails } from '../lib/useThumbnails';
import { GlobalPdfDropOverlay } from './GlobalPdfDropOverlay';

interface SplitRangesToolProps {
  onBack: () => void;
}

type MainTab = 'ranges' | 'pages';
type RangeMode = 'custom' | 'fixed';
type PageExtractMode = 'all' | 'selected';

export default function SplitRangesTool({ onBack }: SplitRangesToolProps) {
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Tabs principales: 'ranges' (Rango) o 'pages' (Páginas)
  const [activeTab, setActiveTab] = useState<MainTab>('ranges');

  // Optimización de rendimiento / memoria (para PDFs extensos > 100 páginas)
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);

  // Opciones de Tab Rango
  const [rangeMode, setRangeMode] = useState<RangeMode>('custom');
  const [customRanges, setCustomRanges] = useState<SplitRange[]>([{ start: 1, end: 1 }]);
  
  // Modo Rango Fijo / Por Lotes
  const [fixedPageCount, setFixedPageCount] = useState<number>(200);
  const [hasFirstChunkOffset, setHasFirstChunkOffset] = useState<boolean>(false);
  const [firstChunkSize, setFirstChunkSize] = useState<number>(85);
  const [mergeAllRanges, setMergeAllRanges] = useState<boolean>(false);

  // Opciones de Tab Páginas
  const [pageExtractMode, setPageExtractMode] = useState<PageExtractMode>('all');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [mergeExtractedPages, setMergeExtractedPages] = useState<boolean>(false);

  // Estado de procesamiento / exportación
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitProgress, setSplitProgress] = useState<{ current: number; total: number } | null>(null);
  const [processResult, setProcessResult] = useState<{
    type: 'zip' | 'pdf';
    fileName: string;
    bytes?: Uint8Array;
    zipFiles?: { name: string; bytes: Uint8Array }[];
    count: number;
  } | null>(null);

  const isLargeDocument = (docInfo?.totalPages ?? 0) > 100;

  const handleUpload = async (file: File) => {
    try {
      setUploadError(null);
      setIsLoadingUpload(true);
      const doc = await loadUserPdfDocument(file);
      setDocInfo(doc);

      const isLarge = doc.totalPages > 100;
      // Para más de 100 páginas desactivamos la vista previa por defecto para cuidar la RAM
      setPreviewEnabled(!isLarge);

      // Valores por defecto
      setCustomRanges([{ start: 1, end: doc.totalPages }]);
      setFixedPageCount(isLarge ? Math.min(200, doc.totalPages) : Math.min(2, doc.totalPages));
      setFirstChunkSize(Math.min(85, doc.totalPages));
      setHasFirstChunkOffset(false);

      // Selección en modo páginas: si es enorme no llenamos 10.000 de golpe en memoria
      const all = new Set<number>();
      const initialPageCount = isLarge ? Math.min(100, doc.totalPages) : doc.totalPages;
      for (let i = 1; i <= initialPageCount; i++) all.add(i);
      setSelectedPages(all);

      setProcessResult(null);
      setSplitProgress(null);
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo leer el archivo PDF.');
    } finally {
      setIsLoadingUpload(false);
    }
  };

  // Cálculos dinámicos para rangos fijos (con soporte para primer bloque personalizado)
  const computedFixedRanges = useMemo<SplitRange[]>(() => {
    if (!docInfo) return [];
    const total = docInfo.totalPages;
    const standardSize = Math.max(1, fixedPageCount);
    const ranges: SplitRange[] = [];

    let curr = 1;

    // Si tiene primer bloque personalizado (offset / primer cuerpo)
    if (hasFirstChunkOffset && firstChunkSize > 0) {
      const firstEnd = Math.min(total, Math.max(1, firstChunkSize));
      ranges.push({ start: 1, end: firstEnd });
      curr = firstEnd + 1;
    }

    // Siguientes bloques estándar
    while (curr <= total) {
      const end = Math.min(total, curr + standardSize - 1);
      ranges.push({ start: curr, end });
      curr = end + 1;
    }

    return ranges;
  }, [docInfo, fixedPageCount, hasFirstChunkOffset, firstChunkSize]);

  // Rangos activos a aplicar
  const activeRanges = rangeMode === 'custom' ? customRanges : computedFixedRanges;

  // Páginas objetivo para renderizado selectivo (bajo demanda, sin saturar memoria)
  const targetPages = useMemo(() => {
    if (!previewEnabled || !docInfo) return [];
    const set = new Set<number>();

    if (activeTab === 'ranges') {
      // Solo tomamos los extremos de los primeros 24 rangos visibles
      const sample = activeRanges.slice(0, 24);
      for (const r of sample) {
        set.add(r.start);
        set.add(r.end);
      }
    } else {
      // En modo páginas, limitamos a las primeras 120 para no colapsar el DOM
      const maxPages = Math.min(docInfo.totalPages, 120);
      for (let i = 1; i <= maxPages; i++) {
        set.add(i);
      }
    }

    return Array.from(set);
  }, [previewEnabled, docInfo, activeTab, activeRanges]);

  // Hook de miniaturas progresivas optimizado para bajo consumo de RAM
  const { thumbnailMap, isLoading: thumbsLoading } = usePdfThumbnails(
    docInfo?.pdfBytes ?? null,
    docInfo?.totalPages ?? 0,
    0.28,
    { enabled: previewEnabled, targetPages }
  );

  // Agregar nuevo rango personalizado
  const handleAddRange = () => {
    if (!docInfo) return;
    const lastRange = customRanges[customRanges.length - 1];
    let nextStart = (lastRange?.end ?? 0) + 1;
    if (nextStart > docInfo.totalPages) {
      nextStart = docInfo.totalPages;
    }
    const nextEnd = docInfo.totalPages;
    setCustomRanges((prev) => [...prev, { start: nextStart, end: nextEnd }]);
  };

  // Modificar rango personalizado
  const handleUpdateRange = (index: number, field: 'start' | 'end', val: number) => {
    if (!docInfo) return;
    const clamped = Math.max(1, Math.min(docInfo.totalPages, val));
    setCustomRanges((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: clamped };
      if (field === 'start' && target.start > target.end) {
        target.end = target.start;
      } else if (field === 'end' && target.end < target.start) {
        target.start = target.end;
      }
      updated[index] = target;
      return updated;
    });
  };

  // Eliminar rango personalizado
  const handleRemoveRange = (index: number) => {
    if (customRanges.length <= 1) return;
    setCustomRanges((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle de selección de página en modo páginas
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  // Seleccionar todas / deseleccionar todas
  const handleSelectAllPages = (select: boolean) => {
    if (!docInfo) return;
    if (select) {
      const all = new Set<number>();
      for (let i = 1; i <= docInfo.totalPages; i++) all.add(i);
      setSelectedPages(all);
    } else {
      setSelectedPages(new Set());
    }
  };

  // Ejecución de la división según los modos seleccionados
  const handleExecuteSplit = async () => {
    if (!docInfo) return;
    setIsProcessing(true);
    setUploadError(null);
    setProcessResult(null);
    setSplitProgress(null);

    try {
      const baseName = docInfo.fileName.replace(/\.pdf$/i, '');

      if (activeTab === 'ranges') {
        // MODO RANGOS
        if (activeRanges.length === 0) {
          throw new Error('Debes definir al menos un rango válido.');
        }

        if (mergeAllRanges) {
          // Unir todos los rangos en un único PDF
          const mergedBytes = await mergeRangesToSinglePdf(docInfo.pdfBytes, activeRanges);
          setProcessResult({
            type: 'pdf',
            fileName: `${baseName}_rangos_unidos.pdf`,
            bytes: mergedBytes,
            count: 1,
          });
          downloadBytes(mergedBytes, `${baseName}_rangos_unidos.pdf`);
        } else {
          // Generar archivos independientes por rango (con reporte de progreso)
          const parts = await splitPdfByRanges(
            docInfo.pdfBytes,
            activeRanges,
            (curr, tot) => setSplitProgress({ current: curr, total: tot })
          );

          if (parts.length === 1) {
            setProcessResult({
              type: 'pdf',
              fileName: `${baseName}_${parts[0].name}`,
              bytes: parts[0].bytes,
              count: 1,
            });
            downloadBytes(parts[0].bytes, `${baseName}_${parts[0].name}`);
          } else {
            setProcessResult({
              type: 'zip',
              fileName: `${baseName}_dividido_${parts.length}_partes.zip`,
              zipFiles: parts,
              count: parts.length,
            });
            await downloadFilesAsZip(parts, `${baseName}_dividido_${parts.length}_partes.zip`);
          }
        }
      } else {
        // MODO PÁGINAS
        const pagesToExtract: number[] = [];
        if (pageExtractMode === 'all') {
          for (let p = 1; p <= docInfo.totalPages; p++) pagesToExtract.push(p);
        } else {
          for (let p = 1; p <= docInfo.totalPages; p++) {
            if (selectedPages.has(p)) pagesToExtract.push(p);
          }
        }

        if (pagesToExtract.length === 0) {
          throw new Error('Seleccioná al menos una página para extraer.');
        }

        if (mergeExtractedPages) {
          // Unir las páginas seleccionadas en un único PDF
          const indices = pagesToExtract.map((p) => p - 1);
          const singleBytes = await extractPages(docInfo.pdfBytes, indices);
          setProcessResult({
            type: 'pdf',
            fileName: `${baseName}_paginas_extraidas.pdf`,
            bytes: singleBytes,
            count: 1,
          });
          downloadBytes(singleBytes, `${baseName}_paginas_extraidas.pdf`);
        } else {
          // Extraer cada página en un archivo individual (con reporte de progreso)
          if (pagesToExtract.length === 1) {
            const pageNum = pagesToExtract[0];
            const singleBytes = await extractPages(docInfo.pdfBytes, [pageNum - 1]);
            setProcessResult({
              type: 'pdf',
              fileName: `${baseName}_pagina_${pageNum}.pdf`,
              bytes: singleBytes,
              count: 1,
            });
            downloadBytes(singleBytes, `${baseName}_pagina_${pageNum}.pdf`);
          } else {
            const parts = await extractPagesAsSeparateFiles(
              docInfo.pdfBytes,
              pagesToExtract,
              (curr, tot) => setSplitProgress({ current: curr, total: tot })
            );
            setProcessResult({
              type: 'zip',
              fileName: `${baseName}_paginas_divididas.zip`,
              zipFiles: parts,
              count: parts.length,
            });
            await downloadFilesAsZip(parts, `${baseName}_paginas_divididas.zip`);
          }
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error al procesar el archivo.');
    } finally {
      setIsProcessing(false);
      setSplitProgress(null);
    }
  };

  // Re-descargar resultado
  const handleRedownload = () => {
    if (!processResult) return;
    if (processResult.type === 'pdf' && processResult.bytes) {
      downloadBytes(processResult.bytes, processResult.fileName);
    } else if (processResult.type === 'zip' && processResult.zipFiles) {
      downloadFilesAsZip(processResult.zipFiles, processResult.fileName);
    }
  };

  // Pantalla de carga inicial
  if (!docInfo) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative">
        <GlobalPdfDropOverlay
          onFileDrop={handleUpload}
          title="Soltá tu archivo PDF en cualquier parte"
          description="Se abrirá para que puedas dividirlo por rangos o extraer páginas."
        />

        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Panel principal</span>
        </button>

        <div className="w-full max-w-md text-center space-y-5">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#e5322d] flex items-center justify-center text-white shadow-md">
              <Split className="w-7 h-7" />
            </div>
            <div className="text-left">
              <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100 tracking-tight">Dividir PDF</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Por rangos, lotes o páginas individuales</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">
            Dividí documentos extensos (incluso de más de 10.000 páginas) por lotes fijos, personalizá el primer cuerpo o extraé fojas específicas sin saturar tu equipo.
          </p>

          {isLoadingUpload ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-9 h-9 text-[#e5322d] animate-spin" />
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Procesando estructura del documento...</p>
            </div>
          ) : (
            <label
              htmlFor="split-upload-input"
              className="block w-full py-12 px-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#e5322d] rounded-2xl bg-white dark:bg-slate-900 hover:bg-red-50/20 dark:hover:bg-red-950/10 cursor-pointer transition-colors shadow-2xs group"
            >
              <Upload className="w-8 h-8 text-[#e5322d] mx-auto mb-3 transition-transform group-hover:-translate-y-1" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Seleccionar archivo PDF
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                o arrastrá y soltá el PDF acá
              </p>
              <input
                id="split-upload-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {uploadError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f4f5f8] dark:bg-slate-950 flex flex-col relative">
      <GlobalPdfDropOverlay
        onFileDrop={handleUpload}
        title="Soltá tu archivo PDF en cualquier parte"
        description="Se cargará el nuevo documento para dividir o extraer páginas."
      />

      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#e5322d] px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Panel principal</span>
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-xs md:max-w-md">
              {docInfo.fileName}
            </span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono">
              {docInfo.totalPages.toLocaleString()} págs
            </span>
          </div>
        </div>

        {/* Controles de la barra superior: Botón Vista Previa / Modo Rápido + Cambiar PDF */}
        <div className="flex items-center gap-2">
          {/* Botón para activar/desactivar vista previa (ahorro de RAM) */}
          <button
            type="button"
            onClick={() => setPreviewEnabled((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              previewEnabled
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100'
            }`}
            title={
              previewEnabled
                ? 'Desactivar miniaturas para optimizar velocidad y memoria RAM'
                : 'Activar previsualización visual de miniaturas'
            }
          >
            {previewEnabled ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Vista previa:</span>
                <span className="font-bold">ON</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Modo Rápido:</span>
                <span className="font-bold">ON</span>
              </>
            )}
          </button>

          <label
            htmlFor="change-pdf-file"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#e5322d] cursor-pointer flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Cambiar documento"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cambiar PDF</span>
            <input
              id="change-pdf-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* Main Workspace (Two Columns: Left Viewport, Right Sidebar) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Viewport: Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
          
          {/* Banner de Aviso de Documento Grande (>100 páginas) */}
          {isLargeDocument && (
            <div className="w-full max-w-4xl mb-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">
                    Documento extenso detectado ({docInfo.totalPages.toLocaleString()} páginas)
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    {previewEnabled
                      ? 'La vista previa está activa bajo demanda. Si notás lentitud, podés pulsar Modo Rápido.'
                      : 'El Modo Rápido está activo para evitar colapsar la memoria RAM. La división se procesa a máxima velocidad.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewEnabled((prev) => !prev)}
                className="shrink-0 px-3 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-slate-800 text-[11px]"
              >
                {previewEnabled ? 'Desactivar vista previa' : 'Activar vista previa'}
              </button>
            </div>
          )}

          {activeTab === 'ranges' ? (
            /* ======================================================== */
            /* MODO RANGOS                                              */
            /* ======================================================== */
            <div className="w-full max-w-4xl space-y-6 py-2">
              
              {/* Si es Modo Fijo y se generan muchos lotes (>6 lotes), mostramos una vista optimizada en tabla/lotes */}
              {rangeMode === 'fixed' && computedFixedRanges.length > 6 ? (
                <div className="space-y-4">
                  {/* Resumen Superior de División por Lotes */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Split className="w-4 h-4 text-[#e5322d]" />
                          División automática por lotes
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {docInfo.totalPages.toLocaleString()} páginas divididas en{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {computedFixedRanges.length} archivos PDF
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {hasFirstChunkOffset && (
                          <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#e5322d] border border-red-200 dark:border-red-900 font-semibold">
                            Parte 1: {firstChunkSize} págs
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                          Bloques regulares: {fixedPageCount} págs
                        </span>
                        {computedFixedRanges[computedFixedRanges.length - 1] && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Última parte:{' '}
                            {computedFixedRanges[computedFixedRanges.length - 1].end -
                              computedFixedRanges[computedFixedRanges.length - 1].start +
                              1}{' '}
                            págs (remanente)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grilla visual compacta y ultra fluida de partes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {computedFixedRanges.map((range, idx) => {
                      const rangeCount = range.end - range.start + 1;
                      const isFirstSpecial = hasFirstChunkOffset && idx === 0;
                      const isLastRemanent =
                        idx === computedFixedRanges.length - 1 && rangeCount < fixedPageCount;

                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {/* Ícono de archivo o miniatura si está activa */}
                            <div className="w-12 h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg flex flex-col items-center justify-center p-1 shrink-0 relative overflow-hidden">
                              {previewEnabled && thumbnailMap[range.start] ? (
                                <img
                                  src={thumbnailMap[range.start]}
                                  alt={`Pág ${range.start}`}
                                  className="w-full h-full object-contain pointer-events-none"
                                />
                              ) : (
                                <>
                                  <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                    {range.start}
                                  </span>
                                </>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                  Parte {idx + 1}
                                </span>
                                {isFirstSpecial && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded font-semibold">
                                    Cuerpo 1
                                  </span>
                                )}
                                {isLastRemanent && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-medium">
                                    Final
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
                                Págs. {range.start.toLocaleString()} – {range.end.toLocaleString()}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {rangeCount} {rangeCount === 1 ? 'página' : 'páginas'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                              .pdf
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Vista estándar de Marcos Punteados (para rangos personalizados o lotes pequeños) */
                <div className="space-y-6">
                  {activeRanges.map((range, idx) => {
                    const rangeSpan = range.end - range.start + 1;
                    const showEllipsis = rangeSpan > 2;

                    return (
                      <div key={idx} className="flex flex-col items-center w-full">
                        {/* Range Title */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                            Rango {idx + 1}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({rangeSpan} {rangeSpan === 1 ? 'página' : 'páginas'})
                          </span>
                        </div>

                        {/* Dotted Box Container */}
                        <div className="w-full max-w-xl bg-white/70 dark:bg-slate-900/70 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 sm:p-7 flex items-center justify-center gap-4 sm:gap-8 shadow-2xs transition-all hover:border-slate-400">
                          {/* Start Page Thumbnail */}
                          <div className="flex flex-col items-center">
                            <div className="w-24 sm:w-32 aspect-[3/4] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden flex items-center justify-center p-1 relative">
                              {previewEnabled ? (
                                thumbnailMap[range.start] ? (
                                  <img
                                    src={thumbnailMap[range.start]}
                                    alt={`Página ${range.start}`}
                                    className="w-full h-full object-contain pointer-events-none"
                                  />
                                ) : (
                                  <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                                )
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                  <FileText className="w-6 h-6 stroke-1" />
                                  <span className="text-[10px] font-mono">Folio</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 font-mono">
                              Pág. {range.start}
                            </span>
                          </div>

                          {/* Middle Ellipsis (if more than 2 pages in range) */}
                          {showEllipsis && (
                            <div className="flex flex-col items-center justify-center px-2">
                              <span className="text-2xl sm:text-3xl font-bold tracking-widest text-slate-400 dark:text-slate-500 select-none">
                                ...
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                {rangeSpan - 2} {rangeSpan - 2 === 1 ? 'página' : 'páginas'}
                              </span>
                            </div>
                          )}

                          {/* End Page Thumbnail (if start !== end) */}
                          {range.end !== range.start && (
                            <div className="flex flex-col items-center">
                              <div className="w-24 sm:w-32 aspect-[3/4] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden flex items-center justify-center p-1 relative">
                                {previewEnabled ? (
                                  thumbnailMap[range.end] ? (
                                    <img
                                      src={thumbnailMap[range.end]}
                                      alt={`Página ${range.end}`}
                                      className="w-full h-full object-contain pointer-events-none"
                                    />
                                  ) : (
                                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                                  )
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                    <FileText className="w-6 h-6 stroke-1" />
                                    <span className="text-[10px] font-mono">Folio</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 font-mono">
                                Pág. {range.end}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {previewEnabled && thumbsLoading && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#e5322d]" />
                  <span>Cargando previsualización visual...</span>
                </div>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* MODO PÁGINAS                                             */
            /* ======================================================== */
            <div className="w-full max-w-5xl py-2 space-y-4">
              
              {/* Aviso si son más de 150 páginas en modo extracción directa */}
              {isLargeDocument && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Para dividir expedientes de miles de páginas:</p>
                    <p className="mt-0.5">
                      Te sugerimos usar la pestaña <strong className="underline cursor-pointer" onClick={() => setActiveTab('ranges')}>Rango &gt; Fijo</strong> para separar en lotes automáticos (ej. de a 200 fojas con o sin carátula de 85) en segundos y sin consumir memoria.
                    </p>
                  </div>
                </div>
              )}

              {pageExtractMode === 'selected' && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                    {selectedPages.size.toLocaleString()} de {docInfo.totalPages.toLocaleString()} páginas seleccionadas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllPages(true)}
                      className="text-xs font-semibold text-[#e5322d] hover:underline cursor-pointer px-2 py-1"
                    >
                      Seleccionar todas
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPages(false)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer px-2 py-1"
                    >
                      Deseleccionar todas
                    </button>
                  </div>
                </div>
              )}

              {/* Grid de páginas (con límite de render para proteger el DOM si el documento es gigante) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {Array.from(
                  { length: Math.min(docInfo.totalPages, previewEnabled ? 120 : 60) },
                  (_, i) => i + 1
                ).map((pageNum) => {
                  const isSelected =
                    pageExtractMode === 'all' || selectedPages.has(pageNum);
                  const isSelectable = pageExtractMode === 'selected';

                  return (
                    <div
                      key={pageNum}
                      onClick={() => {
                        if (isSelectable) togglePageSelection(pageNum);
                      }}
                      className={`group relative flex flex-col bg-white dark:bg-slate-800 rounded-xl border p-2 shadow-2xs transition-all ${
                        isSelectable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                      } ${
                        isSelected
                          ? 'border-slate-300 dark:border-slate-600'
                          : 'border-slate-200 dark:border-slate-800 opacity-40 hover:opacity-75'
                      }`}
                    >
                      {/* Checkmark verde */}
                      <div className="absolute top-2 left-2 z-10">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-slate-800">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 shadow-sm" />
                        )}
                      </div>

                      {/* Miniatura o Folio Liviano */}
                      <div className="w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-slate-100 dark:border-slate-750">
                        {previewEnabled ? (
                          thumbnailMap[pageNum] ? (
                            <img
                              src={thumbnailMap[pageNum]}
                              alt={`Página ${pageNum}`}
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <FileText className="w-6 h-6 stroke-1" />
                            <span className="text-[10px] font-mono mt-1 font-semibold">Folio {pageNum}</span>
                          </div>
                        )}
                      </div>

                      {/* Número de página centrado abajo */}
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center mt-2 font-mono">
                        {pageNum}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Si hay más páginas que el límite visual */}
              {docInfo.totalPages > (previewEnabled ? 120 : 60) && (
                <div className="text-center py-4 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  Mostrando las primeras {previewEnabled ? 120 : 60} de {docInfo.totalPages.toLocaleString()} páginas en la vista previa rápida para garantizar rendimiento fluido. Al pulsar Dividir se procesarán todas las seleccionadas.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* Right Sidebar: Control Panel                                 */}
        {/* ============================================================ */}
        <aside className="w-full lg:w-96 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 shadow-lg z-10">
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
            {/* Título de sección */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Dividir
              </h2>
              {isLargeDocument && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  Modo Lote Activo
                </span>
              )}
            </div>

            {/* Selector de pestañas principales (Rango | Páginas) */}
            <div className="grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-700 p-1 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              {/* Tab Rango */}
              <button
                type="button"
                onClick={() => setActiveTab('ranges')}
                className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'ranges'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {activeTab === 'ranges' && (
                  <div className="absolute top-1 left-1.5 w-3.5 h-3.5 rounded-full bg-[#10b981] flex items-center justify-center text-white">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <span className="text-xs font-mono font-bold tracking-tight mb-0.5">[O-O]</span>
                <span className="text-xs">Rango</span>
              </button>

              {/* Tab Páginas */}
              <button
                type="button"
                onClick={() => setActiveTab('pages')}
                className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'pages'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {activeTab === 'pages' && (
                  <div className="absolute top-1 left-1.5 w-3.5 h-3.5 rounded-full bg-[#10b981] flex items-center justify-center text-white">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <Layers className="w-4 h-4 mb-0.5" />
                <span className="text-xs">Páginas</span>
              </button>
            </div>

            {/* CONTENIDO DE TAB 1: RANGO */}
            {activeTab === 'ranges' && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Modo de rango:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRangeMode('custom')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        rangeMode === 'custom'
                          ? 'border-[#e5322d] text-[#e5322d] bg-red-50/30 dark:bg-red-950/20 ring-1 ring-[#e5322d]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      Personalizado
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeMode('fixed')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        rangeMode === 'fixed'
                          ? 'border-[#e5322d] text-[#e5322d] bg-red-50/30 dark:bg-red-950/20 ring-1 ring-[#e5322d]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      Fijo / Por Lotes
                    </button>
                  </div>
                </div>

                {/* Submodo Rango: Personalizado */}
                {rangeMode === 'custom' && (
                  <div className="space-y-3">
                    {customRanges.map((range, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <span>↕</span> Rango {idx + 1}
                          </span>
                          {customRanges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRange(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                              title="Eliminar rango"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Inputs: de la página [ X ] a [ Y ] */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] block mb-1">
                              de la página
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={docInfo.totalPages}
                              value={range.start}
                              onChange={(e) =>
                                handleUpdateRange(idx, 'start', parseInt(e.target.value, 10) || 1)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-center font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#e5322d] outline-hidden font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] block mb-1">
                              a
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={docInfo.totalPages}
                              value={range.end}
                              onChange={(e) =>
                                handleUpdateRange(idx, 'end', parseInt(e.target.value, 10) || 1)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-center font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#e5322d] outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddRange}
                      className="w-full py-2.5 px-3 border border-[#e5322d] border-dashed text-[#e5322d] hover:bg-red-50/50 dark:hover:bg-red-950/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Rango</span>
                    </button>
                  </div>
                )}

                {/* Submodo Rango: Fijo / Por Lotes (Con soporte para primer bloque personalizado) */}
                {rangeMode === 'fixed' && (
                  <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                    {/* Tamaño del bloque estándar */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Dividir en bloques de:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={docInfo.totalPages}
                          value={fixedPageCount}
                          onChange={(e) =>
                            setFixedPageCount(
                              Math.max(1, Math.min(docInfo.totalPages, parseInt(e.target.value, 10) || 1))
                            )
                          }
                          className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-center font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#e5322d] outline-hidden font-mono"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          páginas por archivo
                        </span>
                      </div>
                    </div>

                    {/* Casilla: Personalizar el primer bloque (Offset / Primer cuerpo) */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasFirstChunkOffset}
                          onChange={(e) => setHasFirstChunkOffset(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-[#e5322d] focus:ring-[#e5322d] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Personalizar el primer bloque (Cuerpo 1 / Desfase)
                        </span>
                      </label>

                      {hasFirstChunkOffset && (
                        <div className="ml-6 p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                            Primera parte de:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={docInfo.totalPages}
                              value={firstChunkSize}
                              onChange={(e) =>
                                setFirstChunkSize(
                                  Math.max(1, Math.min(docInfo.totalPages, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-center font-bold text-[#e5322d] focus:ring-2 focus:ring-[#e5322d] outline-hidden font-mono text-xs"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              páginas (1 a {Math.min(docInfo.totalPages, firstChunkSize)})
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            A partir de la página {Math.min(docInfo.totalPages, firstChunkSize) + 1}, las siguientes partes serán de {fixedPageCount} páginas.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Resumen dinámico en tiempo real de los lotes generados */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span>Resultado previsto:</span>
                        <span className="text-[#e5322d] font-bold font-mono">
                          {computedFixedRanges.length} archivos PDF
                        </span>
                      </div>

                      {/* Lista de desglose de las partes */}
                      <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 text-[11px] font-mono">
                        {computedFixedRanges.slice(0, 4).map((r, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Parte {i + 1}:
                            </span>
                            <span>
                              págs. {r.start} - {r.end} ({r.end - r.start + 1} págs)
                            </span>
                          </div>
                        ))}

                        {computedFixedRanges.length > 5 && (
                          <div className="text-center py-0.5 text-slate-400 dark:text-slate-500 text-[10px]">
                            ... ({computedFixedRanges.length - 5} partes intermedias de {fixedPageCount} págs) ...
                          </div>
                        )}

                        {computedFixedRanges.length > 4 && (
                          <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Parte {computedFixedRanges.length}:
                            </span>
                            <span>
                              págs. {computedFixedRanges[computedFixedRanges.length - 1].start} -{' '}
                              {computedFixedRanges[computedFixedRanges.length - 1].end} (
                              {computedFixedRanges[computedFixedRanges.length - 1].end -
                                computedFixedRanges[computedFixedRanges.length - 1].start +
                                1}{' '}
                              págs)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkbox Unir todos los rangos */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={mergeAllRanges}
                    onChange={(e) => setMergeAllRanges(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#e5322d] focus:ring-[#e5322d] cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Unir todos los rangos generados en un único PDF.
                  </span>
                </label>
              </div>
            )}

            {/* CONTENIDO DE TAB 2: PÁGINAS (EXTRAER) */}
            {activeTab === 'pages' && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Modo de extracción:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPageExtractMode('all')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        pageExtractMode === 'all'
                          ? 'border-[#e5322d] text-[#e5322d] bg-red-50/30 dark:bg-red-950/20 ring-1 ring-[#e5322d]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      Extraer todas las páginas
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageExtractMode('selected')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        pageExtractMode === 'selected'
                          ? 'border-[#e5322d] text-[#e5322d] bg-red-50/30 dark:bg-red-950/20 ring-1 ring-[#e5322d]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      Seleccionar páginas
                    </button>
                  </div>
                </div>

                {/* Banner de información */}
                <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-sky-800 dark:text-sky-300">
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p>
                    {pageExtractMode === 'all' ? (
                      mergeExtractedPages ? (
                        <>Las <strong>{docInfo.totalPages.toLocaleString()}</strong> páginas se unirán en <strong>1 único archivo PDF</strong>.</>
                      ) : (
                        <>Las páginas se convertirán en diferentes archivos PDF individuales. <strong>{docInfo.totalPages.toLocaleString()} archivos</strong> serán creados dentro de un .ZIP.</>
                      )
                    ) : (
                      mergeExtractedPages ? (
                        <>Las <strong>{selectedPages.size.toLocaleString()}</strong> páginas seleccionadas se unirán en <strong>1 único archivo PDF</strong>.</>
                      ) : (
                        <>Las páginas seleccionadas se convertirán en diferentes archivos PDF individuales. <strong>{selectedPages.size.toLocaleString()} archivos</strong> serán creados dentro de un .ZIP.</>
                      )
                    )}
                  </p>
                </div>

                {/* Checkbox Unir páginas extraídas */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={mergeExtractedPages}
                    onChange={(e) => setMergeExtractedPages(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#e5322d] focus:ring-[#e5322d] cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Unir todas las páginas extraídas en un único PDF.
                  </span>
                </label>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                {uploadError}
              </div>
            )}
          </div>

          {/* Footer del Sidebar con botón de ejecución */}
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            {processResult ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    ¡PDF dividido con éxito! ({processResult.count.toLocaleString()}{' '}
                    {processResult.count === 1 ? 'archivo' : 'archivos'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRedownload}
                  className="w-full py-3.5 px-4 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Volver a descargar ({processResult.type === 'zip' ? '.ZIP' : '.PDF'})</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={
                  isProcessing ||
                  (activeTab === 'pages' && pageExtractMode === 'selected' && selectedPages.size === 0)
                }
                onClick={handleExecuteSplit}
                className="w-full py-4 px-6 bg-[#e5322d] hover:bg-[#c92520] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 text-base transition-all cursor-pointer tracking-wide"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      {splitProgress
                        ? `Dividiendo parte ${splitProgress.current} de ${splitProgress.total} (${Math.round(
                            (splitProgress.current / splitProgress.total) * 100
                          )}%)...`
                        : 'Dividiendo PDF...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Dividir PDF</span>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 stroke-[3]" />
                    </div>
                  </>
                )}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
