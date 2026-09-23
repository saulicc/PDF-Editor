/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  DocumentInfo,
  PageRangeType,
  StampGroup,
  FolioConfig,
} from '../types';
import { PRESET_STAMPS, PresetStamp, parseAndCleanSvg } from '../lib/svgStamps';
import { getPageStampCoordinates } from '../lib/pdfExporter';
import { FolioCalibrator } from './FolioCalibrator';
import {
  FileText,
  Stamp,
  Sliders,
  Download,
  Upload,
  Layers,
  Sparkles,
  CheckCircle2,
  FileDown,
  RotateCcw,
  Compass,
  Hash,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
} from 'lucide-react';
import type { ThemeMode } from '../lib/useTheme';

// Formatea un valor en pt: entero sin decimales, o con 1 decimal si hace falta (ej. 33.5)
const formatPt = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

interface SidebarControlsProps {
  docInfo: DocumentInfo;
  currentPageIndex: number;
  stampGroup: StampGroup;
  rangeType: PageRangeType;
  customRangeStr: string;
  isExporting: boolean;
  exportPercent: number;
  exportStatusText: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onBack?: () => void;
  onDocChange: (newDoc: DocumentInfo) => void;
  onStampGroupChange: (updated: StampGroup) => void;
  onRangeTypeChange: (type: PageRangeType) => void;
  onCustomRangeStrChange: (str: string) => void;
  onGenerateSample: (pages: number) => void;
  onExportPdf: () => void;
  onUploadPdf?: (file: File) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Claro', Icon: Sun },
  { mode: 'dark', label: 'Oscuro', Icon: Moon },
  { mode: 'system', label: 'Sistema', Icon: Monitor },
];

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  docInfo,
  currentPageIndex,
  stampGroup,
  rangeType,
  customRangeStr,
  isExporting,
  exportPercent,
  exportStatusText,
  themeMode,
  onThemeModeChange,
  onBack,
  onDocChange,
  onStampGroupChange,
  onRangeTypeChange,
  onCustomRangeStrChange,
  onGenerateSample,
  onExportPdf,
  onUploadPdf,
}) => {
  const [activeTab, setActiveTab] = useState<'stamp' | 'folio' | 'document'>('stamp');
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);

  // Quick positioning on the current page
  const applyQuickPagePlacement = (
    corner: 'top-right' | 'bottom-right' | 'top-left' | 'center'
  ) => {
    const currPage = docInfo.pages[currentPageIndex] || { width: 595.28, height: 841.89 };
    const tempGroup: StampGroup = {
      ...stampGroup,
      placementPreset: corner,
      anchorHorizontal: corner === 'top-left' ? 'left' : corner === 'center' ? 'center' : 'right',
      anchorVertical: corner === 'bottom-right' ? 'bottom' : corner === 'center' ? 'center' : 'top',
      marginRight: 3,
      marginLeft: 3,
      marginTop: 3,
      marginBottom: 3,
    };
    const coords = getPageStampCoordinates(tempGroup, currPage.width, currPage.height);

    onStampGroupChange({
      ...tempGroup,
      x: coords.x,
      y: coords.y,
    });
  };

  // Handle user uploaded SVG
  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseAndCleanSvg(text);
        setSvgUploadError(null);

        const defaultW = 160;
        const defaultH = defaultW * (parsed.height / parsed.width);

        onStampGroupChange({
          ...stampGroup,
          name: file.name.replace(/\.svg$/i, ''),
          svgRaw: parsed.cleanSvg,
          originalWidth: parsed.width,
          originalHeight: parsed.height,
          aspectRatio: parsed.width / parsed.height,
          baseWidth: defaultW,
          baseHeight: defaultH,
          width: defaultW,
          height: defaultH,
          scale: 1.0,
          isCompositionLocked: false, // Start in Folio Calibration mode upon import
          folio: {
            ...stampGroup.folio,
            relativePosition: {
              ...stampGroup.folio.relativePosition,
              fontSize: Math.max(16, stampGroup.folio.relativePosition.fontSize || 18),
            },
          },
        });
        setActiveTab('folio'); // Open folio calibration immediately upon SVG import
      } catch (err: any) {
        setSvgUploadError(err.message || 'Error al procesar el archivo SVG.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Select a preset stamp
  const selectPresetStamp = (preset: PresetStamp) => {
    const parsed = parseAndCleanSvg(preset.svgContent);
    const currPage = docInfo.pages[currentPageIndex] || { width: 595.28, height: 841.89 };
    const tempGroup: StampGroup = {
      ...stampGroup,
      name: preset.name,
      svgRaw: parsed.cleanSvg,
      originalWidth: parsed.width,
      originalHeight: parsed.height,
      aspectRatio: parsed.width / parsed.height,
      baseWidth: preset.defaultWidth,
      baseHeight: preset.defaultHeight,
      width: preset.defaultWidth,
      height: preset.defaultHeight,
      scale: 1.0,
      isCompositionLocked: true,
      folio: {
        ...stampGroup.folio,
        startNumber: stampGroup.folio.startNumber ?? 1,
        format: preset.recommendedFolioRelativePosition.defaultFormat,
        relativePosition: {
          ...stampGroup.folio.relativePosition,
          x: preset.recommendedFolioRelativePosition.x,
          y: preset.recommendedFolioRelativePosition.y,
          fontSize: preset.recommendedFolioRelativePosition.fontSize,
          textAlign: preset.recommendedFolioRelativePosition.textAlign,
          color: preset.recommendedFolioRelativePosition.color,
        },
      },
    };
    const coords = getPageStampCoordinates(tempGroup, currPage.width, currPage.height);
    onStampGroupChange({
      ...tempGroup,
      x: coords.x,
      y: coords.y,
    });
  };

  return (
    <aside
      id="sidebar-controls"
      className="w-full lg:w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shrink-0 shadow-sm z-30"
    >
      {/* Brand & App Title Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-900 text-white">
        {onBack && (
          <button
            type="button"
            id="sidebar-back-to-dashboard-btn"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Panel principal</span>
          </button>
        )}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
            <Stamp className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm tracking-tight leading-tight">
              Sello y Foliador Vectorial
            </h1>
            <p className="text-[11px] text-slate-300">
              Objeto compuesto: Sello + Folio indivisible
            </p>
          </div>

          {/* Theme switcher */}
          <div
            role="group"
            aria-label="Elegir tema"
            className="flex items-center gap-0.5 bg-slate-800/80 border border-slate-700 rounded-lg p-0.5 shrink-0"
          >
            {THEME_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                title={label}
                aria-label={`Tema ${label}`}
                aria-pressed={themeMode === mode}
                onClick={() => onThemeModeChange(mode)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  themeMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Control Rápido de Número Inicial (siempre visible arriba y a mano) */}
        <div className="mt-3 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider shrink-0">
              N° Inicial:
            </span>
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                id="sidebar-quick-dec-start-number-btn"
                onClick={() =>
                  onStampGroupChange({
                    ...stampGroup,
                    folio: {
                      ...stampGroup.folio,
                      startNumber: Math.max(1, (stampGroup.folio.startNumber ?? 1) - 1),
                    },
                  })
                }
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded text-xs font-bold transition-colors cursor-pointer"
                title="Restar 1 al número inicial"
              >
                -
              </button>
              <input
                type="number"
                id="sidebar-quick-start-number-input"
                min={1}
                max={999999}
                value={stampGroup.folio.startNumber ?? 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onStampGroupChange({
                    ...stampGroup,
                    folio: {
                      ...stampGroup.folio,
                      startNumber: isNaN(val) || val < 1 ? 1 : val,
                    },
                  });
                }}
                className="w-14 text-center text-xs font-mono font-bold bg-transparent text-white outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                id="sidebar-quick-inc-start-number-btn"
                onClick={() =>
                  onStampGroupChange({
                    ...stampGroup,
                    folio: {
                      ...stampGroup.folio,
                      startNumber: (stampGroup.folio.startNumber ?? 1) + 1,
                    },
                  })
                }
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded text-xs font-bold transition-colors cursor-pointer"
                title="Sumar 1 al número inicial"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            id="sidebar-goto-folio-tab-btn"
            onClick={() => setActiveTab('folio')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'folio'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200'
            }`}
            title="Ir a calibración detallada del folio"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-300" />
            <span>Calibrar</span>
          </button>
        </div>

        {/* Documento en curso & Botón para cargar otro PDF sin salir */}
        <div className="mt-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate" title={docInfo.fileName}>
                {docInfo.fileName}
              </p>
              <p className="text-[10px] text-slate-400">
                {docInfo.totalPages} {docInfo.totalPages === 1 ? 'página' : 'páginas'} • {(docInfo.fileSize / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <label
            htmlFor="sidebar-quick-change-pdf-input"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Cargar otro documento PDF sin salir"
          >
            <Upload className="w-3 h-3" />
            <span>Cambiar PDF</span>
            <input
              id="sidebar-quick-change-pdf-input"
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (onUploadPdf) {
                    onUploadPdf(file);
                  } else {
                    const { loadUserPdfDocument } = await import('../lib/pdfRenderer');
                    const doc = await loadUserPdfDocument(file);
                    onDocChange(doc);
                  }
                }
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold">
        <button
          type="button"
          id="tab-stamp-btn"
          onClick={() => setActiveTab('stamp')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'stamp'
              ? 'border-blue-600 text-blue-700 bg-white dark:bg-slate-800'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100'
          }`}
        >
          <Stamp className="w-3.5 h-3.5" />
          <span>Sello SVG</span>
        </button>

        <button
          type="button"
          id="tab-folio-btn"
          onClick={() => setActiveTab('folio')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'folio'
              ? 'border-blue-600 text-blue-700 bg-white dark:bg-slate-800'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Calibrar Folio</span>
        </button>

        <button
          type="button"
          id="tab-doc-btn"
          onClick={() => setActiveTab('document')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'document'
              ? 'border-blue-600 text-blue-700 bg-white dark:bg-slate-800'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Páginas ({docInfo.totalPages})</span>
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: STAMP SVG & COMPOUND TRANSFORM */}
        {activeTab === 'stamp' && (
          <div className="space-y-4">
            {/* Import Custom SVG */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
                1. Importar o Cambiar Sello SVG
              </label>
              <label
                htmlFor="svg-upload-input"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 cursor-pointer transition-colors text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Importar archivo .SVG</span>
                <input
                  id="svg-upload-input"
                  type="file"
                  accept=".svg"
                  onChange={handleSvgFileUpload}
                  className="hidden"
                />
              </label>
              {svgUploadError && (
                <p className="text-xs text-rose-600 mt-1">{svgUploadError}</p>
              )}
            </div>

            {/* Official Preset Seal (Instituto de Cultura de Corrientes) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Sello Predefinido Disponible
                </label>
                {stampGroup.name !== PRESET_STAMPS[0].name && (
                  <button
                    type="button"
                    onClick={() => selectPresetStamp(PRESET_STAMPS[0])}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Restablecer oficial
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {PRESET_STAMPS.map((preset) => {
                  const isSelected = stampGroup.name === preset.name;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPresetStamp(preset)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/50'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60'
                      }`}
                    >
                      <div className="w-12 h-10 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-1 shrink-0 flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full">
                        <div dangerouslySetInnerHTML={{ __html: preset.svgContent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {preset.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded font-semibold">
                            Único Predefinido
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Placement on Document Page */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                Posición Rápida en la Página
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="place-top-right-btn"
                  onClick={() => applyQuickPagePlacement('top-right')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between shadow-2xs"
                >
                  <span>Esquina Sup. Der.</span>
                  <span className="text-[10px] text-blue-600 font-bold">Oficial</span>
                </button>
                <button
                  type="button"
                  id="place-bottom-right-btn"
                  onClick={() => applyQuickPagePlacement('bottom-right')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between shadow-2xs"
                >
                  <span>Esquina Inf. Der.</span>
                </button>
                <button
                  type="button"
                  id="place-top-left-btn"
                  onClick={() => applyQuickPagePlacement('top-left')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between shadow-2xs"
                >
                  <span>Esquina Sup. Izq.</span>
                </button>
                <button
                  type="button"
                  id="place-center-btn"
                  onClick={() => applyQuickPagePlacement('center')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 font-medium text-left flex items-center justify-between shadow-2xs"
                >
                  <span>Centrado en Página</span>
                </button>
              </div>
            </div>

            {/* Scale, Size & Rotation of the Compound Unit */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                Transformación del Conjunto (Sello + Folio)
              </label>

              {/* Proportional Scale */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Tamaño / Escala:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                    {formatPt(stampGroup.width)} × {formatPt(stampGroup.height)} pt
                  </span>
                </div>
                <input
                  type="range"
                  id="stamp-scale-slider"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={stampGroup.scale || 1.0}
                  onChange={(e) => {
                    const newScale = parseFloat(e.target.value);
                    const baseW = stampGroup.baseWidth || stampGroup.originalWidth;
                    const baseH = stampGroup.baseHeight || stampGroup.originalHeight;
                    const newW = Math.round(baseW * newScale * 10) / 10;
                    const newH = Math.round(baseH * newScale * 10) / 10;

                    const currPage = docInfo.pages[currentPageIndex] || { width: 595.28, height: 841.89 };
                    const tempGroup: StampGroup = {
                      ...stampGroup,
                      scale: newScale,
                      width: newW,
                      height: newH,
                    };
                    const coords = getPageStampCoordinates(tempGroup, currPage.width, currPage.height);

                    onStampGroupChange({
                      ...tempGroup,
                      x: coords.x,
                      y: coords.y,
                    });
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  <span>Mín {formatPt(stampGroup.baseWidth ? stampGroup.baseWidth * 0.5 : 25)} × {formatPt(stampGroup.baseHeight ? stampGroup.baseHeight * 0.5 : 33.5)} pt</span>
                  <span>Máx {formatPt(stampGroup.baseWidth ? stampGroup.baseWidth * 2.0 : 100)} × {formatPt(stampGroup.baseHeight ? stampGroup.baseHeight * 2.0 : 134)} pt</span>
                </div>
              </div>

              {/* Rotation of the whole compound unit */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Rotación del Conjunto:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                    {stampGroup.rotation}°
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => onStampGroupChange({ ...stampGroup, rotation: deg })}
                      className={`flex-1 py-1 text-xs rounded border font-mono transition-colors ${
                        stampGroup.rotation === deg
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 hover:dark:bg-slate-700'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  id="stamp-rotation-slider"
                  min={0}
                  max={360}
                  step={1}
                  value={stampGroup.rotation}
                  onChange={(e) =>
                    onStampGroupChange({
                      ...stampGroup,
                      rotation: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Opacity */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Opacidad del Conjunto:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                    {Math.round(stampGroup.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  id="stamp-opacity-slider"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={stampGroup.opacity}
                  onChange={(e) =>
                    onStampGroupChange({
                      ...stampGroup,
                      opacity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FOLIO CALIBRATION WITHIN THE STAMP */}
        {activeTab === 'folio' && (
          <FolioCalibrator
            folio={stampGroup.folio}
            svgRaw={stampGroup.svgRaw}
            totalPages={docInfo.totalPages}
            scale={stampGroup.scale || 1.0}
            onChange={(updatedFolio) => {
              onStampGroupChange({
                ...stampGroup,
                folio: updatedFolio,
              });
            }}
          />
        )}

        {/* TAB 3: DOCUMENT & PAGE APPLICATION RANGE */}
        {activeTab === 'document' && (
          <div className="space-y-4">
            {/* Upload Custom PDF */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
                Cargar o Cambiar Archivo PDF
              </label>
              <label
                htmlFor="pdf-upload-input"
                className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 cursor-pointer transition-colors text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Cargar otro documento PDF</span>
                <input
                  id="pdf-upload-input"
                  type="file"
                  accept="application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (onUploadPdf) {
                        onUploadPdf(file);
                      } else {
                        const { loadUserPdfDocument } = await import('../lib/pdfRenderer');
                        const doc = await loadUserPdfDocument(file);
                        onDocChange(doc);
                      }
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quick Sample Generators */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                Documentos de Muestra Administrativos
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="sample-5-pages-btn"
                  onClick={() => onGenerateSample(5)}
                  className="p-2.5 text-xs text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 transition-colors shadow-2xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Expediente Corto</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">5 páginas de muestra</div>
                </button>
                <button
                  type="button"
                  id="sample-66-pages-btn"
                  onClick={() => onGenerateSample(66)}
                  className="p-2.5 text-xs text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 hover:dark:bg-slate-800/60 transition-colors shadow-2xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <span>Expediente Extenso</span>
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1 rounded font-bold">
                      Req 11
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">66 páginas completas</div>
                </button>
              </div>
            </div>

            {/* Target Page Range Selection (Requirement 11) */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                Rango de Aplicación de Folios
              </label>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value="all"
                    checked={rangeType === 'all'}
                    onChange={() => onRangeTypeChange('all')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Todas las páginas (1 a {docInfo.totalPages})
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value="custom"
                    checked={rangeType === 'custom'}
                    onChange={() => onRangeTypeChange('custom')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Rango personalizado</span>
                </label>

                {rangeType === 'custom' && (
                  <div className="pl-6 pt-1">
                    <input
                      type="text"
                      id="custom-range-input"
                      value={customRangeStr}
                      onChange={(e) => onCustomRangeStrChange(e.target.value)}
                      placeholder="Ej: 1-10, 15, 20-66"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Separa con comas o guiones (ej. 1-10, 15, 20-30).
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value="odd"
                    checked={rangeType === 'odd'}
                    onChange={() => onRangeTypeChange('odd')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Solo páginas impares (1, 3, 5, ...)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value="even"
                    checked={rangeType === 'even'}
                    onChange={() => onRangeTypeChange('even')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Solo páginas pares (2, 4, 6, ...)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="pageRange"
                    value="current"
                    checked={rangeType === 'current'}
                    onChange={() => onRangeTypeChange('current')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Solo página actual ({currentPageIndex + 1})</span>
                </label>
              </div>
            </div>

            {/* Document stats */}
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
              <div>Archivo: {docInfo.fileName}</div>
              <div>Páginas: {docInfo.totalPages}</div>
              <div>
                Tamaño: {(docInfo.fileSize / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Export Action Area (Requirements 12, 13, 16, 17) */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
        {/* Vector Integrity Badge */}
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-md">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Texto vectorial nativo + Sello Form XObject reutilizado</span>
        </div>

        {/* Progress bar when exporting */}
        {isExporting && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <span>{exportStatusText}</span>
              <span>{exportPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${exportPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Primary Export Button */}
        <button
          type="button"
          id="export-pdf-btn"
          disabled={isExporting}
          onClick={onExportPdf}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          <span>{isExporting ? 'Foliando Documento...' : 'Exportar PDF Foliado'}</span>
        </button>
      </div>
    </aside>
  );
};
