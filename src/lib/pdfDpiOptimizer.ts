/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de análisis de DPI y reducción inteligente de resolución para PDFs escaneados.
 * Detecta qué documentos superan los 200 DPI (ej. escaneos accidentales a 1200 DPI)
 * y los remuestrea a 200 DPI de forma óptima sin alterar los que ya están en 200 DPI
 * o son vectoriales, preservando nombres exactos y dimensiones físicas.
 */

import { PDFDocument, PDFName, PDFDict, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - bundled worker file does not supply separate .d.ts
import * as pdfWorkerModule from 'pdfjs-dist/build/pdf.worker.min.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Inicialización segura del worker de PDF.js
if (typeof globalThis !== 'undefined') {
  (globalThis as any).pdfjsWorker = pdfWorkerModule;
}
if (typeof window !== 'undefined') {
  (window as any).pdfjsWorker = pdfWorkerModule;
}
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorkerUrl || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch (_) {}

function getPdfJsDocOptions(pdfBytes: Uint8Array): any {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const wasmUrl = origin ? `${origin}/wasm/` : `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`;

  return {
    data: pdfBytes.slice(),
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    wasmUrl,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    useWorkerFetch: true,
  };
}

export interface PageDpiInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  dpi: number;
  hasHighResImage: boolean;
}

export interface DpiAnalysisResult {
  id: string;
  file: File;
  fileName: string;
  originalSize: number;
  totalPages: number;
  maxDetectedDpi: number;
  avgDetectedDpi: number;
  needsDownsample: boolean;
  isAnalyzing: boolean;
  pagesInfo: PageDpiInfo[];
}

export interface OptimizationResultItem {
  id: string;
  fileName: string;
  originalSize: number;
  finalSize: number;
  bytes: Uint8Array;
  wasDownsampled: boolean;
  detectedDpi: number;
  status: 'optimized' | 'kept_original' | 'error';
  errorMessage?: string;
}

/**
 * Inspecciona un PDF para detectar la resolución real (DPI) de sus imágenes incrustadas.
 * Un PDF estándar de oficina define hojas en puntos (72 puntos = 1 pulgada).
 * Por ejemplo, hoja A4 = 595 x 842 puntos (~8.27 x 11.69 pulgadas).
 * Si la imagen escaneada tiene 9920 px de ancho, 9920 / 8.27 ≈ 1200 DPI.
 * Si tiene 1654 px de ancho, 1654 / 8.27 ≈ 200 DPI.
 */
