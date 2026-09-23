/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { FolioConfig, RelativeFolioPosition, StandardFontName } from '../types';
import { formatFolioText } from '../lib/pdfExporter';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Crosshair,
  Hash,
  Sparkles,
  Type,
} from 'lucide-react';

interface FolioCalibratorProps {
  folio: FolioConfig;
  svgRaw: string;
  totalPages: number;
  scale: number;
  onChange: (updated: FolioConfig) => void;
}

export const FolioCalibrator: React.FC<FolioCalibratorProps> = ({
  folio,
  svgRaw,
  totalPages,
  scale,
  onChange,
}) => {
  const rel = folio.relativePosition;
  const reticleContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingReticle, setIsDraggingReticle] = useState(false);

  const updateRel = (changes: Partial<RelativeFolioPosition>) => {
    onChange({
      ...folio,
      relativePosition: {
        ...rel,
        ...changes,
      },
    });
  };

  const samplePreviewText = formatFolioText(
    folio.format,
    folio.startNumber,
    folio.padDigits,
    totalPages
  );

  const lastFolioText = formatFolioText(
    folio.format,
    folio.startNumber + Math.max(0, totalPages - 1),
    folio.padDigits,
    totalPages
  );

  const handlePointerDownReticle = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDraggingReticle(true);
    handlePointerMoveReticle(e);
  };

  const handlePointerMoveReticle = (e: React.PointerEvent) => {
    if (!isDraggingReticle && e.type !== 'pointerdown') return;
    if (!reticleContainerRef.current) return;
    const rect = reticleContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    updateRel({
      x: Math.round(relX * 1000) / 1000,
      y: Math.round(relY * 1000) / 1000,
    });
  };

  const handlePointerUpReticle = () => {
    setIsDraggingReticle(false);
  };

  // Quick alignment presets
  const applyPreset = (preset: 'box' | 'below' | 'center' | 'top' | 'right') => {
    switch (preset) {
      case 'box':
        // Inside the designated folio receptive box of Instituto de Cultura de Corrientes
        updateRel({ x: 0.50, y: 0.51, textAlign: 'center' });
        break;
      case 'below':
        updateRel({ x: 0.5, y: 1.15, textAlign: 'center' });
        break;
      case 'center':
        updateRel({ x: 0.5, y: 0.5, textAlign: 'center' });
        break;
      case 'top':
        updateRel({ x: 0.5, y: -0.15, textAlign: 'center' });
        break;
      case 'right':
        updateRel({ x: 1.05, y: 0.5, textAlign: 'left' });
        break;
    }
  };

  return (
    <div id="folio-calibrator-panel" className="space-y-4">
      {/* SECCIÓN 1: NÚMERO INICIAL Y FORMATO (ARRIBA Y A MANO) */}
      <div className="bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-700/80 rounded-xl p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900 dark:text-blue-200 uppercase tracking-wide">
            <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Foliación y Número Inicial</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
            Principal
          </span>
        </div>

        {/* Número Inicial Controls */}
        <div>
          <label className="text-xs text-slate-800 dark:text-slate-200 block mb-1 font-semibold">
            Número Inicial de Folio:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 rounded-lg p-1 shadow-xs flex-1">
              <button
                type="button"
                id="dec-folio-start-btn"
                onClick={() =>
                  onChange({
                    ...folio,
                    startNumber: Math.max(1, folio.startNumber - 1),
                  })
                }
                className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors cursor-pointer"
                title="Restar 1 al número inicial"
              >
                -
              </button>

              <input
                type="number"
                id="folio-start-number-input"
                min={1}
                max={999999}
                value={folio.startNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChange({
                    ...folio,
                    startNumber: isNaN(val) || val < 1 ? 1 : val,
                  });
                }}
                className="flex-1 text-center font-mono font-extrabold text-lg text-slate-900 dark:text-white bg-transparent outline-hidden"
              />

              <button
                type="button"
                id="inc-folio-start-btn"
                onClick={() =>
                  onChange({
                    ...folio,
                    startNumber: folio.startNumber + 1,
                  })
                }
                className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors cursor-pointer"
                title="Sumar 1 al número inicial"
              >
                +
              </button>
            </div>
          </div>

          {/* Rango resultante en tiempo real */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-blue-900 dark:text-blue-200 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
            <span>
              Comienza en: <strong className="font-mono">{samplePreviewText}</strong>
            </span>
            <span>
              Finaliza en: <strong className="font-mono">{lastFolioText}</strong> ({totalPages} pág.)
            </span>
          </div>
        </div>

        {/* Formato del Texto y Ceros a la Izquierda */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Ceros a la Izquierda:
            </label>
            <select
              id="folio-padding-select"
              value={folio.padDigits}
              onChange={(e) => onChange({ ...folio, padDigits: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            >
              <option value={0}>Sin ceros (1, 2, 10)</option>
              <option value={2}>2 dígitos (01, 02)</option>
              <option value={3}>3 dígitos (001, 002)</option>
              <option value={4}>4 dígitos (0001)</option>
              <option value={6}>6 dígitos (000001)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Formato de Texto:
            </label>
            <input
              type="text"
              id="folio-format-input"
              value={folio.format}
              onChange={(e) => onChange({ ...folio, format: e.target.value })}
              placeholder="{n}"
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        {/* Chips de formato rápido */}
        <div className="flex flex-wrap gap-1">
          {['{n}', 'Folio N° {n}', 'Folio {n}', 'Fs. {n}', 'Expte. {n}'].map((tpl) => (
            <button
              key={tpl}
              type="button"
              onClick={() => onChange({ ...folio, format: tpl })}
              className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-colors cursor-pointer ${
                folio.format === tpl
                  ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-700'
              }`}
            >
              {tpl}
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN 2: TAMAÑO Y APARIENCIA */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            <Type className="w-4 h-4 text-blue-600" />
            <span>Tamaño y Tipografía</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {rel.fontSize} pt base
          </span>
        </div>

        {/* Font Size with [ - ] 13.5 pt [ + ] buttons */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Tamaño del Número:</span>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1 shadow-2xs">
            <button
              type="button"
              id="decrease-folio-size-btn"
              onClick={() =>
                updateRel({
                  fontSize: Math.max(6, Math.round((rel.fontSize - 1) * 10) / 10),
                })
              }
              className="w-7 h-7 flex items-center justify-center rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-700 active:bg-slate-200 active:dark:bg-slate-600 font-bold text-sm transition-colors cursor-pointer"
              title="Reducir tamaño del folio (-1 pt)"
            >
              -
            </button>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 px-2 min-w-14 text-center">
              {rel.fontSize} pt
            </span>
            <button
              type="button"
              id="increase-folio-size-btn"
              onClick={() =>
                updateRel({
                  fontSize: Math.min(72, Math.round((rel.fontSize + 1) * 10) / 10),
                })
              }
              className="w-7 h-7 flex items-center justify-center rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-700 active:bg-slate-200 active:dark:bg-slate-600 font-bold text-sm transition-colors cursor-pointer"
              title="Aumentar tamaño del folio (+1 pt)"
            >
              +
            </button>
          </div>
        </div>

        {/* Tipografía & Alineación */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">Tipografía Vectorial:</label>
            <select
              id="folio-font-select"
              value={rel.fontFamily}
              onChange={(e) => updateRel({ fontFamily: e.target.value as StandardFontName })}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            >
              <option value="Helvetica-Bold">Helvetica Bold</option>
              <option value="Helvetica">Helvetica Normal</option>
              <option value="Times-Roman-Bold">Times Bold</option>
              <option value="Times-Roman">Times Normal</option>
              <option value="Courier-Bold">Courier Bold</option>
              <option value="Courier">Courier Normal</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">Alineación del Texto:</label>
            <div className="flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => updateRel({ textAlign: align })}
                  className={`flex-1 py-1.5 flex items-center justify-center transition-colors cursor-pointer ${
                    rel.textAlign === align
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:dark:bg-slate-800/60'
                  }`}
                  title={align}
                >
                  {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                  {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                  {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">Color del Folio:</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="folio-color-picker"
              value={rel.color}
              onChange={(e) => updateRel({ color: e.target.value })}
              className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 p-0.5 cursor-pointer bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              id="folio-color-hex"
              value={rel.color}
              onChange={(e) => updateRel({ color: e.target.value })}
              className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono uppercase text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => updateRel({ color: '#000000' })}
              className="text-[11px] px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Negro
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: CALIBRACIÓN DE POSICIÓN RELATIVA DENTRO DEL SELLO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">
            <Crosshair className="w-4 h-4 text-blue-600" />
            <span>Posición del Folio en el Sello</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            X: {Math.round(rel.x * 100)}% | Y: {Math.round(rel.y * 100)}%
          </span>
        </div>

        {/* Quick Position Presets */}
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              id="preset-box-btn"
              onClick={() => applyPreset('box')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between transition-colors shadow-xs cursor-pointer"
            >
              <span>Recuadro Oficial</span>
              <span className="text-[10px] text-blue-600 font-mono font-bold">51% Y</span>
            </button>
            <button
              type="button"
              id="preset-center-btn"
              onClick={() => applyPreset('center')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between transition-colors shadow-xs cursor-pointer"
            >
              <span>Centro del Sello</span>
              <span className="text-[10px] text-blue-600 font-mono font-bold">50% Y</span>
            </button>
            <button
              type="button"
              id="preset-below-btn"
              onClick={() => applyPreset('below')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between transition-colors shadow-xs cursor-pointer"
            >
              <span>Debajo del Sello</span>
              <span className="text-[10px] text-blue-600 font-mono font-bold">115% Y</span>
            </button>
            <button
              type="button"
              id="preset-top-btn"
              onClick={() => applyPreset('top')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between transition-colors shadow-xs cursor-pointer"
            >
              <span>Arriba del Sello</span>
              <span className="text-[10px] text-blue-600 font-mono font-bold">-15% Y</span>
            </button>
          </div>
        </div>

        {/* Retículo Interactivo */}
        <div
          className="relative w-full h-40 bg-slate-900/5 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center p-2 select-none cursor-crosshair"
          onPointerMove={handlePointerMoveReticle}
          onPointerUp={handlePointerUpReticle}
        >
          {/* SVG Graphic Container */}
          <div
            ref={reticleContainerRef}
            onPointerDown={handlePointerDownReticle}
            className="relative max-w-[80%] max-h-[75%] flex items-center justify-center touch-none"
          >
            <div
              className="w-full h-full opacity-70 pointer-events-none drop-shadow-sm [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-24 select-none"
              dangerouslySetInnerHTML={{ __html: svgRaw }}
            />

            {/* Indicador de folio calibrado */}
            <div
              className="absolute transition-all duration-75 select-none z-10 flex flex-col items-center pointer-events-none"
              style={{
                left: `${rel.x * 100}%`,
                top: `${rel.y * 100}%`,
                transform: `translate(${rel.textAlign === 'center' ? '-50%' : rel.textAlign === 'right' ? '-100%' : '0%'}, -50%)`,
              }}
            >
              <div
                className="px-2 py-0.5 rounded border border-blue-500 ring-2 ring-blue-400/40 bg-white dark:bg-slate-800/95 font-mono font-bold tracking-tight whitespace-nowrap shadow-sm text-blue-900 dark:text-blue-100"
                style={{
                  fontSize: `${Math.max(10, Math.min(18, rel.fontSize * 0.85))}px`,
                  color: rel.color,
                }}
              >
                {samplePreviewText}
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white -mt-1 shadow-sm" />
            </div>
          </div>

          <div className="absolute bottom-1.5 left-2 text-[10px] text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            Arrastra el número para calibrar posición
          </div>
        </div>

        {/* Sliders X & Y */}
        <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Posición X (Horizontal):</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{Math.round(rel.x * 100)}%</span>
            </div>
            <input
              type="range"
              id="relative-x-slider"
              min={-50}
              max={150}
              step={1}
              value={Math.round(rel.x * 100)}
              onChange={(e) => updateRel({ x: parseFloat(e.target.value) / 100 })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Posición Y (Vertical):</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{Math.round(rel.y * 100)}%</span>
            </div>
            <input
              type="range"
              id="relative-y-slider"
              min={-50}
              max={150}
              step={1}
              value={Math.round(rel.y * 100)}
              onChange={(e) => updateRel({ y: parseFloat(e.target.value) / 100 })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
