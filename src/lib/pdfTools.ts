/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Herramientas genéricas de manipulación de PDF: unir, extraer/reordenar
 * páginas, y dividir por rangos. Comparten motor con el resto de la app
 * (pdf-lib para escritura, pdfRenderer.ts + pdfjs-dist para miniaturas).
 */

import { PDFDocument } from 'pdf-lib';

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
