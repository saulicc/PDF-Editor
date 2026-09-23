/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - bundled worker file does not supply separate .d.ts
import * as pdfWorkerModule from 'pdfjs-dist/build/pdf.worker.min.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, PDFName, PDFDict, StandardFonts, rgb } from 'pdf-lib';
import { DocumentInfo, PageInfo } from '../types';

// Register in-memory worker module on globalThis and window so PDF.js never fails or hangs in iframes
if (typeof globalThis !== 'undefined') {
  (globalThis as any).pdfjsWorker = pdfWorkerModule;
}
if (typeof window !== 'undefined') {
  (window as any).pdfjsWorker = pdfWorkerModule;
}

// Set worker source for pdfjs-dist: bundled local worker ensures 100% offline & sandbox execution
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
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
  const pdfDoc = await PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pages: PageInfo[] = [];

  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    let width = 595.28;
    let height = 841.89;
    try {
      const crop = page.getCropBox();
      if (crop && crop.width > 0 && crop.height > 0) {
        width = crop.width;
        height = crop.height;
      } else {
        const sz = page.getSize();
        if (sz.width > 0 && sz.height > 0) {
          width = sz.width;
          height = sz.height;
        }
      }
    } catch (_) {
      try {
        const sz = page.getSize();
        width = sz.width;
        height = sz.height;
      } catch (_) {}
    }

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

function getPdfJsDocOptions(pdfBytes: Uint8Array): any {
  const bufferCopy = pdfBytes.slice();
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';

  // Local wasm bundle ensures offline & sandboxed jbig2 / openjpeg decoding
  const wasmUrl = origin
    ? `${origin}/wasm/`
    : `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`;

  return {
    data: bufferCopy,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    wasmUrl,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    useWorkerFetch: true,
  };
}

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
  const loadingTask = pdfjsLib.getDocument(getPdfJsDocOptions(pdfBytes));

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

// In-memory cache for loaded pdf-lib documents for rapid fallback inspections
let cachedPdfLibDocPromise: Promise<PDFDocument> | null = null;
let cachedPdfLibBytes: Uint8Array | null = null;

export function getCachedPdfLibDocument(pdfBytes: Uint8Array): Promise<PDFDocument> {
  if (cachedPdfLibDocPromise && cachedPdfLibBytes === pdfBytes) {
    return cachedPdfLibDocPromise;
  }
  cachedPdfLibBytes = pdfBytes;
  cachedPdfLibDocPromise = PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: true }).catch((err) => {
    if (cachedPdfLibBytes === pdfBytes) {
      cachedPdfLibDocPromise = null;
      cachedPdfLibBytes = null;
    }
    throw err;
  });
  return cachedPdfLibDocPromise;
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
  (canvas as any)._activeRenderState = null;
}

/**
 * High-accuracy inspection to check if a rendered canvas is completely blank white or transparent.
 * Checks full-image strides and the center column to reliably detect drawn content.
 */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return true;

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;

    // Fast stride check across full canvas (every 16th pixel = 64 bytes)
    for (let i = 0; i < len; i += 64) {
      const a = data[i + 3];
      if (a > 10) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // If not pure white (has any dark or colored ink)
        if (r < 248 || g < 248 || b < 248) {
          return false;
        }
      }
    }

    // High-density check on document middle vertical slice (where scanned content is located)
    const midX = Math.floor(w / 2);
    const midColumn = ctx.getImageData(midX, 0, 1, h).data;
    for (let i = 0; i < midColumn.length; i += 4) {
      const a = midColumn[i + 3];
      if (a > 10) {
        const r = midColumn[i];
        const g = midColumn[i + 1];
        const b = midColumn[i + 2];
        if (r < 248 || g < 248 || b < 248) {
          return false;
        }
      }
    }
  } catch (_) {
    // If getImageData is restricted (e.g. cross-origin canvas), assume not blank
    return false;
  }
  return true;
}

/**
 * Checks if a given PDF page contains image XObjects (characteristic of scanned documents).
 */
