/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Download,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { DocumentInfo } from '../types';
import { loadUserPdfDocument } from '../lib/pdfRenderer';
import { extractPages, downloadBytes } from '../lib/pdfTools';
import { usePdfThumbnails } from '../lib/useThumbnails';

interface ReorderPagesToolProps {
  onBack: () => void;
}

export default function ReorderPagesTool({ onBack }: ReorderPagesToolProps) {
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { thumbnails, isLoading: thumbsLoading } = usePdfThumbnails(
    docInfo?.pdfBytes ?? null,
    docInfo?.totalPages ?? 0
  );

  useEffect(() => {
    if (docInfo) {
      setPageOrder(Array.from({ length: docInfo.totalPages }, (_, i) => i));
    }
  }, [docInfo]);

  const isOriginalOrder = docInfo ? pageOrder.every((v, i) => v === i) : true;

  const handleUpload = async (file: File) => {
    try {
      setUploadError(null);
      setIsLoadingUpload(true);
      const doc = await loadUserPdfDocument(file);
      setDocInfo(doc);
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo leer el archivo PDF.');
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const moveTo = (from: number, to: number) => {
    setPageOrder((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const resetOrder = () => {
    if (docInfo) setPageOrder(Array.from({ length: docInfo.totalPages }, (_, i) => i));
  };

  const handleDownload = async () => {
    if (!docInfo) return;
    try {
      setIsExporting(true);
      const bytes = await extractPages(docInfo.pdfBytes, pageOrder);
      downloadBytes(bytes, docInfo.fileName.replace(/\.pdf$/i, '') + '_reordenado.pdf');
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo generar el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!docInfo) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 relative">
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
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-sm">
              <ArrowUpDown className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Ordenar Páginas
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargá un PDF y reacomodá el orden de sus hojas arrastrando las miniaturas.
          </p>

          {isLoadingUpload ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cargando documento...</p>
            </div>
          ) : (
            <label
              htmlFor="reorder-upload-input"
              className="block w-full py-10 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
            >
              <Upload className="w-7 h-7 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Hacé clic o arrastrá tu PDF acá
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Formato .pdf</p>
              <input
                id="reorder-upload-input"
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

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Top bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Panel</span>
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{docInfo.fileName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Arrastrá una miniatura, o usá las flechas para moverla
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOriginalOrder && (
            <button
              type="button"
              onClick={resetOrder}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:dark:text-slate-100 px-2.5 py-2 rounded-lg hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer orden</span>
            </button>
          )}
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownload}
            className="flex items-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
        </div>
      </div>

      {/* Thumbnail grid, in current order */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {pageOrder.map((originalIndex, position) => (
            <div
              key={originalIndex}
              draggable
              onDragStart={() => setDragIndex(position)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== position) {
                  moveTo(dragIndex, position);
                }
                setDragIndex(null);
              }}
              className={`relative rounded-lg overflow-hidden border-2 bg-white dark:bg-slate-800 transition-all cursor-grab active:cursor-grabbing ${
                dragIndex === position ? 'border-blue-500 opacity-60' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="aspect-[3/4] flex items-center justify-center">
                {thumbnails[originalIndex] ? (
                  <img
                    src={thumbnails[originalIndex]}
                    alt={`Página original ${originalIndex + 1}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <Loader2 className="w-5 h-5 text-slate-300 dark:text-slate-500 animate-spin" />
                )}
              </div>

              <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {position + 1}
              </div>
              <div className="absolute top-1 right-1 bg-slate-900/60 text-white p-0.5 rounded">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[10px] text-center py-0.5">
                original pág. {originalIndex + 1}
              </div>

              <div className="absolute bottom-0 right-0 flex flex-col bg-white/90 dark:bg-slate-900/80 rounded-tl-lg overflow-hidden">
                <button
                  type="button"
                  disabled={position === 0}
                  onClick={() => moveTo(position, position - 1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Mover antes"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={position === pageOrder.length - 1}
                  onClick={() => moveTo(position, position + 1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Mover después"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {thumbsLoading && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">Generando miniaturas...</p>
        )}
      </div>
    </div>
  );
}
