/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StampGroup, PageInfo } from '../types';
import { renderPdfPageToCanvas, cancelActiveCanvasRender } from '../lib/pdfRenderer';
import { formatFolioText, getPageStampCoordinates } from '../lib/pdfExporter';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Move,
  CheckCircle2,
  Upload,
  FileText,
  FolderOpen,
} from 'lucide-react';

interface StampCanvasProps {
  pdfBytes: Uint8Array;
  currentPageIndex: number;
  pages: PageInfo[];
  stampGroup: StampGroup;
  onPageChange: (newPageIndex: number) => void;
  onStampGroupChange: (updated: StampGroup) => void;
  docFileName?: string;
  onUploadPdf?: (file: File) => void;
  isLoadingUpload?: boolean;
}

export const StampCanvas: React.FC<StampCanvasProps> = ({
  pdfBytes,
  currentPageIndex,
  pages,
  stampGroup,
  onPageChange,
  onStampGroupChange,
  docFileName,
  onUploadPdf,
  isLoadingUpload,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.1);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Interaction dragging states
  const [isDraggingGroup, setIsDraggingGroup] = useState<boolean>(false);
  const [isResizingGroup, setIsResizingGroup] = useState<boolean>(false);
  const [isRotatingGroup, setIsRotatingGroup] = useState<boolean>(false);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialStampX: number;
    initialStampY: number;
    initialWidth: number;
    initialHeight: number;
    initialScale: number;
    initialRotation: number;
    centerX: number;
    centerY: number;
    initialRelX: number;
    initialRelY: number;
    initialFontSize: number;
  }>({
    startX: 0,
    startY: 0,
    initialStampX: 0,
    initialStampY: 0,
    initialWidth: 0,
    initialHeight: 0,
    initialScale: 1,
    initialRotation: 0,
    centerX: 0,
    centerY: 0,
    initialRelX: 0.5,
    initialRelY: 0.5,
    initialFontSize: 18,
  });

  const currentPage = pages[currentPageIndex] || {
    pageNumber: 1,
    width: 595.28,
    height: 841.89,
  };

  // Render PDF page to canvas
  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !pdfBytes) return;

    setIsRendering(true);
    renderPdfPageToCanvas(pdfBytes, currentPageIndex + 1, canvas, zoomScale)
      .then(() => {
        if (!isCancelled) setIsRendering(false);
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
        if (!isCancelled) setIsRendering(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, currentPageIndex, zoomScale]);

  // Compute live folio text for the currently active page (Requirement 11)
  const currentFolioValue = stampGroup.folio.startNumber + currentPageIndex;
  const currentFolioText = formatFolioText(
    stampGroup.folio.format,
    currentFolioValue,
    stampGroup.folio.padDigits,
    pages.length
  );

  // Scaled dimensions and positions for DOM canvas overlay
  const pageDomWidth = currentPage.width * zoomScale;
  const pageDomHeight = currentPage.height * zoomScale;

  // Real physical page stamp coordinates (calculated dynamically for the current page)
  const { x: activeStampX, y: activeStampY } = getPageStampCoordinates(
    stampGroup,
    currentPage.width,
    currentPage.height
  );

  const stampDomX = activeStampX * zoomScale;
  const stampDomY = activeStampY * zoomScale;
  const stampDomW = stampGroup.width * zoomScale;
  const stampDomH = stampGroup.height * zoomScale;

  // Scaled font size for DOM preview (scaled with stamp scale factor and zoom)
  const scaledDomFontSize =
    stampGroup.folio.relativePosition.fontSize * (stampGroup.scale || 1.0) * zoomScale;

  // -------------------------------------------------------------
  // Mouse Drag Handlers: StampGroup and Folio Calibration
  // -------------------------------------------------------------

  const handlePointerDownMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialStampX: activeStampX,
      initialStampY: activeStampY,
      initialWidth: stampGroup.width,
      initialHeight: stampGroup.height,
      initialScale: stampGroup.scale || 1.0,
      initialRotation: stampGroup.rotation,
      centerX: activeStampX + stampGroup.width / 2,
      centerY: activeStampY + stampGroup.height / 2,
      initialRelX: stampGroup.folio.relativePosition.x,
      initialRelY: stampGroup.folio.relativePosition.y,
      initialFontSize: stampGroup.folio.relativePosition.fontSize,
    };
    setIsDraggingGroup(true);
  };

  const handlePointerDownFolio = (e: React.PointerEvent) => {
    // Folio and stamp are a unified composite unit; dragging folio moves the whole group
    handlePointerDownMove(e);
  };

  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    dragStartRef.current = {
      ...dragStartRef.current,
      startX: e.clientX,
      startY: e.clientY,
      initialStampX: activeStampX,
      initialStampY: activeStampY,
      initialWidth: stampGroup.width,
      initialHeight: stampGroup.height,
      initialScale: stampGroup.scale || 1.0,
      initialRotation: stampGroup.rotation,
      centerX: activeStampX + stampGroup.width / 2,
      centerY: activeStampY + stampGroup.height / 2,
    };
    setIsResizingGroup(true);
  };

  const handlePointerDownRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = containerRef.current?.getBoundingClientRect();
    const containerLeft = rect ? rect.left : 0;
    const containerTop = rect ? rect.top : 0;

    const groupCenterScreenX = containerLeft + (activeStampX + stampGroup.width / 2) * zoomScale;
    const groupCenterScreenY = containerTop + (activeStampY + stampGroup.height / 2) * zoomScale;

    dragStartRef.current = {
      ...dragStartRef.current,
      startX: e.clientX,
      startY: e.clientY,
      initialStampX: activeStampX,
      initialStampY: activeStampY,
      initialWidth: stampGroup.width,
      initialHeight: stampGroup.height,
      initialScale: stampGroup.scale || 1.0,
      initialRotation: stampGroup.rotation,
      centerX: groupCenterScreenX,
      centerY: groupCenterScreenY,
    };
    setIsRotatingGroup(true);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDraggingGroup) {
        const deltaX = (e.clientX - dragStartRef.current.startX) / zoomScale;
        const deltaY = (e.clientY - dragStartRef.current.startY) / zoomScale;

        let nextX = dragStartRef.current.initialStampX + deltaX;
        let nextY = dragStartRef.current.initialStampY + deltaY;

        // Keep reasonably within or near page bounds
        nextX = Math.max(-50, Math.min(currentPage.width - 20, nextX));
        nextY = Math.max(-50, Math.min(currentPage.height - 20, nextY));

        // Magnetic snap to physical page borders (3 pt margin from visible edges)
        const snapTol = 5;
        const margin3pt = 3;
        const visibleInsetX = stampGroup.width * (12 / 896);
        const visibleInsetY = stampGroup.height * (12 / 1193);
        const rightEdgeX = currentPage.width - stampGroup.width - margin3pt + visibleInsetX;
        const topEdgeY = margin3pt - visibleInsetY;
        const leftEdgeX = margin3pt - visibleInsetX;
        const bottomEdgeY = currentPage.height - stampGroup.height - margin3pt + visibleInsetY;

        let snappedToRight = false;
        let snappedToTop = false;
        let snappedToLeft = false;
        let snappedToBottom = false;

        if (Math.abs(nextX - leftEdgeX) < snapTol) {
          nextX = leftEdgeX;
          snappedToLeft = true;
        } else if (Math.abs(nextX - rightEdgeX) < snapTol) {
          nextX = rightEdgeX;
          snappedToRight = true;
        }

        if (Math.abs(nextY - topEdgeY) < snapTol) {
          nextY = topEdgeY;
          snappedToTop = true;
        } else if (Math.abs(nextY - bottomEdgeY) < snapTol) {
          nextY = bottomEdgeY;
          snappedToBottom = true;
        }

        const isRight = (nextX + stampGroup.width / 2) >= (currentPage.width / 2);
        const isTop = (nextY + stampGroup.height / 2) <= (currentPage.height / 2);

        // Distance from visible stamp border to physical page edges
        const marginRight = Math.round((currentPage.width - (nextX + stampGroup.width - visibleInsetX)) * 100) / 100;
        const marginLeft = Math.round((nextX + visibleInsetX) * 100) / 100;
        const marginTop = Math.round((nextY + visibleInsetY) * 100) / 100;
        const marginBottom = Math.round((currentPage.height - (nextY + stampGroup.height - visibleInsetY)) * 100) / 100;

        let placementPreset: StampGroup['placementPreset'] = 'custom';
        if (snappedToRight && snappedToTop) placementPreset = 'top-right';
        else if (snappedToLeft && snappedToTop) placementPreset = 'top-left';
        else if (snappedToRight && snappedToBottom) placementPreset = 'bottom-right';

        onStampGroupChange({
          ...stampGroup,
          placementPreset,
          anchorHorizontal: isRight ? 'right' : 'left',
          anchorVertical: isTop ? 'top' : 'bottom',
          marginRight,
          marginLeft,
          marginTop,
          marginBottom,
          x: Math.round(nextX * 100) / 100,
          y: Math.round(nextY * 100) / 100,
        });
      } else if (isResizingGroup) {
        // Diagonal scale factor relative to the compound's base (medium) size,
        // clamped to the same 0.5x–2.0x range as the sidebar slider
        // (50×67 pt medio -> mínimo 25×33.5 pt, máximo 100×134 pt).
        const deltaX = (e.clientX - dragStartRef.current.startX) / zoomScale;
        const initialWidth = dragStartRef.current.initialWidth || 1;
        const baseW = stampGroup.baseWidth || initialWidth;
        const baseH = stampGroup.baseHeight || dragStartRef.current.initialHeight;

        const draggedWidth = Math.max(50, Math.min(currentPage.width * 0.9, initialWidth + deltaX));
        const scaleRatio = draggedWidth / initialWidth;
        const newScale = Math.max(0.5, Math.min(2.0, (dragStartRef.current.initialScale || 1.0) * scaleRatio));

        const newW = Math.round(baseW * newScale * 10) / 10;
        const newH = Math.round(baseH * newScale * 10) / 10;

        const tempGroup: StampGroup = {
          ...stampGroup,
          width: newW,
          height: newH,
          scale: Math.round(newScale * 100) / 100,
        };
        const coords = getPageStampCoordinates(tempGroup, currentPage.width, currentPage.height);

        onStampGroupChange({
          ...tempGroup,
          x: coords.x,
          y: coords.y,
        });
      } else if (isRotatingGroup) {
        const dx = e.clientX - dragStartRef.current.centerX;
        const dy = e.clientY - dragStartRef.current.centerY;

        let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angleDeg < 0) angleDeg += 360;

        // Snap to 0, 90, 180, 270 if close
        const snapTol = 5;
        if (Math.abs(angleDeg - 0) < snapTol || Math.abs(angleDeg - 360) < snapTol) angleDeg = 0;
        else if (Math.abs(angleDeg - 90) < snapTol) angleDeg = 90;
        else if (Math.abs(angleDeg - 180) < snapTol) angleDeg = 180;
        else if (Math.abs(angleDeg - 270) < snapTol) angleDeg = 270;

        onStampGroupChange({
          ...stampGroup,
          rotation: Math.round(angleDeg),
        });
      }
    },
    [
      isDraggingGroup,
      isResizingGroup,
      isRotatingGroup,
      zoomScale,
      currentPage.width,
      currentPage.height,
      stampGroup,
      onStampGroupChange,
    ]
  );

  const handlePointerUp = useCallback(() => {
    setIsDraggingGroup(false);
    setIsResizingGroup(false);
    setIsRotatingGroup(false);
  }, []);

  return (
    <div
      id="stamp-canvas-viewport"
      className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-700 overflow-hidden select-none relative"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top Toolbar: Navigation, Document info & Upload, Zoom & Status */}
      <div className="min-h-12 py-1.5 px-3 md:px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-2xs z-20">
        {/* Left: Page navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            id="prev-page-btn"
            disabled={currentPageIndex <= 0}
            onClick={() => onPageChange(currentPageIndex - 1)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:dark:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Página anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 font-medium px-1 sm:px-2">
            <span className="hidden sm:inline">Pág.</span>
            <input
              type="number"
              min={1}
              max={pages.length}
              value={currentPageIndex + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= pages.length) {
                  onPageChange(val - 1);
                }
              }}
              className="w-11 sm:w-12 text-center py-0.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded font-semibold text-slate-900 dark:text-slate-100 text-xs"
            />
            <span className="text-slate-500 dark:text-slate-400">/ {pages.length}</span>
          </div>

          <button
            type="button"
            id="next-page-btn"
            disabled={currentPageIndex >= pages.length - 1}
            onClick={() => onPageChange(currentPageIndex + 1)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:dark:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Página siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Document Badge & Load Another PDF Button */}
        <div className="flex items-center gap-2 max-w-full">
          {docFileName && (
            <div
              className="hidden lg:flex items-center gap-1.5 max-w-[200px] xl:max-w-[280px] bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs"
              title={`Documento actual: ${docFileName} (${pages.length} páginas)`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                {docFileName}
              </span>
            </div>
          )}

          {onUploadPdf && (
            <label
              htmlFor="topbar-load-another-pdf-input"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
              title="Cargar otro documento PDF para trabajar sin salir"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cargar otro documento</span>
              <span className="sm:hidden">Otro PDF</span>
              <input
                id="topbar-load-another-pdf-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadPdf(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          )}

          {/* Current Folio Indicator on active page */}
          <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg text-xs text-blue-900 dark:text-blue-300 font-medium shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="hidden md:inline">Folio:</span>
            <span className="font-mono font-bold text-blue-950 dark:text-blue-200 bg-white dark:bg-slate-800 px-1 py-0.5 rounded shadow-2xs border border-blue-100 dark:border-blue-900/50">
              {currentFolioText}
            </span>
          </div>
        </div>

        {/* Right: Zoom & Viewport controls */}
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 shrink-0">
          <button
            type="button"
            id="zoom-out-btn"
            onClick={() => setZoomScale((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono w-10 text-center font-medium text-slate-700 dark:text-slate-300">
            {Math.round(zoomScale * 100)}%
          </span>

          <button
            type="button"
            id="zoom-in-btn"
            onClick={() => setZoomScale((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors cursor-pointer"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="zoom-fit-btn"
            onClick={() => setZoomScale(1.0)}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors text-xs font-medium cursor-pointer"
            title="Tamaño 100%"
          >
            100%
          </button>
        </div>
      </div>

      {/* Main Document Workspace Area */}
      <div className="flex-1 overflow-auto p-6 sm:p-10 flex items-start justify-center relative">
        {/* Loading Overlay when a document is being parsed */}
        {isLoadingUpload && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-200 dark:border-slate-700">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Cargando nuevo documento...
              </span>
            </div>
          </div>
        )}
        {/* Document Page Canvas Container */}
        <div
          ref={containerRef}
          id="pdf-page-container"
          className="relative bg-white dark:bg-slate-800 shadow-2xl rounded-xs transition-shadow border border-slate-300 dark:border-slate-600"
          style={{
            width: `${pageDomWidth}px`,
            height: `${pageDomHeight}px`,
          }}
        >
          {/* Real PDF Page Render */}
          <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

          {/* ========================================================= */}
          {/* THE STAMP GROUP: SVG + FOLIO COMPOUND UNIT                */}
          {/* Unlocked: allows independent folio positioning & sizing   */}
          {/* Locked: moves, scales, and rotates as a single unit       */}
          {/* ========================================================= */}
          <div
            id="stamp-group-unit"
            onPointerDown={handlePointerDownMove}
            style={{
              position: 'absolute',
              left: `${stampDomX}px`,
              top: `${stampDomY}px`,
              width: `${stampDomW}px`,
              height: `${stampDomH}px`,
              transform: `rotate(${stampGroup.rotation}deg)`,
              transformOrigin: 'center center',
              opacity: stampGroup.opacity,
              cursor: isDraggingGroup ? 'grabbing' : 'grab',
            }}
            className={`group select-none touch-none transition-shadow ${
              isDraggingGroup || isResizingGroup || isRotatingGroup
                ? 'ring-2 ring-blue-500 shadow-xl'
                : 'hover:ring-1 hover:ring-blue-400'
            }`}
            title="Sello y Folio indivisible — Arrastra para mover el conjunto"
          >
            {/* 1. SVG Graphic Content */}
            <div
              className="w-full h-full pointer-events-none select-none drop-shadow-xs [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: stampGroup.svgRaw }}
            />

            {/* 2. Folio Text: Relative to SVG coordinate box */}
            <div
              id="folio-bound-text"
              onPointerDown={handlePointerDownFolio}
              style={{
                position: 'absolute',
                left: `${stampGroup.folio.relativePosition.x * 100}%`,
                top: `${stampGroup.folio.relativePosition.y * 100}%`,
                transform: `translate(${
                  stampGroup.folio.relativePosition.textAlign === 'center'
                    ? '-50%'
                    : stampGroup.folio.relativePosition.textAlign === 'right'
                    ? '-100%'
                    : '0%'
                }, -50%)`,
                fontSize: `${scaledDomFontSize}px`,
                color: stampGroup.folio.relativePosition.color,
                fontFamily: stampGroup.folio.relativePosition.fontFamily.includes('Times')
                  ? "'Times New Roman', serif"
                  : stampGroup.folio.relativePosition.fontFamily.includes('Courier')
                  ? "'Courier New', monospace"
                  : "'Helvetica Neue', Arial, sans-serif",
                fontWeight: stampGroup.folio.relativePosition.fontFamily.includes('Bold')
                  ? 'bold'
                  : 'normal',
                lineHeight: 1.1,
                cursor: 'grab',
              }}
              className="select-none whitespace-nowrap tracking-tight drop-shadow-2xs touch-none pointer-events-auto"
            >
              {currentFolioText}
            </div>

            {/* Compound Selection Bounding Box UI */}
            <div className="absolute -inset-0.5 rounded-xs pointer-events-none border border-blue-500/60 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Top Rotation Handle */}
            <div
              id="stamp-group-rotate-handle"
              onPointerDown={handlePointerDownRotate}
              className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white dark:bg-slate-800 border-2 border-blue-600 rounded-full shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center hover:scale-115 transition-transform z-30"
              title="Rotar conjunto (Sello y Folio juntos)"
            >
              <RotateCw className="w-3 h-3 text-blue-600" />
            </div>
            {/* Connecting stem for rotation handle */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-blue-500 pointer-events-none" />

            {/* Bottom-Right Proportional Resize Handle */}
            <div
              id="stamp-group-resize-handle"
              onPointerDown={handlePointerDownResize}
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white dark:bg-slate-800 border-2 border-blue-600 rounded-xs shadow-md cursor-se-resize hover:scale-125 transition-transform z-30"
              title="Redimensionar conjunto proporcionalmente"
            />
          </div>

          {/* Loading overlay during page changes */}
          {isRendering && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center pointer-events-none transition-opacity">
              <div className="bg-slate-900/85 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg font-medium flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cargando página...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
