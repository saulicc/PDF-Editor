/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Herramientas genéricas de manipulación de PDF: unir, extraer/reordenar
 * páginas, y dividir por rangos. Comparten motor con el resto de la app
 * (pdf-lib para escritura, pdfRenderer.ts + pdfjs-dist para miniaturas).
 */

import { PDFDocument, PDFName, PDFArray, rgb } from 'pdf-lib';
// @ts-ignore
import pako from 'pako';

/**
 * Une varios archivos PDF, en el orden recibido, en un único documento.
 * Soporta callback de progreso para informar archivo actual y porcentaje.
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  return mergedPdf.save();
}

/**
 * Construye un nuevo PDF a partir de un subconjunto (u orden nuevo) de páginas
 * de un documento existente. `pageIndices` son índices base-0 en el ORDEN
 * FINAL deseado — sirve tanto para "eliminar páginas" (pasando las que se
 * quieren conservar) como para "reordenar" (pasando el nuevo orden completo).
 */
export async function extractPages(
  pdfBytes: Uint8Array,
  pageIndices: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));
  return newDoc.save();
}

export interface SplitRange {
  /** Página inicial, base-1, inclusive */
  start: number;
  /** Página final, base-1, inclusive */
  end: number;
}

/**
 * Parsea un string de rangos tipo "1-5, 6-10, 15" en una lista de SplitRange.
 * Cada token separado por coma o punto y coma se convierte en UN archivo
 * de salida al dividir.
 */
export function parseSplitRangesString(str: string, totalPages: number): SplitRange[] {
  const tokens = str.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  const ranges: SplitRange[] = [];

  for (const token of tokens) {
    if (token.includes('-')) {
      const parts = token.split('-').map((s) => parseInt(s.trim(), 10));
      const [a, b] = parts;
      if (!isNaN(a) && !isNaN(b)) {
        const start = Math.max(1, Math.min(a, b));
        const end = Math.min(totalPages, Math.max(a, b));
        if (start <= end) ranges.push({ start, end });
      }
    } else {
      const n = parseInt(token, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) {
        ranges.push({ start: n, end: n });
      }
    }
  }

  return ranges;
}

/**
 * Divide un PDF en varios archivos, uno por cada rango indicado.
 * Carga el documento origen una única vez en memoria para máxima velocidad.
 */
export async function splitPdfByRanges(
  pdfBytes: Uint8Array,
  ranges: SplitRange[],
  onProgress?: (current: number, total: number) => void
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const results: { name: string; bytes: Uint8Array }[] = [];
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const padCount = Math.max(2, String(ranges.length).length);

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const indices: number[] = [];
    for (let p = start; p <= end; p++) indices.push(p - 1);

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save();

    const rangeLabel = start === end ? `pag_${start}` : `pag_${start}-${end}`;
    const partNum = String(i + 1).padStart(padCount, '0');
    results.push({ name: `parte_${partNum}_${rangeLabel}.pdf`, bytes });

    if (onProgress) {
      onProgress(i + 1, ranges.length);
    }
  }

  return results;
}

/**
 * Une todos los rangos indicados en un único PDF.
 */
export async function mergeRangesToSinglePdf(
  pdfBytes: Uint8Array,
  ranges: SplitRange[]
): Promise<Uint8Array> {
  const allIndices: number[] = [];
  for (const r of ranges) {
    for (let p = r.start; p <= r.end; p++) {
      allIndices.push(p - 1);
    }
  }
  return extractPages(pdfBytes, allIndices);
}

/**
 * Extrae cada página indicada como un archivo individual independiente.
 * Carga el documento origen una única vez en memoria para máxima velocidad.
 */
export async function extractPagesAsSeparateFiles(
  pdfBytes: Uint8Array,
  pageNumbers: number[],
  onProgress?: (current: number, total: number) => void
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const results: { name: string; bytes: Uint8Array }[] = [];
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const padCount = Math.max(2, String(pageNumbers.length).length);

  for (let i = 0; i < pageNumbers.length; i++) {
    const pageNum = pageNumbers[i];
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, [pageNum - 1]);
    copiedPages.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save();

    const formattedNum = String(pageNum).padStart(padCount, '0');
    results.push({ name: `pagina_${formattedNum}.pdf`, bytes });

    if (onProgress) {
      onProgress(i + 1, pageNumbers.length);
    }
  }
  return results;
}

