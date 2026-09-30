/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Combine,
  Download,
  CheckCircle2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Plus,
  Zap,
  Eye,
  List,
  LayoutGrid,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import { mergePdfFiles, downloadBytes } from '../lib/pdfTools';
import { renderPdfPageToCanvas } from '../lib/pdfRenderer';
import { GlobalPdfDropOverlay } from './GlobalPdfDropOverlay';

interface MergeToolProps {
  onBack: () => void;
}

interface PdfItem {
  id: string;
  file: File;
  previewUrl: string | null;
  totalPages: number | null;
  loadingPreview: boolean;
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

export default function MergeTool({ onBack }: MergeToolProps) {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Modos de visualización y rendimiento (Punto 1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);

  // Progreso en vivo de unión (Punto 4)
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);

  // Control de concurrencia para generar miniaturas solo si previewEnabled está activo
  useEffect(() => {
    if (!previewEnabled) return;

    let cancelled = false;

    // Buscamos los que necesitan miniatura
    const pendingItems = items.filter((it) => !it.previewUrl && it.loadingPreview);
    if (pendingItems.length === 0) return;

    // Procesamos de forma secuencial / controlada para no saturar memoria RAM
    (async () => {
      for (const item of pendingItems) {
        if (cancelled) break;
        try {
          const arrayBuffer = await item.file.arrayBuffer();
          if (cancelled) break;
          const bytes = new Uint8Array(arrayBuffer);
          const canvas = document.createElement('canvas');

          await renderPdfPageToCanvas(bytes, 1, canvas, 0.35);
          if (cancelled) break;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

          let totalPages: number | null = null;
          try {
            const { PDFDocument } = await import('pdf-lib');
            const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            totalPages = pdfDoc.getPageCount();
          } catch (_) {}

          if (cancelled) break;

          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    previewUrl: dataUrl,
                    totalPages,
                    loadingPreview: false,
                  }
                : it
            )
          );
        } catch (e) {
          if (!cancelled) {
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id ? { ...it, loadingPreview: false } : it
              )
            );
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, previewEnabled]);

  const addFiles = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    setErrorMsg(null);
    setResultBytes(null);

    const projectedTotal = items.length + pdfFiles.length;
    const isLargeBatch = projectedTotal > 12;

    // Si entran más de 12 archivos, activamos automáticamente el Modo Rápido y Vista Lista
    if (isLargeBatch) {
      setViewMode('list');
      setPreviewEnabled(false);
    }

