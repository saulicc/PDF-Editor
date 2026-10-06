/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { ExportProgress } from './pdfExporter';

export interface VectorDetectionResult {
  hasVectorStamp: boolean;
  detectedPages: number[];
  totalPages: number;
  stampXObjectNames: string[];
  details: string;
}

export interface VectorRemovalResult {
  cleanPdfBytes: Uint8Array;
  cleanedPages: number[];
  totalCleaned: number;
  success: boolean;
}

/**
 * Scans a PDF document to detect if any pages contain vector stamps or folio numbers
 * placed by this program or pdf-lib Form XObjects.
 */
export async function detectVectorStampsInPdf(
  pdfBytes: Uint8Array
): Promise<VectorDetectionResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    const detectedPages: number[] = [];
    const allStampXObjNames = new Set<string>();

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.getPage(pageIdx);
      const contents = page.node.Contents();
      if (!contents) continue;

      const res = page.node.Resources();
      const xobjs = res?.get(PDFName.of('XObject'));
      const pageStampXObjs = new Set<string>();

      if (xobjs) {
        const xobjDict = pdfDoc.context.lookup(xobjs) as any;
        if (xobjDict && xobjDict.dict) {
          for (const [key, ref] of xobjDict.dict.entries()) {
            const keyStr = (key as PDFName).asString();
            // Match pdf-lib embedded pages, or known stamp identifiers
            if (
              keyStr.includes('EmbeddedPdfPage') ||
              keyStr.includes('Stamp') ||
              keyStr.includes('Folio') ||
              keyStr.includes('ICC')
            ) {
              pageStampXObjs.add(keyStr);
              allStampXObjNames.add(keyStr);
            } else {
              // Inspect Form XObject stream to see if it is our SVG stamp
              try {
                const stream = pdfDoc.context.lookup(ref) as any;
                if (stream && stream.getContents) {
                  const decoded = decodePDFRawStream(stream).decode();
                  const str = new TextDecoder().decode(decoded);
                  if (
                    str.includes('CULTURA') ||
                    str.includes('CORRIENTES') ||
                    str.includes('instituto') ||
                    str.includes('FOLIO') ||
                    str.includes('464F4C494F')
                  ) {
                    pageStampXObjs.add(keyStr);
                    allStampXObjNames.add(keyStr);
                  }
                }
              } catch {
                // Ignore decoding errors
              }
            }
          }
        }
      }

      // Check contents streams for references to the stamp or folio text
      const isArray = contents instanceof PDFArray;
      const streamCount = isArray ? (contents as PDFArray).size() : 1;
      let hasStampInPage = false;

      for (let sIdx = 0; sIdx < streamCount; sIdx++) {
        const ref = isArray ? (contents as PDFArray).get(sIdx) : contents;
        const stream = pdfDoc.context.lookup(ref) as any;
        if (!stream) continue;

        try {
          const decoded = decodePDFRawStream(stream).decode();
          const str = new TextDecoder().decode(decoded);

          // Check if it calls any detected stamp XObject
          for (const name of pageStampXObjs) {
            if (str.includes(name)) {
              hasStampInPage = true;
              break;
            }
          }

          // Check for generic embedded page calls or folio text (plaintext or hex)
          if (
            str.includes('/EmbeddedPdfPage') ||
            str.includes('464F4C494F') || // 'FOLIO' in hex
            str.includes('466F6C696F') || // 'Folio' in hex
            str.includes('466f6c696f') ||
            str.includes('FOLIO') ||
            str.includes('Folio')
          ) {
            hasStampInPage = true;
          }
        } catch {
          // Ignore decoding errors
        }
      }

      if (hasStampInPage || pageStampXObjs.size > 0) {
        detectedPages.push(pageIdx + 1);
      }
    }

    return {
      hasVectorStamp: detectedPages.length > 0,
      detectedPages,
      totalPages,
      stampXObjectNames: Array.from(allStampXObjNames),
      details:
        detectedPages.length > 0
          ? `Se detectó estructura vectorial de sello/folio en ${detectedPages.length} ${
              detectedPages.length === 1 ? 'página' : 'páginas'
            }`
          : 'No se detectaron sellos vectoriales previos en el documento.',
    };
  } catch (err) {
    console.warn('Error during vector stamp detection:', err);
    return {
      hasVectorStamp: false,
      detectedPages: [],
      totalPages: 0,
      stampXObjectNames: [],
      details: 'No se pudo analizar la estructura interna del PDF.',
    };
  }
}