export async function analyzeFileDpi(
  file: File,
  targetDpiThreshold = 225
): Promise<DpiAnalysisResult> {
  const analysisPromise = (async (): Promise<DpiAnalysisResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    const pagesInfo: PageDpiInfo[] = [];
    let maxDpiFound = 0;
    let totalDpiSum = 0;

    // Para PDFs con muchísimas páginas (ej: 50+ o 100+ fojas), inspeccionamos las primeras 10
    // y una muestra representativa para que el análisis sea instantáneo (menos de 1 segundo)
    const pagesToInspect: number[] = [];
    if (totalPages <= 15) {
      for (let i = 0; i < totalPages; i++) pagesToInspect.push(i);
    } else {
      // Primeras 6 páginas
      for (let i = 0; i < 6; i++) pagesToInspect.push(i);
      // Muestras intermedias y final
      const step = Math.max(1, Math.floor(totalPages / 8));
      for (let i = 6; i < totalPages; i += step) {
        if (!pagesToInspect.includes(i)) pagesToInspect.push(i);
      }
      if (!pagesToInspect.includes(totalPages - 1)) pagesToInspect.push(totalPages - 1);
    }

    for (const i of pagesToInspect) {
      const page = pdfDoc.getPage(i);
      const { width: pWidth, height: pHeight } = page.getSize();
      const widthInches = Math.max(0.1, pWidth / 72);
      const heightInches = Math.max(0.1, pHeight / 72);

      let pageMaxDpi = 0;

      try {
        const resourcesRef = page.node.get(PDFName.of('Resources'));
        if (resourcesRef) {
          const resources = pdfDoc.context.lookup(resourcesRef) as PDFDict;
          if (resources && resources instanceof PDFDict) {
            const xObjectRef = resources.get(PDFName.of('XObject'));
            if (xObjectRef) {
              const xObjectDict = pdfDoc.context.lookup(xObjectRef) as PDFDict;
              if (xObjectDict && xObjectDict instanceof PDFDict) {
                for (const key of xObjectDict.keys()) {
                  const rawVal = xObjectDict.get(key);
                  const obj = pdfDoc.context.lookup(rawVal) as any;
                  if (obj?.dict?.get(PDFName.of('Subtype'))?.toString() === '/Image') {
                    const rawW = obj.dict.get(PDFName.of('Width'));
                    const rawH = obj.dict.get(PDFName.of('Height'));
                    const widthObj = pdfDoc.context.lookup(rawW) as any;
                    const heightObj = pdfDoc.context.lookup(rawH) as any;

                    const imgW = widthObj?.asNumber?.() ?? Number(widthObj?.value) ?? 0;
                    const imgH = heightObj?.asNumber?.() ?? Number(heightObj?.value) ?? 0;

                    if (imgW > 0 && imgH > 0) {
                      const dpiW = Math.round(imgW / widthInches);
                      const dpiH = Math.round(imgH / heightInches);
                      const dpi = Math.max(dpiW, dpiH);
                      if (dpi > pageMaxDpi) {
                        pageMaxDpi = dpi;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (_) {}

      // Si no encontramos imágenes explícitas en XObjects pero el archivo es pesado,
      // estimamos por el peso en bytes por página
      if (pageMaxDpi === 0) {
        const bytesPerPage = file.size / Math.max(1, totalPages);
        if (bytesPerPage > 3.5 * 1024 * 1024) {
          pageMaxDpi = 1200;
        } else if (bytesPerPage > 1.5 * 1024 * 1024) {
          pageMaxDpi = 600;
        } else if (bytesPerPage > 600 * 1024) {
          pageMaxDpi = 300;
        } else {
          pageMaxDpi = 150;
        }
      }

      if (pageMaxDpi > maxDpiFound) {
        maxDpiFound = pageMaxDpi;
      }
      totalDpiSum += pageMaxDpi;

      pagesInfo.push({
        pageNumber: i + 1,
        widthPt: pWidth,
        heightPt: pHeight,
        dpi: pageMaxDpi,
        hasHighResImage: pageMaxDpi > targetDpiThreshold,
      });
    }

    const inspectedCount = Math.max(1, pagesInfo.length);
    const avgDetectedDpi = Math.round(totalDpiSum / inspectedCount);
    const needsDownsample = maxDpiFound > targetDpiThreshold;

    return {
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      fileName: file.name,
      originalSize: file.size,
      totalPages,
      maxDetectedDpi: maxDpiFound,
      avgDetectedDpi,
      needsDownsample,
      isAnalyzing: false,
      pagesInfo,
    };
  })();

  // Timeout guard de 8 segundos: si el PDF es colosal o complejo, nunca dejar la app colgada
  const timeoutPromise = new Promise<DpiAnalysisResult>((resolve) => {
    setTimeout(() => {
      const estimatedDpi = file.size > 2 * 1024 * 1024 ? 1200 : 200;
      resolve({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        originalSize: file.size,
        totalPages: 1,
        maxDetectedDpi: estimatedDpi,
        avgDetectedDpi: estimatedDpi,
        needsDownsample: estimatedDpi > targetDpiThreshold,
        isAnalyzing: false,
        pagesInfo: [],
      });
    }, 8000);
  });

  return Promise.race([analysisPromise, timeoutPromise]);
}

/**
 * Reduce a 200 DPI (o el target especificado) las páginas que tengan escaneo de alta resolución.
 * Si el archivo ya estaba a 200 DPI o menos, NO lo toca y devuelve los bytes originales exactos.
 */
export async function optimizePdfFileToDpi(
  file: File,
  analysis: DpiAnalysisResult,
  targetDpi = 200,
  jpegQuality = 0.82,
  onProgress?: (page: number, totalPages: number) => void
): Promise<OptimizationResultItem> {
  const originalBytes = new Uint8Array(await file.arrayBuffer());

  // Si no necesita reducción porque ya estaba a 200 DPI o menos para este target:
  // Conservamos el archivo 100% original sin recomprimir ni alterar un solo byte
  const shouldDownsample = analysis.maxDetectedDpi > targetDpi + 25;
  if (!shouldDownsample) {
    if (onProgress) {
      onProgress(analysis.totalPages, analysis.totalPages);
    }
    return {
      id: analysis.id,
      fileName: file.name,
      originalSize: file.size,
      finalSize: file.size,
      bytes: originalBytes,
      wasDownsampled: false,
      detectedDpi: analysis.maxDetectedDpi,
      status: 'kept_original',
    };
  }

  let pdfJsDoc: any = null;
  try {
    const srcDoc = await PDFDocument.load(originalBytes.slice(), { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();
    const totalPages = srcDoc.getPageCount();

    // Inicializamos PDF.js para renderizar a 200 DPI exactos
    pdfJsDoc = await pdfjsLib.getDocument(getPdfJsDocOptions(originalBytes)).promise;

    // Creamos un ÚNICO canvas reciclable fuera del bucle para no saturar memoria RAM
    const sharedCanvas = document.createElement('canvas');
    const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: false });
    if (!sharedCtx) {
      throw new Error('No se pudo inicializar el contexto 2D para renderizado.');
    }

    for (let i = 0; i < totalPages; i++) {
      if (onProgress) {
        onProgress(i + 1, totalPages);
      }

      const pageNum = i + 1;
      const pageInfo = analysis.pagesInfo[i];
      const pageNeedsDownsample = pageInfo ? pageInfo.dpi > targetDpi + 25 : true;

      if (!pageNeedsDownsample) {
        // Esta página particular no es pesada, la copiamos intacta con calidad original
        const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
        newDoc.addPage(copiedPage);
      } else {
        // Esta página tiene 1200 DPI o alta resolución: la renderizamos a 200 DPI
        const page = await pdfJsDoc.getPage(pageNum);
        const srcPage = srcDoc.getPage(i);
        const { width: pWidth, height: pHeight } = srcPage.getSize();
        const rotAngle = (srcPage.getRotation()?.angle || 0) % 360;

        // Escala matemática exacta para 200 DPI:
        // 72 puntos = 1 pulgada -> escala = targetDpi / 72
        const scale = targetDpi / 72;

        // Obtenemos viewport sin rotación para pintar el bitmap derecho en el canvas
        const viewport = page.getViewport({ scale, rotation: 0 });

        const targetW = Math.max(1, Math.round(viewport.width));
        const targetH = Math.max(1, Math.round(viewport.height));

        // Reutilizamos el lienzo compartido ajustando sus dimensiones
        if (sharedCanvas.width !== targetW) sharedCanvas.width = targetW;
        if (sharedCanvas.height !== targetH) sharedCanvas.height = targetH;

        sharedCtx.fillStyle = '#ffffff';
        sharedCtx.fillRect(0, 0, targetW, targetH);

        const renderTask = (page as any).render({
          canvasContext: sharedCtx,
          viewport,
          background: '#ffffff',
        });
        await renderTask.promise;

        // Comprimir a JPEG optimizado
        const jpegBlob = await new Promise<Blob | null>((resolve) => {
          sharedCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', jpegQuality);
        });

        // 1. Limpieza inmediata del canvas para no retener mapas de bits en GPU/RAM
        sharedCtx.clearRect(0, 0, targetW, targetH);
        sharedCanvas.width = 1;
        sharedCanvas.height = 1;

        // 2. Destrucción forzada de la caché de PDF.js para esta página específica
        try {
          (page as any).cleanup?.();
        } catch (_) {}

        if (!jpegBlob) {
          throw new Error('No se pudo generar la imagen comprimida de la página.');
        }

        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const embeddedImg = await newDoc.embedJpg(jpegBytes);

        // Agregamos la página con sus dimensiones físicas exactas (A4, Oficio, etc.)
        const newPage = newDoc.addPage([pWidth, pHeight]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pWidth,
          height: pHeight,
        });

        // Preservamos la rotación original de la hoja si la tenía
        if (rotAngle !== 0) {
          newPage.setRotation(degrees(rotAngle));
        }
      }

      // 3. Pausa de respiro (35ms) para permitir al Garbage Collector (V8) liberar la RAM antes de la siguiente foja
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    // Descartamos definitivamente el canvas compartido
    sharedCanvas.width = 0;
    sharedCanvas.height = 0;

    const finalBytes = await newDoc.save();

    // Verificación de seguridad: si por alguna rareza el archivo procesado resultara más grande
    // que el original, devolvemos el original
    if (finalBytes.byteLength >= originalBytes.byteLength) {
      return {
        id: analysis.id,
        fileName: file.name,
        originalSize: file.size,
        finalSize: file.size,
        bytes: originalBytes,
        wasDownsampled: false,
        detectedDpi: analysis.maxDetectedDpi,
        status: 'kept_original',
      };
    }

    return {
      id: analysis.id,
      fileName: file.name,
      originalSize: file.size,
      finalSize: finalBytes.byteLength,
      bytes: finalBytes,
      wasDownsampled: true,
      detectedDpi: analysis.maxDetectedDpi,
      status: 'optimized',
    };
  } catch (err: any) {
    console.error(`Error optimizando ${file.name}:`, err);
    // En caso de error inesperado, salvaguardar devolviendo el archivo original
    return {
      id: analysis.id,
      fileName: file.name,
      originalSize: file.size,
      finalSize: file.size,
      bytes: originalBytes,
      wasDownsampled: false,
      detectedDpi: analysis.maxDetectedDpi,
      status: 'error',
      errorMessage: err.message || 'Error al procesar archivo',
    };
  } finally {
    try {
      pdfJsDoc?.destroy?.();
    } catch (_) {}
  }
}
