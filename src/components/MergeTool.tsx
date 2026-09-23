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
  Loader2,
  Plus,
} from 'lucide-react';
import { mergePdfFiles, downloadBytes } from '../lib/pdfTools';
import { renderPdfPageToCanvas } from '../lib/pdfRenderer';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);

  // Generar miniaturas de la primera página para cada PDF
  useEffect(() => {
    items.forEach((item, index) => {
      if (item.previewUrl || !item.loadingPreview) return;

      let cancelled = false;
      const generateThumbnail = async () => {
        try {
          const arrayBuffer = await item.file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const canvas = document.createElement('canvas');

          // Renderizar primera página con buena definición para la card visual
          await renderPdfPageToCanvas(bytes, 1, canvas, 0.4);
          if (cancelled) return;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

          // También obtenemos el total de páginas con pdf-lib ligero
          let totalPages: number | null = null;
          try {
            const { PDFDocument } = await import('pdf-lib');
            const pdfDoc = await PDFDocument.load(bytes);
            totalPages = pdfDoc.getPageCount();
          } catch (_) {}

          if (cancelled) return;

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
      };

      generateThumbnail();
      return () => {
        cancelled = true;
      };
    });
  }, [items]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    setErrorMsg(null);
    setResultBytes(null);

    const newItems: PdfItem[] = pdfFiles.map((file, i) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${i}-${Math.random()}`,
      file,
      previewUrl: null,
      totalPages: null,
      loadingPreview: true,
    }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeFile = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setResultBytes(null);
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

  const handleMerge = async () => {
    if (items.length < 2) return;
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      const filesToMerge = items.map((it) => it.file);
      const bytes = await mergePdfFiles(filesToMerge);
      setResultBytes(bytes);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudieron unir los archivos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes) return;
    downloadBytes(resultBytes, 'documento_unido.pdf');
  };

  const reset = () => {
    setItems([]);
    setResultBytes(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 mb-5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Panel principal</span>
        </button>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Combine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100">Unir PDF</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arrastrá las tarjetas para ordenar los documentos antes de combinarlos.
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <label
              htmlFor="merge-upload-more"
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Agregar más PDFs</span>
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
          )}
        </div>

        {/* Upload zone */}
        {items.length === 0 ? (
          <label
            htmlFor="merge-upload-input"
            className="block w-full py-12 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors text-center"
          >
            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Hacé clic o arrastrá varios PDFs acá
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Podrás ordenarlos visualmente arrastrando sus portadas
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
            {/* Visual Reorderable Card Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-1">
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
                      if (dragOverIndex !== idx) {
                        setDragOverIndex(idx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) {
                        setDragOverIndex(null);
                      }
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
                    className={`group relative flex flex-col bg-white dark:bg-slate-800 border-2 rounded-2xl overflow-hidden shadow-2xs transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragging
                        ? 'opacity-40 scale-95 border-blue-500'
                        : isDragOver
                        ? 'border-blue-500 ring-2 ring-blue-500/20 scale-[1.02]'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Header bar of the card */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
                          PDF #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-grab" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Quitar este archivo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Preview visual (First page of the PDF) */}
                    <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-2.5 overflow-hidden">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-full h-full object-contain pointer-events-none rounded shadow-2xs border border-slate-200/60 dark:border-slate-700"
                        />
                      ) : item.loadingPreview ? (
                        <div className="flex flex-col items-center gap-1.5 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                          <span className="text-[10px] font-medium">Cargando vista...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <FileText className="w-10 h-10 text-red-500/70" />
                          <span className="text-[10px]">Sin previsualización</span>
                        </div>
                      )}

                      {/* Botones rápidos de mover izquierda / derecha */}
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

                    {/* Footer info (filename & pages) */}
                    <div className="p-2.5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/60">
                      <p
                        className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{formatFileSize(item.file.size)}</span>
                        {item.totalPages !== null && (
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {item.totalPages} {item.totalPages === 1 ? 'pág.' : 'págs.'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {items.length === 1 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-4 text-center">
            Agregá al menos un PDF más para poder unirlos.
          </p>
        )}
        {errorMsg && <p className="text-xs text-rose-600 mt-3 text-center">{errorMsg}</p>}

        {/* Result & Actions */}
        {resultBytes ? (
          <div className="mt-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>PDF unido correctamente según el orden establecido</span>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF unido</span>
              </button>
              <button
                type="button"
                onClick={reset}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        ) : (
          items.length >= 2 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={items.length < 2 || isProcessing}
                onClick={handleMerge}
                className="w-full max-w-md py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uniendo {items.length} PDFs...</span>
                  </>
                ) : (
                  <>
                    <Combine className="w-4 h-4" />
                    <span>Unir {items.length} PDFs en este orden</span>
                  </>
                )}
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