/**
 * Dispara la descarga de un único archivo (PDF u otro) en el navegador.
 */
export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType = 'application/pdf') {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Empaqueta varios PDFs resultantes en un único .zip y dispara la descarga.
 */
export async function downloadFilesAsZip(
  files: { name: string; bytes: Uint8Array }[],
  zipFileName: string
) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.bytes);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface UnstampAreaConfig {
  preset: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom';
  width: number;
  height: number;
  marginRight: number;
  marginLeft: number;
  marginTop: number;
  marginBottom: number;
  customX?: number;
  customY?: number;
}

/**
 * Removes/erases folios and stamps from specific pages of an existing PDF.
 * Draws an exact, clean vector white patch over the stamp and folio area.
 * Keeps all other contents on the page completely intact.
 */
export async function removeFoliosFromPdfPages(
  sourcePdfBytes: Uint8Array,
  pageNumbersToUnstamp: number[], // 1-based page numbers
  area: UnstampAreaConfig,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  const pagesSet = new Set(pageNumbersToUnstamp.filter((p) => p >= 1 && p <= totalPages));
  const pagesList = Array.from(pagesSet).sort((a, b) => a - b);

  let processed = 0;
  for (const pageNum of pagesList) {
    const page = pdfDoc.getPage(pageNum - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const w = area.width;
    const h = area.height;

    let boxX = 0;
    let boxY = 0;

    if (area.preset === 'top-right') {
      boxX = pageWidth - w - area.marginRight;
      boxY = pageHeight - h - area.marginTop;
    } else if (area.preset === 'top-left') {
      boxX = area.marginLeft;
      boxY = pageHeight - h - area.marginTop;
    } else if (area.preset === 'bottom-right') {
      boxX = pageWidth - w - area.marginRight;
      boxY = area.marginBottom;
    } else if (area.preset === 'bottom-left') {
      boxX = area.marginLeft;
      boxY = area.marginBottom;
    } else {
      boxX = area.customX ?? (pageWidth - w - 3);
      boxY = pageHeight - (area.customY ?? 3) - h;
    }

    // Safety bounds
    const safeX = Math.max(0, boxX);
    const safeY = Math.max(0, boxY);
    const safeW = Math.min(pageWidth - safeX, w);
    const safeH = Math.min(pageHeight - safeY, h);

    // Clean white vector rectangle over the folio/stamp
    page.drawRectangle({
      x: safeX,
      y: safeY,
      width: safeW,
      height: safeH,
      color: rgb(1, 1, 1),
      opacity: 1.0,
    });

    processed++;
    if (onProgress) {
      onProgress(processed, pagesList.length);
    }
  }

  return pdfDoc.save();
}

/**
 * Safely decodes a PDF stream to string, inflating it with pako if compressed.
 */
function decodePdfStreamToString(stream: any): { text: string; compressed: boolean } {
  const raw = stream.contents;
  if (!raw || raw.length === 0) return { text: '', compressed: false };
  try {
    const uncompressed = pako.inflate(raw);
    let str = '';
    for (let i = 0; i < uncompressed.length; i++) {
      str += String.fromCharCode(uncompressed[i]);
    }
    return { text: str, compressed: true };
  } catch (_) {
    let str = '';
    for (let i = 0; i < raw.length; i++) {
      str += String.fromCharCode(raw[i]);
    }
    return { text: str, compressed: false };
  }
}

/**
 * Encodes text back into a PDF stream, compressing it if it was previously compressed.
 */
function encodeStringToPdfStream(stream: any, text: string, wasCompressed: boolean) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  const finalBytes = wasCompressed ? pako.deflate(bytes) : bytes;
  stream.contents = finalBytes;
  if (stream.dict) {
    stream.dict.set(PDFName.of('Length'), stream.dict.context.obj(finalBytes.length));
  }
}

/**
 * Checks whether a stream's content represents the vector stamp and folio layer added by this app.
 */
