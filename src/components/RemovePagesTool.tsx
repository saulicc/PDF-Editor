/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Upload, ListX, Trash2, Download, RotateCcw, Loader2 } from 'lucide-react';
import { DocumentInfo } from '../types';
import { loadUserPdfDocument } from '../lib/pdfRenderer';
import { extractPages, downloadBytes } from '../lib/pdfTools';
import { usePdfThumbnails } from '../lib/useThumbnails';

interface RemovePagesToolProps {
  onBack: () => void;
}

export default function RemovePagesTool({ onBack }: RemovePagesToolProps) {
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [columnsPerRow, setColumnsPerRow] = useState<number>(4);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { thumbnails, isLoading: thumbsLoading } = usePdfThumbnails(
    docInfo?.pdfBytes ?? null,
    docInfo?.totalPages ?? 0
  );

  const keptCount = (docInfo?.totalPages ?? 0) - removedIndices.size;

  const handleUpload = async (file: File) => {
    try {
      setUploadError(null);
      setIsLoadingUpload(true);
      const doc = await loadUserPdfDocument(file);
      setDocInfo(doc);
      setRemovedIndices(new Set());
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo leer el archivo PDF.');
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const toggleRemoved = (index: number) => {
    setRemovedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const resetSelection = () => setRemovedIndices(new Set());

  const handleDownload = async () => {
    if (!docInfo || keptCount === 0) return;
    try {
      setIsExporting(true);
      const keepIndices = Array.from({ length: docInfo.totalPages }, (_, i) => i).filter(
        (i) => !removedIndices.has(i)
      );
      const bytes = await extractPages(docInfo.pdfBytes, keepIndices);
      downloadBytes(bytes, docInfo.fileName.replace(/\.pdf$/i, '') + '_editado.pdf');
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
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm">
              <ListX className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Eliminar Páginas
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargá un PDF y vas a poder ver todas sus hojas chiquitas para sacar las que no querés.
          </p>

          {isLoadingUpload ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cargando documento...</p>
            </div>
          ) : (
            <label
              htmlFor="remove-pages-upload-input"
              className="block w-full py-10 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
            >
              <Upload className="w-7 h-7 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Hacé clic o arrastrá tu PDF acá
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Formato .pdf</p>
              <input
                id="remove-pages-upload-input"
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
              {keptCount} de {docInfo.totalPages} páginas se van a conservar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <label htmlFor="columns-per-row-select" className="font-medium whitespace-nowrap">
              Miniaturas por fila:
            </label>
            <select
              id="columns-per-row-select"
              value={columnsPerRow}
              onChange={(e) => setColumnsPerRow(Number(e.target.value))}
              className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
            >
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {removedIndices.size > 0 && (
            <button
              type="button"
              onClick={resetSelection}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:dark:text-slate-100 px-2.5 py-2 rounded-lg hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deshacer todo</span>
            </button>
          )}
          <button
            type="button"
            disabled={keptCount === 0 || isExporting}
            onClick={handleDownload}
            className="flex items-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generando...' : `Descargar (${keptCount})`}</span>
          </button>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div className="flex-1 overflow-y-auto p-5">
        <div
          className={`grid gap-4 w-full mx-auto ${
            columnsPerRow === 2
              ? 'max-w-2xl'
              : columnsPerRow === 3
              ? 'max-w-3xl'
              : columnsPerRow === 4
              ? 'max-w-5xl'
              : columnsPerRow === 5
              ? 'max-w-6xl'
              : columnsPerRow === 6
              ? 'max-w-7xl'
              : 'max-w-[1500px]'
          }`}
          style={{
            gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: docInfo.totalPages }, (_, i) => i).map((i) => {
            const isRemoved = removedIndices.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleRemoved(i)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer text-left ${
                  isRemoved
                    ? 'border-rose-500 opacity-40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
                title={isRemoved ? 'Restaurar página' : 'Quitar página'}
              >
                <div className="aspect-[3/4] bg-white dark:bg-slate-800 flex items-center justify-center p-1">
                  {thumbnails[i] ? (
                    <img src={thumbnails[i]} alt={`Página ${i + 1}`} className="w-full h-full object-contain pointer-events-none" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-slate-300 dark:text-slate-500 animate-spin" />
                  )}
                </div>
                <div
                  className={`absolute bottom-0 inset-x-0 text-center text-[10px] font-bold py-0.5 ${
                    isRemoved
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900/70 text-white'
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                    isRemoved ? 'bg-rose-600 text-white' : 'bg-white/90 dark:bg-slate-900/80 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
        {thumbsLoading && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">Generando miniaturas...</p>
        )}
      </div>
    </div>
  );
}