    const newItems: PdfItem[] = pdfFiles.map((file, i) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${i}-${Math.random()}`,
      file,
      previewUrl: null,
      totalPages: null,
      loadingPreview: !isLargeBatch && previewEnabled,
    }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeFile = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setResultBytes(null);
  };

  const clearAllFiles = () => {
    setItems([]);
    setResultBytes(null);
    setErrorMsg(null);
    setMergeProgress(null);
  };

  const moveItem = (from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResultBytes(null);
  };

  // Ordenamiento automático alfanumérico natural (útil para 100 archivos tipo Cuerpo 1, 2, ... 100)
  const sortFilesByName = (ascending = true) => {
    setItems((prev) => {
      const sorted = [...prev].sort((a, b) =>
        a.file.name.localeCompare(b.file.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
      return ascending ? sorted : sorted.reverse();
    });
    setResultBytes(null);
  };

  // Unión con barra de progreso en vivo (Punto 4)
  const handleMerge = async () => {
    if (items.length < 2) return;
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setMergeProgress({
        current: 1,
        total: items.length,
        fileName: items[0].file.name,
      });

      const filesToMerge = items.map((it) => it.file);
      const bytes = await mergePdfFiles(
        filesToMerge,
        (current, total, fileName) => {
          setMergeProgress({ current, total, fileName });
        }
      );

      setResultBytes(bytes);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudieron unir los archivos.');
    } finally {
      setIsProcessing(false);
      setMergeProgress(null);
    }
  };

  const handleDownload = () => {
    if (!resultBytes) return;
    const baseName =
      items.length > 0
        ? items[0].file.name.replace(/\.pdf$/i, '')
        : 'documentos';
    downloadBytes(resultBytes, `${baseName}_unido_${items.length}_archivos.pdf`);
  };

  const reset = () => {
    setResultBytes(null);
    setErrorMsg(null);
    setMergeProgress(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center relative">
      <GlobalPdfDropOverlay
        onFileDrop={(file) => addFiles([file])}
        onFilesDrop={(files) => addFiles(files)}
        title="Soltá los archivos PDF acá"
        description="Se agregarán al final de la lista para ser unidos."
      />

      {/* Top Bar Navigation */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Panel principal</span>
        </button>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Toggle de Modo Rápido / Miniaturas */}
            <button
              type="button"
              onClick={() => {
                const nextState = !previewEnabled;
                setPreviewEnabled(nextState);
                if (nextState) {
                  // Reactivar carga de miniaturas faltantes
                  setItems((prev) =>
                    prev.map((it) =>
                      it.previewUrl ? it : { ...it, loadingPreview: true }
                    )
                  );
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                previewEnabled
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100'
              }`}
              title={
                previewEnabled
                  ? 'Desactivar portadas para velocidad instantánea con 100+ archivos'
                  : 'Cargar portadas visuales de los PDFs'
              }
            >
              {previewEnabled ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">Portadas:</span>
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

            {/* Selector de Vista: Lista vs Grilla */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Vista de lista compacta (Recomendada para muchos archivos)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Vista de cuadrícula con portadas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Grilla</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Box */}
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        
        {/* Header Section */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Combine className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Unir archivos PDF
              </h1>
              {items.length > 0 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  {items.length} {items.length === 1 ? 'archivo' : 'archivos'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Combina múltiples documentos en un solo PDF respetando el orden correlativo de la lista.
            </p>
          </div>

          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Botón de Ordenar A-Z */}
              <button
                type="button"
                onClick={() => sortFilesByName(true)}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                title="Ordenar correlativamente por nombre natural de archivo (A-Z)"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Ordenar A-Z</span>
              </button>

              {/* Botón de Agregar más */}
              <label
                htmlFor="merge-upload-more"
                className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar más</span>
                <input
                  id="merge-upload-more"
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

              {/* Limpiar lista */}
              <button
                type="button"
                onClick={clearAllFiles}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Vaciar lista"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Upload Zone (Empty State) */}
        {items.length === 0 ? (
          <label
            htmlFor="merge-upload-input"
            className="block w-full py-14 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-900 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 cursor-pointer transition-colors text-center group shadow-2xs"
          >
            <Upload className="w-9 h-9 text-blue-600 mx-auto mb-3 transition-transform group-hover:-translate-y-1" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Hacé clic o arrastrá varios PDFs acá (soporta 100+ archivos)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Podrás ordenarlos fácilmente por lista compacta o cuadrícula antes de unirlos
            </p>
            <input
              id="merge-upload-input"
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
            
            {/* Aviso inteligente si son más de 12 archivos */}
            {items.length > 12 && !previewEnabled && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Modo Rápido activo:</strong> Vista optimizada sin sobrecarga de memoria RAM para {items.length} archivos.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Fluidez 100%
                </span>
              </div>
            )}

            {/* ======================================================== */}
            {/* PUNTO 1: VISTA DE LISTA COMPACTA                        */}
            {/* ======================================================== */}
            {viewMode === 'list' ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors gap-3"
                    >
                      {/* Columna Izquierda: Posición, ícono y nombre */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                          #{idx + 1}
                        </span>

                        <FileText className="w-4 h-4 text-red-500 shrink-0" />

                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                            title={item.file.name}
                          >
                            {item.file.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            <span>{formatFileSize(item.file.size)}</span>
                            {item.totalPages !== null && (
                              <>
                                <span>•</span>
                                <span>{item.totalPages} págs</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Columna Derecha: Acciones de reordenamiento rápido */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, idx - 1)}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                          title="Subir un lugar"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => moveItem(idx, idx + 1)}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                          title="Bajar un lugar"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Quitar de la lista"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ======================================================== */
              /* VISTA DE CUADRÍCULA (PORTADAS)                           */
              /* ======================================================== */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 max-h-[550px] overflow-y-auto p-1">
                {items.map((item, idx) => {
                  const isDragging = dragIndex === idx;
                  const isDragOver = dragOverIndex === idx && dragIndex !== idx;

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIndex !== idx) setDragOverIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== idx) {
                          moveItem(dragIndex, idx);
                        }
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`group relative flex flex-col bg-white dark:bg-slate-800 border-2 rounded-xl overflow-hidden shadow-2xs transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging
                          ? 'opacity-40 scale-95 border-blue-500'
                          : isDragOver
                          ? 'border-blue-500 ring-2 ring-blue-500/20 scale-[1.02]'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
                            PDF #{idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="p-0.5 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Quitar este archivo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Portada visual */}
                      <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                        {previewEnabled ? (
                          item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-full object-contain pointer-events-none rounded shadow-2xs"
                            />
                          ) : item.loadingPreview ? (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                              <span className="text-[10px]">Cargando...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <FileText className="w-8 h-8 text-red-500/70" />
                              <span className="text-[10px]">Sin portada</span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                            <FileText className="w-9 h-9 stroke-1 text-blue-600/70" />
                            <span className="text-[10px] font-mono">Modo Rápido</span>
                          </div>
                        )}

                        {/* Flechas rápidas para mover */}
                        <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveItem(idx, idx - 1);
                            }}
                            className="pointer-events-auto p-1 rounded-lg bg-slate-900/80 hover:bg-blue-600 text-white disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
                            title="Mover antes"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveItem(idx, idx + 1);
                            }}
                            className="pointer-events-auto p-1 rounded-lg bg-slate-900/80 hover:bg-blue-600 text-white disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
                            title="Mover después"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Pie de tarjeta con nombre de archivo */}
                      <div className="p-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/60">
                        <p
                          className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{formatFileSize(item.file.size)}</span>
                          {item.totalPages !== null && (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {item.totalPages} págs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {items.length === 1 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-4 text-center">
            Agregá al menos un PDF más para poder unirlos.
          </p>
        )}
        {errorMsg && <p className="text-xs text-rose-600 mt-3 text-center">{errorMsg}</p>}

        {/* ======================================================== */}
        {/* PUNTO 4: BARRA DE PROGRESO EN VIVO AL UNIR               */}
        {/* ======================================================== */}
        {isProcessing && mergeProgress && (
          <div className="mt-6 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Uniendo archivo {mergeProgress.current} de {mergeProgress.total}...
              </span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
                {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="w-full h-2.5 bg-blue-150 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200 ease-out rounded-full"
                style={{
                  width: `${Math.round((mergeProgress.current / mergeProgress.total) * 100)}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-mono">
              Procesando: {mergeProgress.fileName}
            </p>
          </div>
        )}

        {/* Resultado y Descarga */}
        {resultBytes ? (
          <div className="mt-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>
                ¡{items.length} archivos PDF unidos correctamente con éxito!
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF unido ({formatFileSize(resultBytes.byteLength)})</span>
              </button>
              <button
                type="button"
                onClick={reset}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Unir otros archivos
              </button>
            </div>
          </div>
        ) : (
          !isProcessing &&
          items.length >= 2 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={items.length < 2 || isProcessing}
                onClick={handleMerge}
                className="w-full max-w-md py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                <Combine className="w-4 h-4" />
                <span>Unir {items.length} PDFs en este orden</span>
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Los archivos se unirán respetando el orden numerado (1 al {items.length})
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