function isVectorStampStreamContent(text: string): boolean {
  return (
    text.includes('EmbeddedPdfPage') ||
    (/(\/XObject|\/Fm|\/Form)[^\n\r]*Do[\s\S]*?(Tj|TJ)/.test(text) &&
      (text.includes('Folio') || /<[0-9a-fA-F]+>\s*Tj/.test(text)))
  );
}

/**
 * Scans a PDF and detects which pages contain the app's vector stamp and folio layers.
 */
export async function detectVectorStampsInPdf(
  sourcePdfBytes: Uint8Array
): Promise<{ pagesWithVectors: number[]; totalPages: number }> {
  try {
    const pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    const pagesWithVectors: number[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const page = pdfDoc.getPage(p - 1);
      const contentsRef = page.node.get(PDFName.of('Contents'));

      if (contentsRef instanceof PDFArray) {
        for (let i = 0; i < contentsRef.size(); i++) {
          const stream = pdfDoc.context.lookup(contentsRef.get(i));
          if (stream) {
            const { text } = decodePdfStreamToString(stream);
            if (isVectorStampStreamContent(text)) {
              pagesWithVectors.push(p);
              break;
            }
          }
        }
      } else if (contentsRef) {
        const stream = pdfDoc.context.lookup(contentsRef);
        if (stream) {
          const { text } = decodePdfStreamToString(stream);
          if (isVectorStampStreamContent(text)) {
            pagesWithVectors.push(p);
          }
        }
      }
    }

    return { pagesWithVectors, totalPages };
  } catch (e) {
    console.warn('Could not scan vector stamps in PDF:', e);
    return { pagesWithVectors: [], totalPages: 0 };
  }
}

/**
 * SURGICALLY REMOVES the vector stamp and folio layers from the specified pages of a PDF.
 * Unlike whiteout patching, this removes the actual vector drawing operators and Form XObject references
 * without drawing any covering rectangles, preserving 100% of the underlying text, lines, and background!
 */
export async function surgicallyRemoveVectorStampsFromPdfPages(
  sourcePdfBytes: Uint8Array,
  pageNumbersToUnstamp: number[], // 1-based page numbers
  onProgress?: (current: number, total: number) => void
): Promise<{ bytes: Uint8Array; removedCount: number }> {
  const pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  const pagesSet = new Set(pageNumbersToUnstamp.filter((p) => p >= 1 && p <= totalPages));
  const pagesList = Array.from(pagesSet).sort((a, b) => a - b);

  let removedCount = 0;
  let processed = 0;

  for (const pageNum of pagesList) {
    const page = pdfDoc.getPage(pageNum - 1);
    const contentsRef = page.node.get(PDFName.of('Contents'));

    if (contentsRef instanceof PDFArray) {
      const keptRefs: any[] = [];
      let pageHadVector = false;

      for (let i = 0; i < contentsRef.size(); i++) {
        const ref = contentsRef.get(i);
        const stream = pdfDoc.context.lookup(ref);
        if (stream) {
          const { text } = decodePdfStreamToString(stream);
          if (isVectorStampStreamContent(text)) {
            pageHadVector = true;
            // Do not keep this stream, surgically omit it!
            continue;
          }
        }
        keptRefs.push(ref);
      }

      if (pageHadVector) {
        page.node.set(PDFName.of('Contents'), pdfDoc.context.obj(keptRefs));
        removedCount++;
      }
    } else if (contentsRef) {
      const stream = pdfDoc.context.lookup(contentsRef);
      if (stream) {
        const { text, compressed } = decodePdfStreamToString(stream);
        // Match q ... /EmbeddedPdfPage... Do ... ET Q
        const regex = /q\s*[\d\.\s\-]+cm\s*(\/EmbeddedPdfPage[^\n\r]*|(\/XObject|\/Fm)[^\n\r]*)Do[\s\S]*?ET\s*Q/g;
        if (regex.test(text)) {
          const cleanedText = text.replace(regex, '');
          encodeStringToPdfStream(stream, cleanedText, compressed);
          removedCount++;
        }
      }
    }

    processed++;
    if (onProgress) {
      onProgress(processed, pagesList.length);
    }
  }

  const bytes = await pdfDoc.save();
  return { bytes, removedCount };
}

