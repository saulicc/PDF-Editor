/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DocumentInfo, PageInfo } from '../types';

// Set worker source for pdfjs-dist
try {
  // Using unpkg worker matching pdfjs version ensures 100% reliable execution across dev & prod containers
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Could not set pdfjs workerSrc:', e);
}

/**
 * Generates an authentic sample administrative PDF document (e.g. 5 or 66 pages)
 * representing an official Corrientes government administrative file / expediente.
 */
export async function generateSampleDocument(pageCount: number = 5): Promise<DocumentInfo> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const pagesInfo: PageInfo[] = [];

  for (let i = 1; i <= pageCount; i++) {
    // Si hay más de una página, la página 2 es apaisada/horizontal para verificar soporte mixto
    const isLandscape = pageCount >= 2 && i === 2;
    const width = isLandscape ? 841.89 : 595.28;
    const height = isLandscape ? 595.28 : 841.89;
    const page = pdfDoc.addPage([width, height]);
    pagesInfo.push({ pageNumber: i, width, height });

    // Official Corrientes Government Header
    page.drawLine({
      start: { x: 50, y: height - 60 },
      end: { x: width - 50, y: height - 60 },
      thickness: 1.5,
      color: rgb(0.12, 0.23, 0.37),
    });

    page.drawText('GOBIERNO DE LA PROVINCIA DE CORRIENTES', {
      x: 50,
      y: height - 50,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.23, 0.37),
    });

    page.drawText('INSTITUTO DE CULTURA — MESA GENERAL DE ENTRADAS Y EXPEDIENTES', {
      x: 50,
      y: height - 74,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.3, 0.4, 0.5),
    });

    page.drawText(`Expediente N° 450-08912/26 • Actuación N° ${i}`, {
      x: width - 240,
      y: height - 50,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Body content simulation
    const titleText = i === 1 
      ? 'RESOLUCIÓN N° 142/26 — INICIO DE ACTUACIONES ADMINISTRATIVAS'
      : `ANEXO DOCUMENTAL — ACTUACIÓN Y ANTECEDENTES (FOJA ${i})`;

    page.drawText(titleText, {
      x: 50,
      y: height - 120,
      size: 12,
      font: fontTimesBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Realistic paragraph lines
    const paragraphs = [
      'VISTO el Expediente N° 450-08912/26, en virtud del cual se tramita la solicitud de catalogación, preservación y puesta en valor del patrimonio cultural tangible e intangible de la Provincia de Corrientes; y',
      'CONSIDERANDO: Que conforme a las atribuciones conferidas por la Ley Provincial N° 6.220 y decretos reglamentarios vigentes, corresponde a este Instituto de Cultura intervenir oportunamente en el registro y foliatura de todas las fojas que integran el presente cuerpo procesal;',
      'Que a fs. 1 obra nota formal remitida por la Dirección de Patrimonio Cultural, requiriendo la debida certificación y asiento fehaciente en la mesa de entradas;',
      'Por ello, en uso de las facultades conferidas por el Poder Ejecutivo Provincial, el Presidente del Instituto de Cultura de la Provincia de Corrientes:',
      `RESUELVE: Art. 1°.- Disponer la agregación correlativa del presente cuerpo documental compuesto por fojas foliadas cronológicamente, garantizando la plena inalterabilidad de los antecedentes administrativos.`,
      `Art. 2°.- Regístrese, notifíquese a los sectores correspondientes y archívese la copia de resguardo en los términos de la normativa aplicable.`
    ];

    let currentY = height - 150;
    for (const p of paragraphs) {
      // Split paragraph into lines to avoid overflow
      const words = p.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const textWidth = fontTimes.widthOfTextAtSize(testLine, 10.5);
        if (textWidth > width - 110) {
          page.drawText(line, {
            x: 55,
            y: currentY,
            size: 10.5,
            font: fontTimes,
            color: rgb(0.15, 0.15, 0.15),
            lineHeight: 15,
          });
          currentY -= 16;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, {
          x: 55,
          y: currentY,
          size: 10.5,
          font: fontTimes,
          color: rgb(0.15, 0.15, 0.15),
        });
        currentY -= 24;
      }
    }

    // Grid simulation for documentation pages
    if (i > 1) {
      page.drawRectangle({
        x: 55,
        y: currentY - 140,
        width: width - 110,
        height: 130,
        borderColor: rgb(0.8, 0.85, 0.9),
        borderWidth: 1,
        color: rgb(0.98, 0.99, 1),
      });

      page.drawText('TABLA DE REGISTRO DOCUMENTAL Y CONSTANCIAS PROBATORIAS', {
        x: 65,
        y: currentY - 25,
        size: 9,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.4),
      });

      page.drawText(`Ítem 1: Informe técnico patrimonial sector norte - fs. ${i * 2 - 1}`, {
        x: 65,
        y: currentY - 50,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`Ítem 2: Constancia de inspección y registro fotográfico digital`, {
        x: 65,
        y: currentY - 75,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`Ítem 3: Acta de conformidad y pase a la Asesoría Legal`, {
        x: 65,
        y: currentY - 100,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    // Official Footer
    page.drawLine({
      start: { x: 50, y: 50 },
      end: { x: width - 50, y: 50 },
      thickness: 0.8,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText(`Página ${i} de ${pageCount}`, {
      x: width / 2 - 25,
      y: 35,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText('DOCUMENTO PÚBLICO ADMINISTRATIVO — REPÚBLICA ARGENTINA', {
      x: 50,
      y: 35,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();

  return {
    fileName: `Expediente_Cultura_Corrientes_${pageCount}_paginas.pdf`,
    fileSize: pdfBytes.byteLength,
    totalPages: pageCount,
    pages: pagesInfo,
    pdfBytes,
  };
}

/**
 * Loads a user-provided PDF file buffer and parses its page count and dimensions.
 */
export async function loadUserPdfDocument(file: File): Promise<DocumentInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pages: PageInfo[] = [];

  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const rot = (page.getRotation()?.angle || 0) % 360;
    const isSideways = rot === 90 || rot === 270;
    pages.push({
      pageNumber: i + 1,
      width: isSideways ? height : width,
      height: isSideways ? width : height,
      rotation: rot,
    });
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    totalPages,
    pages,
    pdfBytes,
  };
}

// In-memory cache for rendered PDFJS loading tasks
let cachedDocPromise: Promise<any> | null = null;
let cachedPdfBytes: Uint8Array | null = null;

export function getPdfJsDocument(pdfBytes: Uint8Array): Promise<any> {
  // If we already have a loading/resolved promise for these exact bytes, reuse it immediately
  if (cachedDocPromise && cachedPdfBytes === pdfBytes) {
    return cachedDocPromise;
  }

  // If there was a previous different document loaded, clean it up
  if (cachedDocPromise && cachedPdfBytes !== pdfBytes) {
    cachedDocPromise.then((doc) => {
      try {
        doc.destroy?.();
      } catch (_) {}
    }).catch(() => {});
  }

  cachedPdfBytes = pdfBytes;
  // CRITICAL: Always slice a fresh copy of the Uint8Array buffer so the web worker
  // transfer never detaches the original Uint8Array buffer used by the application!
  const bufferCopy = pdfBytes.slice();

  const loadingTask = pdfjsLib.getDocument({
    data: bufferCopy,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  cachedDocPromise = loadingTask.promise.catch((err) => {
    // If loading fails, clear cache so subsequent retries can succeed
    if (cachedPdfBytes === pdfBytes) {
      cachedDocPromise = null;
      cachedPdfBytes = null;
    }
    throw err;
  });

  return cachedDocPromise;
}

let renderSequence = 0;

/**
 * Cancels any active rendering task on the specified canvas.
 */
export function cancelActiveCanvasRender(canvas: HTMLCanvasElement): void {
  if ((canvas as any)._activeRenderTask) {
    try {
      (canvas as any)._activeRenderTask.cancel();
    } catch (_) {}
    (canvas as any)._activeRenderTask = null;
  }
}

/**
 * Renders a specific page of a PDF document onto an HTML5 Canvas using an offscreen
 * double-buffering approach. This completely prevents the "Cannot use the same canvas
 * during multiple render() operations" error by giving every render operation its own
 * isolated offscreen canvas, and only blitting the finished result onto the target canvas.
 */
export async function renderPdfPageToCanvas(
  pdfBytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): Promise<{ width: number; height: number; viewportWidth: number; viewportHeight: number }> {
  // 1. Cancel previous ongoing render task on this canvas if any
  cancelActiveCanvasRender(canvas);

  // 2. Assign a unique token for this invocation to prevent out-of-order race conditions
  const currentToken = ++renderSequence;
  (canvas as any)._currentRenderToken = currentToken;

  const pdfJsDoc = await getPdfJsDocument(pdfBytes);
  const page = await pdfJsDoc.getPage(pageNumber);

  // Check if cancelled while waiting for PDF document/page
  if ((canvas as any)._currentRenderToken !== currentToken) {
    return { width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
  }

  // High-DPI rendering for sharp text
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });
  const displayViewport = page.getViewport({ scale });

  // Use an isolated offscreen canvas to perform the PDF.js render.
  // This guarantees that PDF.js never encounters concurrent render() calls on the same canvas.
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = viewport.width;
  offscreenCanvas.height = viewport.height;

  const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
  if (!offscreenCtx) throw new Error('Could not obtain offscreen canvas 2D context');

  // Fill crisp white background
  offscreenCtx.fillStyle = '#ffffff';
  offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  const renderContext = {
    canvasContext: offscreenCtx,
    viewport: viewport,
  };

  const renderTask = page.render(renderContext);
  (canvas as any)._activeRenderTask = renderTask;

  try {
    await renderTask.promise;
  } catch (err: any) {
    if (err?.name === 'RenderingCancelledException') {
      // Ignored - normal cancellation on rapid page change or zoom
      return {
        width: displayViewport.width,
        height: displayViewport.height,
        viewportWidth: displayViewport.width,
        viewportHeight: displayViewport.height,
      };
    }
    throw err;
  } finally {
    if ((canvas as any)._activeRenderTask === renderTask) {
      (canvas as any)._activeRenderTask = null;
    }
  }

  // 3. Atomically copy the rendered offscreen buffer to the target canvas
  // if this render is still the latest one requested for this canvas
  if ((canvas as any)._currentRenderToken === currentToken) {
    if (canvas.width !== viewport.width) canvas.width = viewport.width;
    if (canvas.height !== viewport.height) canvas.height = viewport.height;
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(offscreenCanvas, 0, 0);
    }
  }

  return {
    width: displayViewport.width,
    height: displayViewport.height,
    viewportWidth: displayViewport.width,
    viewportHeight: displayViewport.height,
  };
}
