/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { StampGroup, PageRangeType } from '../types';
import { compileSvgToPdfDocument, parseColor } from './svgToPdfVector';

export interface ExportProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
  status: string;
}

/**
 * Parses user page range strings like "1-5, 8, 11-20" or standard presets.
 */
export function getPagesToStamp(
  rangeType: PageRangeType,
  customRangeStr: string,
  totalPages: number,
  currentPage: number
): number[] {
  if (rangeType === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (rangeType === 'current') {
    return [currentPage];
  }
  if (rangeType === 'odd') {
    const list: number[] = [];
    for (let i = 1; i <= totalPages; i += 2) list.push(i);
    return list;
  }
  if (rangeType === 'even') {
    const list: number[] = [];
    for (let i = 2; i <= totalPages; i += 2) list.push(i);
    return list;
  }
  if (rangeType === 'custom') {
    const pages = new Set<number>();
    const tokens = customRangeStr.split(/[,;\s]+/);
    for (const token of tokens) {
      if (!token.trim()) continue;
      if (token.includes('-')) {
        const [startStr, endStr] = token.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(totalPages, Math.max(start, end));
          for (let p = from; p <= to; p++) pages.add(p);
        }
      } else {
        const single = parseInt(token, 10);
        if (!isNaN(single) && single >= 1 && single <= totalPages) {
          pages.add(single);
        }
      }
    }
    const result = Array.from(pages).sort((a, b) => a - b);
    return result.length > 0 ? result : [1];
  }
  return [1];
}

/**
 * Formats a folio number according to template, padding, and total pages.
 */
export function formatFolioText(
  formatTemplate: string,
  numberValue: number,
  padDigits: number,
  totalPages: number
): string {
  let numStr = numberValue.toString();
  if (padDigits > 1) {
    numStr = numStr.padStart(padDigits, '0');
  }
  return formatTemplate
    .replace(/\{n\}/g, numStr)
    .replace(/\{total\}/g, totalPages.toString());
}

/**
 * Calculates the exact stamp coordinates (top-left in visual page coordinates)
 * strictly referenced against the physical borders of the specified page.
 *
 * Requirements:
 * - 3 pt measured from the VISIBLE EXTERIOR BORDER of the stamp to the PHYSICAL PAGE EDGE.
 * - The SVG viewBox is 896 x 1193 with visible outer border at left=12, top=12, right=884, bottom=1181.
 * - visibleInsetLeft   = stampWidth  * (12 / 896)
 * - visibleInsetRight  = stampWidth  * (12 / 896)
 * - visibleInsetTop    = stampHeight * (12 / 1193)
 * - visibleInsetBottom = stampHeight * (12 / 1193)
 *
 * For TOP-RIGHT:
 * - visibleTop   = 3 pt => y = 3 - visibleInsetTop
 * - visibleRight = pageWidth - 3 pt => x = pageWidth - stampWidth - 3 + visibleInsetRight
 */
export function getPageStampCoordinates(
  stampGroup: StampGroup,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  const margin = 3; // EXACT 3 pt margin from the physical edge of the page to the visible border
  const preset = stampGroup.placementPreset || 'top-right';

  const visibleInsetLeft = stampGroup.width * (12 / 896);
  const visibleInsetRight = stampGroup.width * (12 / 896);
  const visibleInsetTop = stampGroup.height * (12 / 1193);
  const visibleInsetBottom = stampGroup.height * (12 / 1193);

  switch (preset) {
    case 'top-right': {
      const mRight = stampGroup.marginRight ?? margin;
      const mTop = stampGroup.marginTop ?? margin;
      return {
        x: Math.round((pageWidth - stampGroup.width - mRight + visibleInsetRight) * 100) / 100,
        y: Math.round((mTop - visibleInsetTop) * 100) / 100,
      };
    }
    case 'top-left': {
      const mLeft = stampGroup.marginLeft ?? margin;
      const mTop = stampGroup.marginTop ?? margin;
      return {
        x: Math.round((mLeft - visibleInsetLeft) * 100) / 100,
        y: Math.round((mTop - visibleInsetTop) * 100) / 100,
      };
    }
    case 'bottom-right': {
      const mRight = stampGroup.marginRight ?? margin;
      const mBottom = stampGroup.marginBottom ?? margin;
      return {
        x: Math.round((pageWidth - stampGroup.width - mRight + visibleInsetRight) * 100) / 100,
        y: Math.round((pageHeight - stampGroup.height - mBottom + visibleInsetBottom) * 100) / 100,
      };
    }
    case 'center':
      return {
        x: Math.round(((pageWidth - stampGroup.width) / 2) * 100) / 100,
        y: Math.round(((pageHeight - stampGroup.height) / 2) * 100) / 100,
      };
    case 'custom':
    default: {
      // Relative anchoring to ensure that adjusting position maintains the exact distance
      // to the page edges across different page orientations (vertical/horizontal) and sizes
      const anchorH = stampGroup.anchorHorizontal || (stampGroup.marginRight !== undefined ? 'right' : 'right');
      const anchorV = stampGroup.anchorVertical || (stampGroup.marginBottom !== undefined ? 'bottom' : 'top');

      let x: number;
      if (anchorH === 'right') {
        const mRight = stampGroup.marginRight ?? margin;
        x = pageWidth - stampGroup.width - mRight + visibleInsetRight;
      } else if (anchorH === 'left') {
        const mLeft = stampGroup.marginLeft ?? margin;
        x = mLeft - visibleInsetLeft;
      } else {
        x = (pageWidth - stampGroup.width) / 2;
      }

      let y: number;
      if (anchorV === 'bottom') {
        const mBottom = stampGroup.marginBottom ?? margin;
        y = pageHeight - stampGroup.height - mBottom + visibleInsetBottom;
      } else if (anchorV === 'center') {
        y = (pageHeight - stampGroup.height) / 2;
      } else {
        const mTop = stampGroup.marginTop ?? margin;
        y = mTop - visibleInsetTop;
      }

      return {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      };
    }
  }
}

