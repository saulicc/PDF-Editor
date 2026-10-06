/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eraser,
  RotateCcw,
  FileText,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { StampGroup, PageRangeType } from '../types';

interface RemoveStampModalProps {
  isOpen: boolean;
  fileName: string;
  totalPages: number;
  stampGroup: StampGroup;
  isStampActive: boolean;
  hasOriginalDoc: boolean;
  onClose: () => void;
  onRemoveFromAllPages: () => void;
  onDownloadOriginalClean: () => void;
  onEraseEmbeddedStamps?: (range: PageRangeType, customStr: string) => Promise<void>;
  isProcessingErase?: boolean;
}

export const RemoveStampModal: React.FC<RemoveStampModalProps> = ({
  isOpen,
  fileName,
  totalPages,
  stampGroup,
  isStampActive,
  hasOriginalDoc,
  onClose,
  onRemoveFromAllPages,
  onDownloadOriginalClean,
  onEraseEmbeddedStamps,
  isProcessingErase = false,
}) => {
  const [eraseRange, setEraseRange] = useState<PageRangeType>('all');
  const [customRange, setCustomRange] = useState<string>(`1-${totalPages}`);
  const [showAdvancedErase, setShowAdvancedErase] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div
      id="remove-stamp-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Eraser className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Quitar de Todas las Páginas</h3>
                <span className="text-[10px] bg-rose-500/30 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded-full font-semibold">
                  Hacer lo opuesto
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Por si te olvidaste de algo o necesitás dejar el documento limpio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Context box */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {fileName}
              </span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">
              {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            ¿Te olvidaste de agregar una foja, una firma o un anexo? Elegí la acción que mejor se adapte a lo que necesitás hacer:
          </p>

          {/* Action 1: Remove stamp and revert to clean workspace */}
          <div className="border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl p-4 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Eraser className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-rose-950 dark:text-rose-200">
                  Quitar sello y folio de todas las páginas
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                  Remueve el sello y los números de folio del espacio de trabajo en todas las páginas para que tu documento quede completamente limpio. Si querés volver a colocarlo más tarde, podrás hacerlo con 1 clic.
                </p>

                <button
                  type="button"
                  id="modal-confirm-remove-stamp-btn"
                  onClick={() => {
                    onRemoveFromAllPages();
                    onClose();
                  }}
                  className="mt-3 w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Quitar de todas las páginas ahora</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action 2: Download original clean PDF */}
          {hasOriginalDoc && (
            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Descargar copia del PDF original limpio
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Descargá el archivo original intacto, sin sellos ni folios aplicados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDownloadOriginalClean}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Descargar
              </button>
            </div>
          )}

          {/* Action 3 (Advanced): Erase / blank out embedded stamp markings on imported PDF */}
          {onEraseEmbeddedStamps && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowAdvancedErase(!showAdvancedErase)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    ¿El archivo ya tenía sellos impresos/incrustados?
                  </span>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  {showAdvancedErase ? 'Ocultar' : 'Blanquear área'}
                </span>
              </button>

              {showAdvancedErase && (
                <div className="p-3 bg-white dark:bg-slate-800 space-y-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aplica un parche de limpieza blanco sobre la posición del sello en las páginas elegidas para borrar sellos previamente incrustados en el documento.
                  </p>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="eraseRange"
                        value="all"
                        checked={eraseRange === 'all'}
                        onChange={() => setEraseRange('all')}
                        className="text-rose-600"
                      />
                      <span>En todas las páginas (1 a {totalPages})</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="eraseRange"
                        value="custom"
                        checked={eraseRange === 'custom'}
                        onChange={() => setEraseRange('custom')}
                        className="text-rose-600"
                      />
                      <span>Rango específico:</span>
                    </label>

                    {eraseRange === 'custom' && (
                      <input
                        type="text"
                        value={customRange}
                        onChange={(e) => setCustomRange(e.target.value)}
                        placeholder="Ej: 1-5, 8"
                        className="w-full ml-5 text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md font-mono"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isProcessingErase}
                    onClick={async () => {
                      await onEraseEmbeddedStamps(eraseRange, customRange);
                      onClose();
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>
                      {isProcessingErase ? 'Blanqueando marcas...' : 'Blanquear y limpiar zona del sello'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar / Volver
          </button>
        </div>
      </div>
    </div>
  );
};