async function pageHasImageXObjects(pdfBytes: Uint8Array, pageNumber: number): Promise<boolean> {
  try {
    const pdfDoc = await getCachedPdfLibDocument(pdfBytes);
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) return false;
    const page = pdfDoc.getPage(pageIndex);
    const resourcesRef = page.node.get(PDFName.of('Resources'));
    if (!resourcesRef) return false;
    const resources = pdfDoc.context.lookup(resourcesRef) as PDFDict;
    if (!resources || !(resources instanceof PDFDict)) return false;
    const xObjectRef = resources.get(PDFName.of('XObject'));
    if (!xObjectRef) return false;
    const xObjectDict = pdfDoc.context.lookup(xObjectRef) as PDFDict;
    if (!xObjectDict || !(xObjectDict instanceof PDFDict)) return false;

    for (const key of xObjectDict.keys()) {
      const obj = pdfDoc.context.lookup(xObjectDict.get(key)) as any;
      if (obj?.dict?.get(PDFName.of('Subtype'))?.toString() === '/Image') {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Decompresses raw flate streams using browser-native DecompressionStream.
 */
async function decompressFlateStream(bytes: Uint8Array): Promise<Uint8Array> {
  // Try standard deflate stream
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes as any);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  } catch (_) {
    // Try raw deflate stream
    const dsRaw = new DecompressionStream('deflate-raw');
    const writer = dsRaw.writable.getWriter();
    writer.write(bytes as any);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = dsRaw.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }
}

interface ExtractedScannedImage {
  type: 'jpeg' | 'flate' | 'unknown';
  bytes: Uint8Array;
  width: number;
  height: number;
  colorSpace?: string;
  bitsPerComponent?: number;
}

/**
 * Extracts candidate scanned images directly from the page's XObject dictionary using pdf-lib.
 */
async function extractScannedImageFromPage(
  pdfBytes: Uint8Array,
  pageNumber: number
): Promise<{ images: ExtractedScannedImage[]; pageWidth: number; pageHeight: number; rotation: number }> {
  const pdfDoc = await getCachedPdfLibDocument(pdfBytes);
  const pageIndex = pageNumber - 1;
  const page = pdfDoc.getPage(pageIndex);
  const { width: pWidth, height: pHeight } = page.getSize();
  const rotation = (page.getRotation()?.angle || 0) % 360;

  const images: ExtractedScannedImage[] = [];
  try {
    const resourcesRef = page.node.get(PDFName.of('Resources'));
    if (!resourcesRef) return { images, pageWidth: pWidth, pageHeight: pHeight, rotation };
    const resources = pdfDoc.context.lookup(resourcesRef) as PDFDict;
    if (!resources || !(resources instanceof PDFDict)) {
      return { images, pageWidth: pWidth, pageHeight: pHeight, rotation };
    }
    const xObjectRef = resources.get(PDFName.of('XObject'));
    if (!xObjectRef) return { images, pageWidth: pWidth, pageHeight: pHeight, rotation };
    const xObjectDict = pdfDoc.context.lookup(xObjectRef) as PDFDict;
    if (!xObjectDict || !(xObjectDict instanceof PDFDict)) {
      return { images, pageWidth: pWidth, pageHeight: pHeight, rotation };
    }

    for (const key of xObjectDict.keys()) {
      const obj = pdfDoc.context.lookup(xObjectDict.get(key)) as any;
      if (!obj || !obj.dict) continue;
      const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString();
      if (subtype !== '/Image') continue;

      const filterObj = obj.dict.get(PDFName.of('Filter'));
      const filterStr = filterObj ? filterObj.toString() : '';
      const width = obj.dict.get(PDFName.of('Width'))?.asNumber?.() || 0;
      const height = obj.dict.get(PDFName.of('Height'))?.asNumber?.() || 0;
      const colorSpace = obj.dict.get(PDFName.of('ColorSpace'))?.toString();
      const bitsPerComponent = obj.dict.get(PDFName.of('BitsPerComponent'))?.asNumber?.() || 8;
      const contents = obj.getContents();

      // Check if JPEG (either explicitly DCTDecode or starts with standard JPEG SOI marker 0xFF, 0xD8)
      const isJpeg =
        filterStr.includes('DCTDecode') ||
        (contents.length >= 2 && contents[0] === 0xff && contents[1] === 0xd8);

      if (isJpeg) {
        images.push({
          type: 'jpeg',
          bytes: contents,
          width,
          height,
          colorSpace,
          bitsPerComponent,
        });
      } else if (filterStr.includes('FlateDecode')) {
        images.push({
          type: 'flate',
          bytes: contents,
          width,
          height,
          colorSpace,
          bitsPerComponent,
        });
      } else {
        images.push({
          type: 'unknown',
          bytes: contents,
          width,
          height,
          colorSpace,
          bitsPerComponent,
        });
      }
    }
  } catch (_) {}

  // Sort candidate images by pixel area descending so the primary full-page scan is used
  images.sort((a, b) => b.width * b.height - a.width * a.height);
  return { images, pageWidth: pWidth, pageHeight: pHeight, rotation };
}

/**
 * Fallback rendering strategy for scanned PDFs or pages whose content cannot be
 * properly interpreted by standard PDF.js canvas execution.
 * Renders the page visually as an image onto the canvas preserving exact aspect ratio.
 */
async function renderScannedPageFallback(
  pdfBytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  currentToken: number
): Promise<{ width: number; height: number; viewportWidth: number; viewportHeight: number }> {
  try {
    const { images, pageWidth, pageHeight, rotation } = await extractScannedImageFromPage(
      pdfBytes,
      pageNumber
    );

    const isSideways = rotation === 90 || rotation === 270;
    const visualWidth = isSideways ? pageHeight : pageWidth;
    const visualHeight = isSideways ? pageWidth : pageHeight;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const displayWidth = Math.round(visualWidth * scale);
    const displayHeight = Math.round(visualHeight * scale);
    const renderWidth = Math.max(1, Math.round(displayWidth * dpr));
    const renderHeight = Math.max(1, Math.round(displayHeight * dpr));

    // Create an isolated offscreen canvas for rendering the fallback image
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = renderWidth;
    fallbackCanvas.height = renderHeight;
    const fCtx = fallbackCanvas.getContext('2d');
    if (!fCtx) throw new Error('Could not create fallback canvas context');

    // Fill clean white background
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(0, 0, renderWidth, renderHeight);

    let renderedSuccessfully = false;

    // Strategy 1: Extract image objects directly from PDF.js operator list & objects pool
    // This handles 1-bit monochrome (CCITT / fax / NAPS2 black & white scans), JBIG2, and direct bitmaps
    try {
      const pdfJsDoc = await getPdfJsDocument(pdfBytes);
      const page = await pdfJsDoc.getPage(pageNumber);
      const ops = await page.getOperatorList();

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (
          fn === (pdfjsLib as any).OPS.paintImageXObject ||
          fn === (pdfjsLib as any).OPS.paintImageMaskXObject ||
          fn === (pdfjsLib as any).OPS.paintInlineImageXObject
        ) {
          const objId = ops.argsArray[i]?.[0];
          if (!objId) continue;

          const imgObj: any = await new Promise((resolve) => {
            try {
              page.objs.get(objId, (data: any) => resolve(data));
            } catch (_) {
              resolve(null);
            }
          });

          if (imgObj) {
            if (imgObj.bitmap) {
              fCtx.drawImage(imgObj.bitmap, 0, 0, renderWidth, renderHeight);
              renderedSuccessfully = true;
              break;
            } else if (imgObj.data && imgObj.width > 0 && imgObj.height > 0) {
              const w = imgObj.width;
              const h = imgObj.height;
              const tempC = document.createElement('canvas');
              tempC.width = w;
              tempC.height = h;
              const tCtx = tempC.getContext('2d');
              if (tCtx) {
                const outImgData = tCtx.createImageData(w, h);
                const u32 = new Uint32Array(outImgData.data.buffer);

                if (imgObj.kind === 1) {
                  // 1-bit monochrome mask (e.g. NAPS2 black & white scan)
                  const src = imgObj.data;
                  const rowBytes = (w + 7) >> 3;
                  for (let r = 0; r < h; r++) {
                    const rowOffset = r * rowBytes;
                    const destOffset = r * w;
                    for (let c = 0; c < w; c++) {
                      const byte = src[rowOffset + (c >> 3)];
                      const bit = (byte >> (7 - (c & 7))) & 1;
                      // In 1-bit black & white scans: 0 is black, 1 is white
                      u32[destOffset + c] = bit === 0 ? 0xff000000 : 0xffffffff;
                    }
                  }
                } else if (imgObj.kind === 2) {
                  // RGB 24bpp
                  const src = imgObj.data;
                  let srcPos = 0;
                  for (let p = 0; p < w * h; p++) {
                    const r = src[srcPos++];
                    const g = src[srcPos++];
                    const b = src[srcPos++];
                    u32[p] = 0xff000000 | (b << 16) | (g << 8) | r;
                  }
                } else {
                  // Standard RGBA 32bpp
                  outImgData.data.set(imgObj.data);
                }

                tCtx.putImageData(outImgData, 0, 0);
                fCtx.drawImage(tempC, 0, 0, renderWidth, renderHeight);
                renderedSuccessfully = true;
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PDFRenderer] Operator list image extraction failed:', e);
    }

    // Strategy 2: If we have an extracted JPEG image (most common color/grayscale scanner format)
    const jpegCandidate = images.find((img) => img.type === 'jpeg');
    if (!renderedSuccessfully && jpegCandidate && jpegCandidate.bytes.length > 0) {
      try {
        const raw = jpegCandidate.bytes;
        const cleanBytes = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        const blob = new Blob([cleanBytes as any], { type: 'image/jpeg' });
        const objUrl = URL.createObjectURL(blob);

        const imgElement = new Image();
        await new Promise<void>((resolve, reject) => {
          imgElement.onload = () => resolve();
          imgElement.onerror = reject;
          imgElement.src = objUrl;
        });

        // Compute aspect ratio fit
        const imgAspect = imgElement.width / imgElement.height;
        const pageAspect = visualWidth / visualHeight;

        fCtx.save();

        // Check if rotation needs adjustment
        const matchesVisual = Math.abs(imgAspect - pageAspect) < 0.15;
        const matchesOriginal = Math.abs(imgAspect - (pageWidth / pageHeight)) < 0.15;

        if (!matchesVisual && matchesOriginal && rotation !== 0) {
          if (rotation === 90) {
            fCtx.translate(renderWidth, 0);
            fCtx.rotate((90 * Math.PI) / 180);
            fCtx.drawImage(imgElement, 0, 0, renderHeight, renderWidth);
          } else if (rotation === 180) {
            fCtx.translate(renderWidth, renderHeight);
            fCtx.rotate((180 * Math.PI) / 180);
            fCtx.drawImage(imgElement, 0, 0, renderWidth, renderHeight);
          } else if (rotation === 270) {
            fCtx.translate(0, renderHeight);
            fCtx.rotate((270 * Math.PI) / 180);
            fCtx.drawImage(imgElement, 0, 0, renderHeight, renderWidth);
          }
        } else {
          // Draw directly contained
          let drawW = renderWidth;
          let drawH = renderHeight;
          let drawX = 0;
          let drawY = 0;

          if (Math.abs(imgAspect - pageAspect) > 0.02) {
            if (imgAspect > pageAspect) {
              drawW = renderWidth;
              drawH = Math.round(renderWidth / imgAspect);
              drawY = Math.round((renderHeight - drawH) / 2);
            } else {
              drawH = renderHeight;
              drawW = Math.round(renderHeight * imgAspect);
              drawX = Math.round((renderWidth - drawW) / 2);
            }
          }
          fCtx.drawImage(imgElement, drawX, drawY, drawW, drawH);
        }

        fCtx.restore();
        URL.revokeObjectURL(objUrl);
        renderedSuccessfully = true;
      } catch (_) {}
    }

    // Strategy 3: If we have an extracted Flate image
    const flateCandidate = images.find((img) => img.type === 'flate');
    if (!renderedSuccessfully && flateCandidate && flateCandidate.width > 0 && flateCandidate.height > 0) {
      try {
        const decompressed = await decompressFlateStream(flateCandidate.bytes);
        const w = flateCandidate.width;
        const h = flateCandidate.height;

        // Build ImageData
        const imgData = fCtx.createImageData(w, h);
        const data = imgData.data;

        if (decompressed.length >= w * h * 3) {
          // RGB (3 bytes per pixel)
          let srcIdx = 0;
          let destIdx = 0;
          for (let p = 0; p < w * h; p++) {
            data[destIdx] = decompressed[srcIdx];
            data[destIdx + 1] = decompressed[srcIdx + 1];
            data[destIdx + 2] = decompressed[srcIdx + 2];
            data[destIdx + 3] = 255;
            srcIdx += 3;
            destIdx += 4;
          }
        } else if (decompressed.length >= w * h) {
          // Grayscale (1 byte per pixel)
          let srcIdx = 0;
          let destIdx = 0;
          for (let p = 0; p < w * h; p++) {
            const val = decompressed[srcIdx++];
            data[destIdx] = val;
            data[destIdx + 1] = val;
            data[destIdx + 2] = val;
            data[destIdx + 3] = 255;
            destIdx += 4;
          }
        }

        // Draw onto a temporary canvas and scale onto fallback canvas
        const tempC = document.createElement('canvas');
        tempC.width = w;
        tempC.height = h;
        const tempCtx = tempC.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(imgData, 0, 0);
          fCtx.drawImage(tempC, 0, 0, renderWidth, renderHeight);
          renderedSuccessfully = true;
        }
      } catch (_) {}
    }

    // Strategy 4: Isolated single-page PDF render via fresh PDF.js loading task
    if (!renderedSuccessfully) {
      try {
        const pdfDoc = await getCachedPdfLibDocument(pdfBytes);
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(pdfDoc, [pageNumber - 1]);
        singleDoc.addPage(copiedPage);
        const singleBytes = await singleDoc.save();

        const singlePdfJsDoc = await pdfjsLib.getDocument(
          getPdfJsDocOptions(singleBytes)
        ).promise;

        const singlePage = await singlePdfJsDoc.getPage(1);
        const viewport = singlePage.getViewport({ scale: scale * dpr });
        const renderTask = (singlePage as any).render({
          canvasContext: fCtx,
          viewport,
          background: '#ffffff',
        });
        await renderTask.promise;
        renderedSuccessfully = true;
      } catch (_) {}
    }

    // Strategy 5: Clean visual page placeholder if all decoders fail
    if (!renderedSuccessfully) {
      fCtx.fillStyle = '#fafafa';
      fCtx.fillRect(0, 0, renderWidth, renderHeight);
      fCtx.strokeStyle = '#cbd5e1';
      fCtx.lineWidth = Math.max(1, 2 * dpr);
      fCtx.strokeRect(4 * dpr, 4 * dpr, renderWidth - 8 * dpr, renderHeight - 8 * dpr);

      fCtx.fillStyle = '#64748b';
      fCtx.font = `bold ${Math.max(10, Math.round(14 * scale * dpr))}px sans-serif`;
      fCtx.textAlign = 'center';
      fCtx.textBaseline = 'middle';
      fCtx.fillText(`Página ${pageNumber}`, renderWidth / 2, renderHeight / 2 - 8 * dpr);

      fCtx.font = `normal ${Math.max(8, Math.round(11 * scale * dpr))}px sans-serif`;
      fCtx.fillStyle = '#94a3b8';
      fCtx.fillText(`Documento escaneado`, renderWidth / 2, renderHeight / 2 + 10 * dpr);
    }

    // Atomically transfer to target canvas if still current
    if ((canvas as any)._currentRenderToken === currentToken) {
      if (canvas.width !== renderWidth) canvas.width = renderWidth;
      if (canvas.height !== renderHeight) canvas.height = renderHeight;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(fallbackCanvas, 0, 0);
      }
    }

    return {
      width: displayWidth,
      height: displayHeight,
      viewportWidth: displayWidth,
      viewportHeight: displayHeight,
    };
  } catch (fallbackError) {
    console.warn('Fallback rendering encountered error:', fallbackError);
    return {
      width: 0,
      height: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    };
  }
}

/**
 * Renders a specific page of a PDF document onto an HTML5 Canvas using an offscreen
 * double-buffering approach with seamless scanned PDF fallback.
 * Normal PDFs utilize the high-speed PDF.js renderer. Scanned documents or pages
 * with non-interpretable vector structures automatically activate the image fallback.
 */
export async function renderPdfPageToCanvas(
  pdfBytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): Promise<{ width: number; height: number; viewportWidth: number; viewportHeight: number }> {
  // Check if this exact render (same canvas, bytes, page, scale) is already in flight
  const existingState = (canvas as any)._activeRenderState;
  if (
    existingState &&
    existingState.pdfBytes === pdfBytes &&
    existingState.pageNumber === pageNumber &&
    Math.abs(existingState.scale - scale) < 0.001 &&
    existingState.promise
  ) {
    return existingState.promise;
  }

  // Cancel any different previous ongoing render task on this canvas
  cancelActiveCanvasRender(canvas);

  // Assign a unique token for this invocation to prevent out-of-order race conditions
  const currentToken = ++renderSequence;
  (canvas as any)._currentRenderToken = currentToken;

  const renderExecutionPromise = (async () => {
    let pdfJsDoc: any = null;
    let page: any = null;

    try {
      pdfJsDoc = await getPdfJsDocument(pdfBytes);
      page = await pdfJsDoc.getPage(pageNumber);
    } catch (docLoadError) {
      return renderScannedPageFallback(pdfBytes, pageNumber, canvas, scale, currentToken);
    }

    // Check if cancelled while waiting for PDF document/page
    if ((canvas as any)._currentRenderToken !== currentToken) {
      return { width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
    }

    // High-DPI rendering for sharp text
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewport = page.getViewport({ scale: scale * dpr });
    const displayViewport = page.getViewport({ scale });

    // Use an isolated offscreen canvas to perform the PDF.js render.
    // Default alpha (alpha: true) is critical for PDF.js soft masks, image masks, and knockout stencils
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = Math.max(1, Math.round(viewport.width));
    offscreenCanvas.height = Math.max(1, Math.round(viewport.height));

    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    if (!offscreenCtx) throw new Error('Could not obtain offscreen canvas 2D context');

    const renderContext = {
      canvasContext: offscreenCtx,
      viewport: viewport,
      background: '#ffffff',
    };

    const renderTask = page.render(renderContext);
    (canvas as any)._activeRenderTask = renderTask;

    let renderSucceeded = false;

    try {
      await renderTask.promise;
      // Validate that PDF.js did not produce an empty white canvas for an image document
      const blank = isCanvasBlank(offscreenCanvas);
      if (!blank) {
        renderSucceeded = true;
      } else {
        console.warn(`[PDFRenderer] Page ${pageNumber} standard render is blank. Switching to scanned document fallback...`);
      }
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        return {
          width: displayViewport.width,
          height: displayViewport.height,
          viewportWidth: displayViewport.width,
          viewportHeight: displayViewport.height,
        };
      }
      console.warn(`[PDFRenderer] Page ${pageNumber} standard render threw:`, err);
    } finally {
      if ((canvas as any)._activeRenderTask === renderTask) {
        (canvas as any)._activeRenderTask = null;
      }
    }

    // If PDF.js render succeeded and canvas is not blank, copy offscreen canvas directly to target canvas
    if (renderSucceeded) {
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

    // If PDF.js threw an error or produced a blank white canvas, activate scanned fallback for this page
    return renderScannedPageFallback(pdfBytes, pageNumber, canvas, scale, currentToken);
  })();

  (canvas as any)._activeRenderState = {
    token: currentToken,
    pdfBytes,
    pageNumber,
    scale,
    promise: renderExecutionPromise,
  };

  try {
    return await renderExecutionPromise;
  } finally {
    if ((canvas as any)._activeRenderState?.token === currentToken) {
      (canvas as any)._activeRenderState = null;
    }
  }
}