/**
 * Executes the stamping process on the PDF:
 * - Compiles the SVG stamp ONCE into a shared Form XObject.
 * - Draws the shared XObject onto every selected page.
 * - Draws the Folio number as pure VECTOR text on every page.
 */
export async function stampAndExportPdf(
  sourcePdfBytes: Uint8Array,
  stampGroup: StampGroup,
  rangeType: PageRangeType,
  customRangeStr: string,
  currentPageIndex: number,
  onProgress?: (p: ExportProgress) => void
): Promise<Uint8Array> {
  onProgress?.({
    currentPage: 0,
    totalPages: 0,
    percent: 10,
    status: 'Cargando documento PDF...',
  });

  const pdfDoc = await PDFDocument.load(sourcePdfBytes);
  const totalPages = pdfDoc.getPageCount();

  const pagesToStamp = getPagesToStamp(rangeType, customRangeStr, totalPages, currentPageIndex + 1);

  onProgress?.({
    currentPage: 0,
    totalPages: pagesToStamp.length,
    percent: 20,
    status: 'Compilando sello SVG vectorial y generando Form XObject...',
  });

  // 1. Compile SVG into standalone PDF document to create the shared Form XObject (Requirement 17)
  const stampDoc = await compileSvgToPdfDocument(
    stampGroup.svgRaw,
    stampGroup.width,
    stampGroup.height
  );

  // 2. Embed this graphic object ONCE in the target document
  const [embeddedStamp] = await pdfDoc.embedPdf(stampDoc, [0]);

  // 3. Embed vector font for the folio text (Requirement 12)
  let standardFontName = StandardFonts.HelveticaBold;
  if (stampGroup.folio.relativePosition.fontFamily === 'Times-Roman') {
    standardFontName = StandardFonts.TimesRoman;
  } else if (stampGroup.folio.relativePosition.fontFamily === 'Times-Roman-Bold') {
    standardFontName = StandardFonts.TimesRomanBold;
  } else if (stampGroup.folio.relativePosition.fontFamily === 'Courier') {
    standardFontName = StandardFonts.Courier;
  } else if (stampGroup.folio.relativePosition.fontFamily === 'Courier-Bold') {
    standardFontName = StandardFonts.CourierBold;
  } else if (stampGroup.folio.relativePosition.fontFamily === 'Helvetica') {
    standardFontName = StandardFonts.Helvetica;
  }

  const vectorFont = await pdfDoc.embedFont(standardFontName);
  const textColor = parseColor(stampGroup.folio.relativePosition.color, rgb(0.12, 0.23, 0.37));

  // Stamp dimensions and rotation
  const stampW = stampGroup.width;
  const stampH = stampGroup.height;
  const uiRotDegrees = (stampGroup.rotation % 360 + 360) % 360;
  // In PDF, angles are counter-clockwise, so clockwise UI angle is negative in standard PDF coords
  const pdfRotDegrees = (360 - uiRotDegrees) % 360;
  const pdfRotRad = (pdfRotDegrees * Math.PI) / 180;

  const relX = stampGroup.folio.relativePosition.x;
  const relY = stampGroup.folio.relativePosition.y;
  const baseFontSize = stampGroup.folio.relativePosition.fontSize;
  // Scaled font size proportionally with the stamp scale factor
  const scaledFontSize = baseFontSize * (stampGroup.scale || 1.0);

  // Offset of the folio anchor point relative to the stamp center in UI coordinates:
  // In UI, top-left of stamp is (0, 0), center is (stampW/2, stampH/2)
  // localX = relX * stampW, localY = relY * stampH
  const uiCenterOffsetX = relX * stampW - stampW / 2;
  const uiCenterOffsetY = relY * stampH - stampH / 2;

  // In PDF coordinate system relative to center:
  // X is the same, Y is negated (since PDF Y is up, UI Y is down)
  const pdfCenterOffsetX = uiCenterOffsetX;
  const pdfCenterOffsetY = -uiCenterOffsetY;

  // Rotated folio offset around stamp center in PDF coordinates
  const rotFolioOffsetX = pdfCenterOffsetX * Math.cos(pdfRotRad) - pdfCenterOffsetY * Math.sin(pdfRotRad);
  const rotFolioOffsetY = pdfCenterOffsetX * Math.sin(pdfRotRad) + pdfCenterOffsetY * Math.cos(pdfRotRad);

  // Rotated bottom-left corner of the stamp bounding box for drawPage:
  // Stamp center relative to bottom-left is (stampW / 2, stampH / 2)
  // Bottom-left relative to center is (-stampW / 2, -stampH / 2)
  const rotCornerX = (-stampW / 2) * Math.cos(pdfRotRad) - (-stampH / 2) * Math.sin(pdfRotRad);
  const rotCornerY = (-stampW / 2) * Math.sin(pdfRotRad) + (-stampH / 2) * Math.cos(pdfRotRad);

  let processedCount = 0;

  for (let idx = 0; idx < pagesToStamp.length; idx++) {
    const pageNum = pagesToStamp[idx];
    const page = pdfDoc.getPage(pageNum - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Calculate real physical page stamp position:
    // Uses the page's own width and height independently for every page
    const { x: pageStampX, y: pageStampY } = getPageStampCoordinates(
      stampGroup,
      pageWidth,
      pageHeight
    );

    // Calculate stamp center in PDF page coordinates:
    const uiCenterX = pageStampX + stampW / 2;
    const uiCenterY = pageStampY + stampH / 2;

    const pdfCenterX = uiCenterX;
    const pdfCenterY = pageHeight - uiCenterY;

    // 1. Draw the shared vector SVG stamp (Form XObject)
    const drawPageX = pdfCenterX + rotCornerX;
    const drawPageY = pdfCenterY + rotCornerY;

    page.drawPage(embeddedStamp, {
      x: drawPageX,
      y: drawPageY,
      width: stampW,
      height: stampH,
      rotate: degrees(pdfRotDegrees),
      opacity: stampGroup.opacity,
    });

    // 2. Format page-specific Folio text:
    // Folio sequence begins at startNumber, incrementing for each stamped page
    const folioVal = stampGroup.folio.startNumber + idx;
    const folioText = formatFolioText(
      stampGroup.folio.format,
      folioVal,
      stampGroup.folio.padDigits,
      totalPages
    );

    // 3. Calculate exact vector text alignment and placement:
    const folioAnchorX = pdfCenterX + rotFolioOffsetX;
    const folioAnchorY = pdfCenterY + rotFolioOffsetY;

    const textWidth = vectorFont.widthOfTextAtSize(folioText, scaledFontSize);
    const textAlign = stampGroup.folio.relativePosition.textAlign;

    // Shift along the text orientation vector according to alignment
    let alignShift = 0;
    if (textAlign === 'center') {
      alignShift = -textWidth / 2;
    } else if (textAlign === 'right') {
      alignShift = -textWidth;
    }

    // Baseline optical vertical centering adjustment (approx 0.35 * fontSize below center)
    const vertShift = -scaledFontSize * 0.35;

    const finalShiftX = alignShift * Math.cos(pdfRotRad) - vertShift * Math.sin(pdfRotRad);
    const finalShiftY = alignShift * Math.sin(pdfRotRad) + vertShift * Math.cos(pdfRotRad);

    // 4. Draw Folio as PURE SELECTABLE VECTOR TEXT in the PDF (Requirement 12)
    page.drawText(folioText, {
      x: folioAnchorX + finalShiftX,
      y: folioAnchorY + finalShiftY,
      size: scaledFontSize,
      font: vectorFont,
      color: textColor,
      rotate: degrees(pdfRotDegrees),
      opacity: stampGroup.opacity,
    });

    processedCount++;
    const percent = Math.round(20 + (processedCount / pagesToStamp.length) * 75);
    onProgress?.({
      currentPage: processedCount,
      totalPages: pagesToStamp.length,
      percent,
      status: `Foliando página ${pageNum} (${folioText})...`,
    });
  }

  onProgress?.({
    currentPage: pagesToStamp.length,
    totalPages: pagesToStamp.length,
    percent: 98,
    status: 'Optimizando estructura vectorial y guardando PDF...',
  });

  const finalPdfBytes = await pdfDoc.save();

  onProgress?.({
    currentPage: pagesToStamp.length,
    totalPages: pagesToStamp.length,
    percent: 100,
    status: '¡Documento foliado con éxito!',
  });

  return finalPdfBytes;
}