/**
 * Removes vector stamps and folio numbers from the specified pages of a PDF,
 * WITHOUT using whiteout boxes or erasing underlying document elements.
 *
 * It removes:
 * 1. The dedicated content streams containing the Form XObject draw calls and folio vector text.
 * 2. The enclosing graphics state wrapper streams (`q` and `Q`) added by pdf-lib.
 * 3. The Form XObject references in Resources.XObject.
 *
 * Result: Pristine original document text, lines, tables, and signatures are completely preserved.
 */
export async function removeVectorStampsFromPdf(
  sourcePdfBytes: Uint8Array,
  targetPageNumbers?: number[],
  onProgress?: (p: ExportProgress) => void
): Promise<VectorRemovalResult> {
  onProgress?.({
    currentPage: 0,
    totalPages: 0,
    percent: 10,
    status: 'Analizando estructura vectorial del PDF...',
  });

  const pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  // If no specific pages provided, clean all pages
  const pagesToCleanSet = targetPageNumbers && targetPageNumbers.length > 0
    ? new Set(targetPageNumbers)
    : new Set(Array.from({ length: totalPages }, (_, i) => i + 1));

  const cleanedPages: number[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    if (!pagesToCleanSet.has(pageNum)) continue;

    const page = pdfDoc.getPage(pageIdx);
    const contents = page.node.Contents();
    if (!contents) continue;

    // 1. Identify stamp XObjects in page resources
    const res = page.node.Resources();
    const xobjs = res?.get(PDFName.of('XObject'));
    const stampXObjKeys: PDFName[] = [];
    const stampXObjNames = new Set<string>();

    if (xobjs) {
      const xobjDict = pdfDoc.context.lookup(xobjs) as any;
      if (xobjDict && xobjDict.dict) {
        for (const [key, ref] of xobjDict.dict.entries()) {
          const keyStr = (key as PDFName).asString();
          let isStampXObj =
            keyStr.includes('EmbeddedPdfPage') ||
            keyStr.includes('Stamp') ||
            keyStr.includes('Folio') ||
            keyStr.includes('ICC');

          if (!isStampXObj) {
            try {
              const stream = pdfDoc.context.lookup(ref) as any;
              if (stream && stream.getContents) {
                const decoded = decodePDFRawStream(stream).decode();
                const str = new TextDecoder().decode(decoded);
                if (
                  str.includes('CULTURA') ||
                  str.includes('CORRIENTES') ||
                  str.includes('instituto') ||
                  str.includes('FOLIO') ||
                  str.includes('464F4C494F')
                ) {
                  isStampXObj = true;
                }
              }
            } catch {
              // Ignore
            }
          }

          if (isStampXObj) {
            stampXObjKeys.push(key as PDFName);
            stampXObjNames.add(keyStr);
          }
        }
      }
    }

    let pageWasModified = false;

    // 2. Inspect streams in Contents
    if (contents instanceof PDFArray) {
      const contentsArray = contents as PDFArray;
      const streamCount = contentsArray.size();
      const isStampStream: boolean[] = [];
      const isQStart: boolean[] = [];
      const isQEnd: boolean[] = [];

      for (let i = 0; i < streamCount; i++) {
        const ref = contentsArray.get(i);
        const s = pdfDoc.context.lookup(ref) as any;
        if (!s) {
          isStampStream.push(false);
          isQStart.push(false);
          isQEnd.push(false);
          continue;
        }

        try {
          const decoded = decodePDFRawStream(s).decode();
          const str = new TextDecoder().decode(decoded).trim();

          const hasStampCall =
            Array.from(stampXObjNames).some((name) => str.includes(name)) ||
            str.includes('/EmbeddedPdfPage');

          const hasFolioText =
            str.includes('464F4C494F') || // 'FOLIO' hex
            str.includes('466F6C696F') || // 'Folio' hex
            str.includes('466f6c696f') ||
            str.includes('FOLIO') ||
            str.includes('Folio');

          isStampStream.push(hasStampCall || hasFolioText);
          isQStart.push(str === 'q');
          isQEnd.push(str === 'Q');
        } catch {
          isStampStream.push(false);
          isQStart.push(false);
          isQEnd.push(false);
        }
      }

      let hasAnyStamp = isStampStream.some(Boolean);

      // Fallback: if stampXObjKeys was detected and the last stream was added after a Q wrapper
      if (!hasAnyStamp && stampXObjKeys.length > 0 && streamCount >= 3) {
        isStampStream[streamCount - 1] = true;
        hasAnyStamp = true;
      }

      // If stamp streams were detected, strip them
      if (hasAnyStamp) {
        pageWasModified = true;
        const keptRefs: any[] = [];
        let skipStartQ = false;
        let skipEndQIndex = -1;

        const firstStampIdx = isStampStream.indexOf(true);
        if (firstStampIdx > 0 && isQEnd[firstStampIdx - 1]) {
          skipEndQIndex = firstStampIdx - 1;
          if (isQStart[0]) {
            skipStartQ = true;
          }
        }

        for (let i = 0; i < streamCount; i++) {
          if (isStampStream[i]) continue;
          if (i === 0 && skipStartQ) continue;
          if (i === skipEndQIndex) continue;
          keptRefs.push(contentsArray.get(i));
        }

        if (keptRefs.length === 1) {
          page.node.set(PDFName.of('Contents'), keptRefs[0]);
        } else if (keptRefs.length > 1) {
          page.node.set(PDFName.of('Contents'), pdfDoc.context.obj(keptRefs));
        } else {
          const emptyStream = pdfDoc.context.flateStream('');
          page.node.set(PDFName.of('Contents'), pdfDoc.context.register(emptyStream));
        }
      }
    } else {
      // Single content stream
      const s = pdfDoc.context.lookup(contents) as any;
      if (s) {
        try {
          const decoded = decodePDFRawStream(s).decode();
          let str = new TextDecoder().decode(decoded);

          const hasStamp =
            Array.from(stampXObjNames).some((name) => str.includes(name)) ||
            str.includes('/EmbeddedPdfPage') ||
            str.includes('464F4C494F') ||
            str.includes('FOLIO');

          if (hasStamp) {
            pageWasModified = true;
            // Cleanly remove the stamp XObject invocation: q ... /EmbeddedPdfPage-... Do Q
            str = str.replace(/q[\s\S]*?\/EmbeddedPdfPage[^\s]+\s+Do[\s\S]*?Q/g, '');
            for (const name of stampXObjNames) {
              const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              str = str.replace(new RegExp(`q[\\s\\S]*?${esc}\\s+Do[\\s\\S]*?Q`, 'g'), '');
            }
            // Cleanly remove any trailing folio vector text block: q BT ... ET Q
            str = str.replace(/q\s*BT[\s\S]*?(?:464F4C494F|466F6C696F|466f6c696f|FOLIO|Folio)[\s\S]*?ET\s*Q/g, '');

            const newStream = pdfDoc.context.flateStream(str);
            const newRef = pdfDoc.context.register(newStream);
            page.node.set(PDFName.of('Contents'), newRef);
          }
        } catch {
          // Leave intact on error
        }
      }
    }

    // 3. Remove stamp XObjects from page resources
    if (xobjs && stampXObjKeys.length > 0) {
      const xobjDict = pdfDoc.context.lookup(xobjs) as any;
      if (xobjDict) {
        for (const key of stampXObjKeys) {
          xobjDict.delete(key);
        }
      }
    }

    if (pageWasModified || stampXObjKeys.length > 0) {
      cleanedPages.push(pageNum);
    }

    const percent = Math.round(15 + ((pageIdx + 1) / totalPages) * 75);
    onProgress?.({
      currentPage: pageIdx + 1,
      totalPages,
      percent,
      status: `Removiendo vector en página ${pageNum}...`,
    });
  }

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    percent: 95,
    status: 'Guardando PDF limpio...',
  });

  const cleanPdfBytes = await pdfDoc.save();

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    percent: 100,
    status: '¡Vector de sello y folio removido con éxito!',
  });

  return {
    cleanPdfBytes,
    cleanedPages,
    totalCleaned: cleanedPages.length,
    success: cleanedPages.length > 0,
  };
}
