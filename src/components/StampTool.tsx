/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DocumentInfo,
  PageRangeType,
  StampGroup,
} from '../types';
import { PRESET_STAMPS, parseAndCleanSvg } from '../lib/svgStamps';
import { generateSampleDocument, loadUserPdfDocument } from '../lib/pdfRenderer';
import { stampAndExportPdf, getPagesToStamp, getPageStampCoordinates } from '../lib/pdfExporter';
import { SidebarControls } from './SidebarControls';
import { StampCanvas } from './StampCanvas';
import { ExportModal } from './ExportModal';
import { useTheme } from '../lib/useTheme';
import { Upload, FileText, Stamp, ArrowLeft } from 'lucide-react';
import { GlobalPdfDropOverlay } from './GlobalPdfDropOverlay';

interface StampToolProps {
  onBack: () => void;
  initialFile?: File | null;
}

export default function StampTool({ onBack, initialFile }: StampToolProps) {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // The primary StampGroup (Indivisible composite unit)
  const defaultPreset = PRESET_STAMPS[0]; // Instituto de Cultura de Corrientes
  const [stampGroup, setStampGroup] = useState<StampGroup>(() => {
    const parsed = parseAndCleanSvg(defaultPreset.svgContent);
    const initialWidth = defaultPreset.defaultWidth;
    const initialHeight = defaultPreset.defaultHeight;

    const initGroup: StampGroup = {
      id: 'stamp-group-unit-1',
      name: defaultPreset.name,
      svgRaw: parsed.cleanSvg,
      originalWidth: parsed.width,
      originalHeight: parsed.height,
      aspectRatio: parsed.width / parsed.height,
      baseWidth: initialWidth,
      baseHeight: initialHeight,
      // Posición predeterminada: esquina superior derecha, a exactamente 3 pt del borde visible
      placementPreset: 'top-right',
      anchorHorizontal: 'right',
      anchorVertical: 'top',
      marginRight: 3,
      marginTop: 3,
      x: 0,
      y: 0,
      width: initialWidth,
      height: initialHeight,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      isCompositionLocked: true, // Default locked as single unified stamp object
      folio: {
        startNumber: 1, // Start at folio 1
        format: '{n}', // Only number {n} since circular SVG already has "FOLIO N°"
        padDigits: 0,
        relativePosition: {
          x: 0.50, // 50%
          y: 0.51, // 51%
          fontSize: defaultPreset.recommendedFolioRelativePosition.fontSize, // 13.5 pt al tamaño medio del sello
          textAlign: defaultPreset.recommendedFolioRelativePosition.textAlign,
          color: '#000000', // Black color
          fontFamily: 'Helvetica-Bold',
        },
      },
    };
    const initCoords = getPageStampCoordinates(initGroup, 595.28, 841.89);
    initGroup.x = initCoords.x;
    initGroup.y = initCoords.y;
    return initGroup;
  });

  // Stamping range configuration (Requirement 11)
  const [rangeType, setRangeType] = useState<PageRangeType>('all');
  const [customRangeStr, setCustomRangeStr] = useState<string>('1-10');

  // Export state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportPercent, setExportPercent] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [exportedPdfBytes, setExportedPdfBytes] = useState<Uint8Array | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isLoadingUpload, setIsLoadingUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFile) {
      handleUploadPdf(initialFile);
    }
  }, [initialFile]);

  const handleUploadPdf = async (
    file: File,
    options?: { newStartNumber?: number }
  ) => {
    try {
      setUploadError(null);
      setIsLoadingUpload(true);
      const doc = await loadUserPdfDocument(file);
      setDocInfo(doc);
      setCurrentPageIndex(0);

      // Si se especifica un número inicial nuevo (ej: al continuar foliación desde ExportModal)
      if (options?.newStartNumber !== undefined) {
        setStampGroup((prev) => ({
          ...prev,
          folio: {
            ...prev.folio,
            startNumber: options.newStartNumber!,
          },
        }));
      }

      // Actualizar rango predeterminado de páginas
      setCustomRangeStr(`1-${doc.totalPages}`);

      // Mantener la posición y configuración del sello adaptada al tamaño de página del nuevo documento
      const firstPage = doc.pages[0];
      if (firstPage) {
        setStampGroup((prev) => {
          const coords = getPageStampCoordinates(
            prev,
            firstPage.width,
            firstPage.height
          );
          return {
            ...prev,
            x: coords.x,
            y: coords.y,
          };
        });
      }
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo leer el archivo PDF.');
      alert('Error al leer el archivo PDF: ' + (err.message || 'El archivo puede estar dañado o no es un PDF válido.'));
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const handleGenerateSample = async (pages: number) => {
    const doc = await generateSampleDocument(pages);
    setDocInfo(doc);
    setCurrentPageIndex(0);
    // Posición predeterminada: esquina superior derecha, exactamente a 3 pt del borde visible
    const firstPage = doc.pages[0];
    if (firstPage) {
      setStampGroup((prev) => {
        const coords = getPageStampCoordinates(
          { ...prev, placementPreset: 'top-right' },
          firstPage.width,
          firstPage.height
        );
        return {
          ...prev,
          placementPreset: 'top-right',
          x: coords.x,
          y: coords.y,
        };
      });
    }
    if (pages === 66) {
      setCustomRangeStr('1-66');
    }
  };

  const handleExportPdf = async () => {
    if (!docInfo || isExporting) return;

    try {
      setIsExporting(true);
      setExportPercent(5);
      setExportStatusText('Iniciando proceso de foliación...');

      const resultBytes = await stampAndExportPdf(
        docInfo.pdfBytes,
        stampGroup,
        rangeType,
        customRangeStr,
        currentPageIndex,
        (prog) => {
          setExportPercent(prog.percent);
          setExportStatusText(prog.status);
        }
      );

      setExportedPdfBytes(resultBytes);
      setIsExportModalOpen(true);
    } catch (err: any) {
      console.error('Error al exportar PDF:', err);
      alert('Ocurrió un error al generar el PDF: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!docInfo) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 relative">
        <GlobalPdfDropOverlay
          onFileDrop={handleUploadPdf}
          title="Soltá tu archivo PDF en cualquier parte"
          description="Se abrirá directamente en el visor de sellos para comenzar a trabajar."
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
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Stamp className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Sello y Foliador Vectorial
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargá tu propio documento PDF para empezar a estampar el sello y foliar sus páginas.
          </p>

          {isLoadingUpload ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cargando documento...</p>
            </div>
          ) : (
            <label
              htmlFor="initial-pdf-upload-input"
              className="block w-full py-10 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
            >
              <Upload className="w-7 h-7 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Hacé clic o arrastrá tu PDF acá
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Formato .pdf</p>
              <input
                id="initial-pdf-upload-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPdf(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          )}

          {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}

          <button
            type="button"
            onClick={() => handleGenerateSample(5)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>O probá primero con un documento de muestra</span>
          </button>
        </div>
      </div>
    );
  }

  // Calculate stamped folios summary for modal
  const targetPages = getPagesToStamp(rangeType, customRangeStr, docInfo.totalPages, currentPageIndex + 1);
  const startFolioNumber = stampGroup.folio.startNumber;
  const endFolioNumber = stampGroup.folio.startNumber + targetPages.length - 1;

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
      {/* Full screen Drag & Drop PDF Dropzone Overlay */}
      <GlobalPdfDropOverlay
        onFileDrop={handleUploadPdf}
        title="Soltá tu archivo PDF en cualquier parte"
        description="Se cargará de inmediato en el visor manteniendo la escala y posición de tu sello."
      />

      {/* Control Sidebar: Stamp import, Folio calibration, Page range, Export */}
      <SidebarControls
        docInfo={docInfo}
        currentPageIndex={currentPageIndex}
        stampGroup={stampGroup}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onBack={onBack}
        rangeType={rangeType}
        customRangeStr={customRangeStr}
        isExporting={isExporting}
        exportPercent={exportPercent}
        exportStatusText={exportStatusText}
        onDocChange={(newDoc) => {
          setDocInfo(newDoc);
          setCurrentPageIndex(0);
        }}
        onStampGroupChange={setStampGroup}
        onRangeTypeChange={setRangeType}
        onCustomRangeStrChange={setCustomRangeStr}
        onGenerateSample={handleGenerateSample}
        onExportPdf={handleExportPdf}
        onUploadPdf={handleUploadPdf}
      />

      {/* Main Interactive Stage: Canvas with single-unit StampGroup */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <StampCanvas
          pdfBytes={docInfo.pdfBytes}
          currentPageIndex={currentPageIndex}
          pages={docInfo.pages}
          stampGroup={stampGroup}
          onPageChange={setCurrentPageIndex}
          onStampGroupChange={setStampGroup}
          docFileName={docInfo.fileName}
          onUploadPdf={handleUploadPdf}
          isLoadingUpload={isLoadingUpload}
        />
      </main>

      {/* Export Success Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        exportedPdfBytes={exportedPdfBytes}
        fileName={docInfo.fileName}
        totalPagesStamped={targetPages.length}
        startFolio={startFolioNumber}
        endFolio={endFolioNumber}
        onClose={() => setIsExportModalOpen(false)}
        onUploadNextPdf={(file, continueFolio) => {
          setIsExportModalOpen(false);
          const nextStart = continueFolio ? endFolioNumber + 1 : undefined;
          handleUploadPdf(file, { newStartNumber: nextStart });
        }}
      />
    </div>
  );
}
