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
  Layers,
  Wand2,
} from 'lucide-react';
import { StampGroup, PageRangeType } from '../types';

interface RemoveStampModalProps {
  isOpen: boolean;
  fileName: string;
  totalPages: number;
  stampGroup: StampGroup;
  isStampActive: boolean;
  hasOriginalDoc: boolean;
  detectedVectorPages?: number[];
  onClose: () => void;
  onRemoveFromAllPages: () => void;
  onDownloadOriginalClean: () => void;
  onRemoveVectorStamps?: (pageNumbers?: number[]) => Promise<void>;
  isProcessingVectorRemoval?: boolean;
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
  detectedVectorPages = [],
  onClose,
  onRemoveFromAllPages,
  onDownloadOriginalClean,
  onRemoveVectorStamps,
  isProcessingVectorRemoval = false,
  onEraseEmbeddedStamps,
  isProcessingErase = false,
}) => {
  const [vectorSelectionMode, setVectorSelectionMode] = useState<'detected' | 'all' | 'custom'>(
    detectedVectorPages.length > 0 ? 'detected' : 'all'
  );
  const [customVectorPagesStr, setCustomVectorPagesStr] = useState<string>(
    detectedVectorPages.length > 0 ? detectedVectorPages.join(', ') : `1-${totalPages}`
  );

  const [eraseRange, setEraseRange] = useState<PageRangeType>('all');
  const [customRange, setCustomRange] = useState<string>(`1-${totalPages}`);
  const [showAdvancedErase, setShowAdvancedErase] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExecuteVectorRemoval = async () => {
    if (!onRemoveVectorStamps) return;

    let targetPages: number[] | undefined = undefined;
    if (vectorSelectionMode === 'detected' && detectedVectorPages.length > 0) {
      targetPages = detectedVectorPages;
    } else if (vectorSelectionMode === 'custom') {
      // parse custom pages
      const pages: number[] = [];
      const tokens = customVectorPagesStr.split(/[,;\s]+/);
      for (const tok of tokens) {
        if (!tok.trim()) continue;
        if (tok.includes('-')) {
          const [s, e] = tok.split('-').map(Number);
          if (!isNaN(s) && !isNaN(e)) {
            for (let p = Math.min(s, e); p <= Math.max(s, e); p++) {
              if (p >= 1 && p <= totalPages) pages.push(p);
            }
          }
        } else {
          const p = Number(tok);
          if (!isNaN(p) && p >= 1 && p <= totalPages) pages.push(p);
        }
      }
      if (pages.length > 0) targetPages = pages;
    }
    await onRemoveVectorStamps(targetPages);
    onClose();
  };

  return (
    <div
      id="remove-stamp-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Eraser className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Quitar Sello y Foliador</h3>
                <span className="text-[10px] bg-rose-500/30 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded-full font-semibold">
                  Hacer lo opuesto
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Opciones para desaplicar o remover quirúrgicamente el vector del PDF
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

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
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

          {/* FEATURE 1: SURGICAL VECTOR DETECTION & REMOVAL */}
          {onRemoveVectorStamps && (
            <div className="border-2 border-indigo-500/80 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                      Detectar y quitar vector inyectado en el PDF
                    </h4>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 px-1.5 py-0.2 rounded font-semibold">
                      Sin parches blancos
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                    Detecta quirúrgicamente el vector del sello y el texto del foliador colocados previamente por este programa en el archivo PDF y los elimina del flujo de datos, <strong>sin tapar ni borrar ningún texto, membrete o firma que esté debajo</strong>.
                  </p>

                  {/* Detection badge */}
                  {detectedVectorPages.length > 0 ? (
                    <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Se detectó vector de sello/folio en <strong>{detectedVectorPages.length}</strong> {detectedVectorPages.length === 1 ? 'página' : 'páginas'}: {detectedVectorPages.slice(0, 8).join(', ')}{detectedVectorPages.length > 8 ? '...' : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        Remueve las capas vectoriales de sello / folio Form XObject del PDF.
                      </span>
                    </div>
                  )}

                  {/* Removal options */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    {detectedVectorPages.length > 0 && (
                      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="vectorRemovalScope"
                          checked={vectorSelectionMode === 'detected'}
                          onChange={() => setVectorSelectionMode('detected')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Quitar solo de las páginas detectadas ({detectedVectorPages.length})</span>
                      </label>
                    )}

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="vectorRemovalScope"
                        checked={vectorSelectionMode === 'all'}
                        onChange={() => setVectorSelectionMode('all')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Quitar de todas las páginas (1 a {totalPages})</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="vectorRemovalScope"
                        checked={vectorSelectionMode === 'custom'}
                        onChange={() => setVectorSelectionMode('custom')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Elegir páginas específicas:</span>
                    </label>

                    {vectorSelectionMode === 'custom' && (
                      <input
                        type="text"
                        value={customVectorPagesStr}
                        onChange={(e) => setCustomVectorPagesStr(e.target.value)}
                        placeholder="Ej: 1-5, 8, 12"
                        className="w-full ml-5 text-xs px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md font-mono"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    id="modal-remove-vector-stamp-btn"
                    disabled={isProcessingVectorRemoval}
                    onClick={handleExecuteVectorRemoval}
                    className="mt-3.5 w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>
                      {isProcessingVectorRemoval
                        ? 'Removiendo vector del PDF...'
                        : 'Quitar vector del sello ahora (Limpio)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FEATURE 2: WORKSPACE QUICK TOGGLE (REVERT CURRENT PLACEMENT) */}
          <div className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <Eraser className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Desactivar sello del visor actual (No aplicar al exportar)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Quita el sello visual del área de trabajo. Si estás por exportar y decidiste no incluir sello ni foliador, usá esta opción.
                </p>

                <button
                  type="button"
                  id="modal-confirm-remove-stamp-btn"
                  onClick={async () => {
                    await onRemoveFromAllPages();
                    onClose();
                  }}
                  className="mt-2.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Quitar sello y folio de todas las páginas</span>
                </button>
              </div>
            </div>
          </div>

          {/* FEATURE 3: DOWNLOAD ORIGINAL CLEAN PDF */}
          {hasOriginalDoc && (
            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Descargar copia del PDF original limpio
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Descargá el archivo original tal como lo cargaste al iniciar la sesión
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

          {/* FEATURE 4 (OPTIONAL/FALLBACK): WHITEOUT PATCH FOR SCANNED BITMAPS */}
          {onEraseEmbeddedStamps && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowAdvancedErase(!showAdvancedErase)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Opción alternativa: Parche blanco (solo para sellos de fotos/escaneos externos)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {showAdvancedErase ? 'Ocultar' : 'Ver'}
                </span>
              </button>

              {showAdvancedErase && (
                <div className="p-3 bg-white dark:bg-slate-800 space-y-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg leading-normal">
                    ⚠️ <em>Atención:</em> Esta opción dibuja un recuadro blanco sobre la zona del sello. Si el documento tiene texto o firmas detrás, quedarán cubiertas. Usá preferentemente la opción superior <strong>"Detectar y quitar vector"</strong> para un resultado perfecto sin parches.
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
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>
                      {isProcessingErase ? 'Blanqueando marcas...' : 'Aplicar parche blanco en zona del sello'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  );
};
