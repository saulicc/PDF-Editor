/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, CheckCircle2, FileText, ExternalLink, X, ShieldCheck, FolderOpen, FileUp } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  exportedPdfBytes: Uint8Array | null;
  fileName: string;
  totalPagesStamped: number;
  startFolio: number;
  endFolio: number;
  onClose: () => void;
  onUploadNextPdf?: (file: File, continueFolioSequence: boolean) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  exportedPdfBytes,
  fileName,
  totalPagesStamped,
  startFolio,
  endFolio,
  onClose,
  onUploadNextPdf,
}) => {
  const [continueFolioSequence, setContinueFolioSequence] = useState<boolean>(true);

  if (!isOpen || !exportedPdfBytes) return null;

  const downloadFile = () => {
    const blob = new Blob([exportedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, '') + '_foliado.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    const blob = new Blob([exportedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const sizeKb = (exportedPdfBytes.byteLength / 1024).toFixed(1);

  return (
    <div
      id="export-success-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base">¡Documento Foliado con Éxito!</h3>
              <p className="text-xs text-slate-300">
                100% Vectorial • Sello + Folio Indivisibles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content details */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Páginas intervenidas:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPagesStamped} páginas</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Secuencia de folios:</span>
              <span className="font-mono font-bold text-blue-700">
                {startFolio} → {endFolio}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Tamaño del archivo optimizado:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{sizeKb} KB</span>
            </div>
          </div>

          {/* Technical Compliance Badges */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Texto vectorial nativo:</strong> El número de folio no fue rasterizado, garantizando máxima nitidez de impresión legal.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Optimización Form XObject:</strong> El sello SVG se almacena como recurso único reutilizado en todas las fojas.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              id="modal-download-btn"
              onClick={downloadFile}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              id="modal-open-tab-btn"
              onClick={openInNewTab}
              className="py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Ver</span>
            </button>
          </div>

          {/* Cargar siguiente documento sin salir */}
          {onUploadNextPdf && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <FileUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ¿Querés seguir foliando otro documento?
                  </span>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={continueFolioSequence}
                    onChange={(e) => setContinueFolioSequence(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>
                    Continuar folio automáticamente en el <strong>N° {endFolio + 1}</strong>
                  </span>
                </label>
                <label
                  htmlFor="modal-next-pdf-upload"
                  className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 hover:dark:bg-slate-700/80 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Cargar siguiente PDF</span>
                  <input
                    id="modal-next-pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && onUploadNextPdf) {
                        onUploadNextPdf(file, continueFolioSequence);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
