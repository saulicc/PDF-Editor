/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Upload,
  Eraser,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  CheckSquare,
  Square,
  Stamp,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { DocumentInfo } from '../types';
import { loadUserPdfDocument } from '../lib/pdfRenderer';
import {
  removeFoliosFromPdfPages,
  surgicallyRemoveVectorStampsFromPdfPages,
  detectVectorStampsInPdf,
  UnstampAreaConfig,
  downloadBytes,
} from '../lib/pdfTools';
import { usePdfThumbnails } from '../lib/useThumbnails';
import { GlobalPdfDropOverlay } from './GlobalPdfDropOverlay';

interface UnstampToolProps {
  onBack: () => void;
  onGoToStamp?: (file: File) => void;
}

export default function UnstampTool({ onBack, onGoToStamp }: UnstampToolProps) {
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Páginas seleccionadas para desfoliar (base-1)
  const [selectedPageNumbers, setSelectedPageNumbers] = useState<Set<number>>(new Set());

  // Modo de remoción: 'surgical' (detecta y saca el vector sin tapar nada) | 'patch' (blanqueo)
  const [removalMethod, setRemovalMethod] = useState<'surgical' | 'patch'>('surgical');
  const [detectedVectorPages, setDetectedVectorPages] = useState<number[]>([]);
  const [isScanningVectors, setIsScanningVectors] = useState<boolean>(false);

  // Modo de selección: 'all' | 'custom' | 'manual'
  const [selectionMode, setSelectionMode] = useState<'all' | 'custom' | 'manual'>('all');
  const [customRangeStr, setCustomRangeStr] = useState<string>('');

  // Configuración de la zona de desfoliado (por defecto: esquina superior derecha, tamaño estándar de sello + folio)
  const [areaConfig, setAreaConfig] = useState<UnstampAreaConfig>({
    preset: 'top-right',
    width: 170, // cubre el ancho del sello oficial de 160 pt con margen de seguridad
    height: 130, // cubre el alto del sello y el texto del folio
    marginRight: 2,
    marginLeft: 2,
    marginTop: 2,
    marginBottom: 2,
  });

  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedBytes, setProcessedBytes] = useState<Uint8Array | null>(null);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number } | null>(null);
  const [resultFileName, setResultFileName] = useState<string>('');

  // Miniaturas
  const { thumbnails, isLoading: thumbsLoading } = usePdfThumbnails(
    docInfo?.pdfBytes ?? null,
    docInfo?.totalPages ?? 0,
    0.25
  );

  const handleUpload = async (file: File) => {
    try {
      setUploadError(null);
      setIsLoadingUpload(true);
      setProcessedBytes(null);
      const doc = await loadUserPdfDocument(file);
      setDocInfo(doc);

      // Escanear detección de vectores incrustados
      setIsScanningVectors(true);
      const scan = await detectVectorStampsInPdf(doc.pdfBytes);
      setIsScanningVectors(false);
      setDetectedVectorPages(scan.pagesWithVectors);

      if (scan.pagesWithVectors.length > 0) {
        setRemovalMethod('surgical');
        // Preseleccionar exactamente las fojas donde se detectó el vector
        setSelectedPageNumbers(new Set(scan.pagesWithVectors));
        setCustomRangeStr(scan.pagesWithVectors.join(', '));
      } else {
        const allPages = new Set<number>();
        for (let i = 1; i <= doc.totalPages; i++) allPages.add(i);
        setSelectedPageNumbers(allPages);
        setCustomRangeStr(`1-${doc.totalPages}`);
      }
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo leer el archivo PDF.');
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const handleTogglePage = (pageNum: number) => {
    setSelectionMode('manual');
    setSelectedPageNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!docInfo) return;
    setSelectionMode('all');
    const all = new Set<number>();
    for (let i = 1; i <= docInfo.totalPages; i++) all.add(i);
    setSelectedPageNumbers(all);
    setCustomRangeStr(`1-${docInfo.totalPages}`);
  };

  const handleDeselectAll = () => {
    setSelectionMode('manual');
    setSelectedPageNumbers(new Set());
    setCustomRangeStr('');
  };

  const handleApplyCustomRange = (str: string) => {
    setCustomRangeStr(str);
    setSelectionMode('custom');
    if (!docInfo) return;

    const pages = new Set<number>();
    const tokens = str.split(/[,;\s]+/);
    for (const token of tokens) {
      if (!token.trim()) continue;
      if (token.includes('-')) {
        const [a, b] = token.split('-');
        const start = parseInt(a, 10);
        const end = parseInt(b, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(docInfo.totalPages, Math.max(start, end));
          for (let p = from; p <= to; p++) pages.add(p);
        }
      } else {
        const single = parseInt(token, 10);
        if (!isNaN(single) && single >= 1 && single <= docInfo.totalPages) {
          pages.add(single);
        }
      }
    }
    setSelectedPageNumbers(pages);
  };

  const handleExecuteUnstamp = async () => {
    if (!docInfo || selectedPageNumbers.size === 0) return;

    try {
      setIsProcessing(true);
      setProgressInfo({ current: 0, total: selectedPageNumbers.size });

      const pagesArray = Array.from(selectedPageNumbers).sort((a, b) => a - b);
      let cleanBytes: Uint8Array;
      let actualRemovedCount = pagesArray.length;

      if (removalMethod === 'surgical') {
        const result = await surgicallyRemoveVectorStampsFromPdfPages(
          docInfo.pdfBytes,
          pagesArray,
          (current, total) => {
            setProgressInfo({ current, total });
          }
        );
        cleanBytes = result.bytes;
        actualRemovedCount = result.removedCount;

        // Si no se detectaron flujos en modo quirúrgico (ej: escaneo plano), avisar y ofrecer parche
        if (actualRemovedCount === 0) {
          const fallbackToPatch = window.confirm(
            'No se detectaron capas vectoriales separadas en estas hojas (posiblemente sea un escaneo plano).\n\n¿Deseás aplicar el método de blanqueo de zona para borrar el área del sello?'
          );
          if (fallbackToPatch) {
            setRemovalMethod('patch');
            cleanBytes = await removeFoliosFromPdfPages(
              docInfo.pdfBytes,
              pagesArray,
              areaConfig,
              (current, total) => {
                setProgressInfo({ current, total });
              }
            );
          } else {
            return;
          }
        }
      } else {
        cleanBytes = await removeFoliosFromPdfPages(
          docInfo.pdfBytes,
          pagesArray,
          areaConfig,
          (current, total) => {
            setProgressInfo({ current, total });
          }
        );
      }

      const outName = docInfo.fileName.replace(/\.pdf$/i, '') + '_desfoliado.pdf';
      setResultFileName(outName);
      setProcessedBytes(cleanBytes);
    } catch (err: any) {
      alert('Error al quitar el foliado: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
      setProgressInfo(null);
    }
  };

  const handleDownloadResult = () => {
    if (!processedBytes || !resultFileName) return;
    downloadBytes(processedBytes, resultFileName);
  };

  const handleOpenResultInNewTab = () => {
    if (!processedBytes) return;
    const blob = new Blob([processedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleGoToRestamp = () => {
    if (!processedBytes || !onGoToStamp || !resultFileName) return;
    const file = new File([processedBytes as BlobPart], resultFileName, { type: 'application/pdf' });
    onGoToStamp(file);
  };

  if (!docInfo) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 relative">
        <GlobalPdfDropOverlay
          onFileDrop={handleUpload}
          title="Soltá tu archivo PDF en cualquier parte"
          description="Se abrirá para que puedas seleccionar las páginas y quitarles el sello o foliado."
        />

        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Panel principal</span>
        </button>

        <div className="w-full max-w-md text-center space-y-5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm">
              <Eraser className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Desfoliar / Quitar Foliado
            </h1>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            ¿Te equivocaste de hojas al foliar o dividir? Cargá tu PDF para remover sellos y números de folios de páginas específicas o de todo el archivo.
          </p>

          {isLoadingUpload ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cargando documento...</p>
            </div>
          ) : (
            <label
              htmlFor="unstamp-pdf-upload-input"
              className="block w-full py-10 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-rose-500 rounded-2xl bg-white dark:bg-slate-800 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
            >
              <Upload className="w-7 h-7 text-rose-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Hacé clic o arrastrá tu PDF foliado acá
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Acepta cualquier PDF ya foliado o dividido (.pdf)
              </p>
              <input
                id="unstamp-pdf-upload-input"
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

          {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
        </div>
      </div>
    );
  }

  const selectedCount = selectedPageNumbers.size;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
      <GlobalPdfDropOverlay
        onFileDrop={handleUpload}
        title="Soltá tu archivo PDF en cualquier parte"
        description="Se cargará de inmediato para desfoliar."
      />

      {/* Header bar */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0">
              <Eraser className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-tight">
                Desfoliar / Quitar Foliado de PDF
              </h1>
              <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                {docInfo.fileName} • {docInfo.totalPages} páginas
              </p>
            </div>
          </div>
        </div>

        {/* Change file button */}
        <label
          htmlFor="unstamp-change-file-input"
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cargar otro PDF</span>
          <input
            id="unstamp-change-file-input"
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
      </header>

      {/* Main split workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Control Sidebar */}
        <aside className="w-full lg:w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto space-y-5 shrink-0 z-20">
          {/* Target pages selection box */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                1. ¿De qué hojas querés sacar el foliado?
              </label>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/50">
                {selectedCount} de {docInfo.totalPages}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="selectionMode"
                  checked={selectionMode === 'all'}
                  onChange={handleSelectAll}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Todas las páginas (1 a {docInfo.totalPages})</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="selectionMode"
                  checked={selectionMode === 'custom'}
                  onChange={() => setSelectionMode('custom')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Rango específico o páginas equivocadas</span>
              </label>

              {selectionMode === 'custom' && (
                <div className="pl-6 pt-1">
                  <input
                    type="text"
                    value={customRangeStr}
                    onChange={(e) => handleApplyCustomRange(e.target.value)}
                    placeholder="Ej: 1-5, 8, 12-20"
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Escribí las hojas separadas por comas o guiones (ej. 3-6, 10).
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="selectionMode"
                  checked={selectionMode === 'manual'}
                  onChange={() => setSelectionMode('manual')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Seleccionar manualmente haciendo clic en las hojas</span>
              </label>
            </div>

            {/* Quick selection action buttons */}
            <div className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex-1 py-1 px-2 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Marcar todas
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="flex-1 py-1 px-2 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Desmarcar todas
              </button>
            </div>
          </div>

          {/* Vector Detection Banner */}
          {detectedVectorPages.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>¡Vectores de este programa detectados!</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Se detectó la capa vectorial del sello y folio en {detectedVectorPages.length} {detectedVectorPages.length === 1 ? 'página' : 'páginas'}.
                El sistema la removerá quirúrgicamente sin tapar ni borrar ningún dato de fondo del PDF.
              </p>
            </div>
          )}

          {/* Removal Method Selector */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              2. Método de Eliminación
            </label>

            <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              removalMethod === 'surgical'
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}>
              <input
                type="radio"
                name="removalMethod"
                value="surgical"
                checked={removalMethod === 'surgical'}
                onChange={() => setRemovalMethod('surgical')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Extracción Vectorial Quirúrgica (Sin tapar nada)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                  Detecta el vector del sello y el texto del folio incrustado por este programa y lo retira de la estructura del PDF. <strong>Conserva el 100% del texto original, membretes, líneas y firmas intactos (sin cajas blancas).</strong>
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              removalMethod === 'patch'
                ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-1 ring-rose-500/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}>
              <input
                type="radio"
                name="removalMethod"
                value="patch"
                checked={removalMethod === 'patch'}
                onChange={() => setRemovalMethod('patch')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500"
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Blanqueo de zona (Parche de esquina)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Dibuja un parche blanco sobre la esquina. Usar solo si el archivo proviene de un escaneo plano donde el sello no está en una capa vectorial separable.
                </p>
              </div>
            </label>
          </div>

          {/* Area configuration (Solo visible en modo parche) */}
          {removalMethod === 'patch' ? (
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                3. Zona a Blanquear (Sello y Folio)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Por defecto coincide exactamente con la esquina superior derecha donde va el sello.
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAreaConfig((prev) => ({ ...prev, preset: 'top-right' }))}
                  className={`py-1.5 px-2 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    areaConfig.preset === 'top-right'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Esquina Sup. Der.
                </button>
                <button
                  type="button"
                  onClick={() => setAreaConfig((prev) => ({ ...prev, preset: 'top-left' }))}
                  className={`py-1.5 px-2 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    areaConfig.preset === 'top-left'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Esquina Sup. Izq.
                </button>
                <button
                  type="button"
                  onClick={() => setAreaConfig((prev) => ({ ...prev, preset: 'bottom-right' }))}
                  className={`py-1.5 px-2 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    areaConfig.preset === 'bottom-right'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Esquina Inf. Der.
                </button>
                <button
                  type="button"
                  onClick={() => setAreaConfig((prev) => ({ ...prev, preset: 'bottom-left' }))}
                  className={`py-1.5 px-2 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    areaConfig.preset === 'bottom-left'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Esquina Inf. Izq.
                </button>
              </div>

              {/* Dimension sliders */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Ancho de cobertura:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {areaConfig.width} pt
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={300}
                  step={5}
                  value={areaConfig.width}
                  onChange={(e) =>
                    setAreaConfig((prev) => ({ ...prev, width: parseInt(e.target.value, 10) }))
                  }
                  className="w-full accent-rose-600 cursor-pointer"
                />

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Alto de cobertura:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {areaConfig.height} pt
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={250}
                  step={5}
                  value={areaConfig.height}
                  onChange={(e) =>
                    setAreaConfig((prev) => ({ ...prev, height: parseInt(e.target.value, 10) }))
                  }
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Preservación Absoluta del Documento</span>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                El sistema removerá quirúrgicamente la capa del sello y el texto del folio. <strong>No se tapará nada con blanco:</strong> todo el texto, membretes y líneas de fondo del documento permanecerán visibles y nítidos.
              </p>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2">
            <button
              type="button"
              id="execute-unstamp-btn"
              disabled={isProcessing || selectedCount === 0}
              onClick={handleExecuteUnstamp}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              <span>
                {isProcessing
                  ? `Limpiando (${progressInfo?.current || 0}/${progressInfo?.total || selectedCount})...`
                  : `Quitar foliado de ${selectedCount} ${selectedCount === 1 ? 'página' : 'páginas'}`}
              </span>
            </button>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1.5">
              Borra el sello y el número de folio sin afectar el resto del documento.
            </p>
          </div>
        </aside>

        {/* Right Main Grid Area: Page Thumbnails */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Vista de Hojas del Expediente
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hacé clic en cualquier hoja para incluirla o excluirla del desfoliado.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                  <span className="w-3 h-3 rounded bg-rose-500/20 border-2 border-rose-500" />
                  <span>Se desfoliará ({selectedCount})</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-3 h-3 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600" />
                  <span>Queda intacta ({docInfo.totalPages - selectedCount})</span>
                </div>
              </div>
            </div>

            {/* Thumbnail grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: docInfo.totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = selectedPageNumbers.has(pageNum);
                const thumbUrl = thumbnails[pageNum - 1];

                return (
                  <div
                    key={pageNum}
                    onClick={() => handleTogglePage(pageNum)}
                    className={`relative rounded-xl border-2 p-2 bg-white dark:bg-slate-800 cursor-pointer transition-all select-none group flex flex-col items-center ${
                      isSelected
                        ? 'border-rose-500 shadow-md ring-2 ring-rose-500/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Header of thumbnail item */}
                    <div className="w-full flex items-center justify-between mb-1.5 text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Foja {pageNum}
                      </span>
                      {isSelected ? (
                        removalMethod === 'surgical' ? (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            Vector
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Eraser className="w-2.5 h-2.5" />
                            Parche
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">Intacta</span>
                      )}
                    </div>

                    {/* Preview page surface */}
                    <div className="w-full aspect-3/4 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 relative overflow-hidden flex items-center justify-center">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={`Página ${pageNum}`}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      ) : (
                        <div className="text-slate-400 text-xs font-mono">Pág. {pageNum}</div>
                      )}

                      {/* Visual indicator on the thumbnail */}
                      {isSelected && (
                        removalMethod === 'surgical' ? (
                          <div
                            className="absolute top-1 right-1 bg-blue-600/90 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-xs pointer-events-none flex items-center gap-1"
                            title="El vector será extraído quirúrgicamente sin tapar el fondo"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Quitar vector</span>
                          </div>
                        ) : (
                          <div
                            className={`absolute border-2 border-dashed border-rose-500 bg-rose-500/25 pointer-events-none ${
                              areaConfig.preset === 'top-right'
                                ? 'top-1 right-1 w-[40%] h-[28%]'
                                : areaConfig.preset === 'top-left'
                                ? 'top-1 left-1 w-[40%] h-[28%]'
                                : areaConfig.preset === 'bottom-right'
                                ? 'bottom-1 right-1 w-[40%] h-[28%]'
                                : 'bottom-1 left-1 w-[40%] h-[28%]'
                            }`}
                            title="Área que será cubierta con parche"
                          />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Result Modal when unstamp completes */}
      {processedBytes && (
        <div
          id="unstamp-success-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base">¡Documento Desfoliado con Éxito!</h3>
                  <p className="text-xs text-slate-300">
                    Se quitaron los sellos y números de {selectedCount} {selectedCount === 1 ? 'página' : 'páginas'}.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Páginas intervenidas:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedCount} páginas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nombre de salida:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate max-w-[200px]">
                    {resultFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Tamaño del archivo:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {(processedBytes.byteLength / 1024).toFixed(0)} KB
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300">
                {removalMethod === 'surgical' ? (
                  <p>
                    <strong>Extracción vectorial quirúrgica completada:</strong> Se removió únicamente el objeto gráfico del sello y el texto del folio incrustado por este programa. Todo el contenido original, líneas y texto de fondo quedaron 100% intactos sin cajas blancas.
                  </p>
                ) : (
                  <p>
                    Las fojas seleccionadas quedaron limpias. Ahora podés descargar el PDF o pasar directamente a foliarlo con la numeración correcta.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-1">
                {/* Download clean PDF */}
                <button
                  type="button"
                  id="unstamp-download-btn"
                  onClick={handleDownloadResult}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF Desfoliado</span>
                </button>

                {/* Option to go to StampTool and re-stamp correctly */}
                {onGoToStamp && (
                  <button
                    type="button"
                    id="unstamp-restamp-btn"
                    onClick={handleGoToRestamp}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Stamp className="w-4 h-4" />
                    <span>Pasar a Foliar de Nuevo con numeración correcta</span>
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenResultInNewTab}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver en pestaña</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProcessedBytes(null)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Cerrar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
