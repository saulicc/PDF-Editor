/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, PDFPage, rgb, Color, StandardFonts } from 'pdf-lib';

/**
 * Parses HEX, RGB, or named colors into pdf-lib Color (rgb(r, g, b)).
 */
export function parseColor(colorStr: string | null | undefined, defaultColor = rgb(0, 0, 0)): Color {
  if (!colorStr || colorStr === 'none' || colorStr === 'transparent') {
    return defaultColor;
  }
  const clean = colorStr.trim().toLowerCase();

  // Hex 3 or 6 digits
  if (clean.startsWith('#')) {
    const hex = clean.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return rgb(r, g, b);
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return rgb(r, g, b);
    }
  }

  // rgb(r, g, b)
  const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return rgb(
      parseInt(rgbMatch[1], 10) / 255,
      parseInt(rgbMatch[2], 10) / 255,
      parseInt(rgbMatch[3], 10) / 255
    );
  }

  // Common names
  const named: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [1, 1, 1],
    navy: [0, 0, 0.5],
    blue: [0, 0, 1],
    red: [0.8, 0, 0],
    maroon: [0.5, 0, 0],
    gray: [0.5, 0.5, 0.5],
    grey: [0.5, 0.5, 0.5],
    slate: [0.3, 0.35, 0.4],
  };
  if (named[clean]) {
    const [r, g, b] = named[clean];
    return rgb(r, g, b);
  }

  return defaultColor;
}

/**
 * Converts standard geometric SVG elements (<rect>, <circle>, <ellipse>, <line>, <polygon>)
 * into standard SVG path strings so they can be processed vectorially.
 */
export function convertElementToPathD(el: Element): string | null {
  const tagName = el.tagName.toLowerCase();

  if (tagName === 'path') {
    return el.getAttribute('d') || null;
  }

  if (tagName === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    if (w <= 0 || h <= 0) return null;

    if (rx > 0) {
      const r = Math.min(rx, w / 2, h / 2);
      return `M ${x + r} ${y} ` +
        `H ${x + w - r} ` +
        `A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
        `V ${y + h - r} ` +
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
        `H ${x + r} ` +
        `A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
        `V ${y + r} ` +
        `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }

  if (tagName === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    if (r <= 0) return null;
    return `M ${cx - r} ${cy} ` +
      `A ${r} ${r} 0 1 0 ${cx + r} ${cy} ` +
      `A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }

  if (tagName === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx <= 0 || ry <= 0) return null;
    return `M ${cx - rx} ${cy} ` +
      `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} ` +
      `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }

  if (tagName === 'line') {
    const x1 = el.getAttribute('x1') || '0';
    const y1 = el.getAttribute('y1') || '0';
    const x2 = el.getAttribute('x2') || '0';
    const y2 = el.getAttribute('y2') || '0';
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (tagName === 'polygon' || tagName === 'polyline') {
    const pointsStr = el.getAttribute('points') || '';
    const pts = pointsStr.trim().split(/[\s,]+/).map(Number);
    if (pts.length < 4) return null;
    let d = `M ${pts[0]} ${pts[1]}`;
    for (let i = 2; i < pts.length; i += 2) {
      if (!isNaN(pts[i]) && !isNaN(pts[i + 1])) {
        d += ` L ${pts[i]} ${pts[i + 1]}`;
      }
    }
    if (tagName === 'polygon') d += ' Z';
    return d;
  }

  return null;
}

/**
 * Walks up the ancestor chain (as the browser does for inherited SVG presentation
 * attributes) to find a value for `attr`, checking both the attribute and inline style
 * at each level. Returns null if nothing is found up to and including the <svg> root.
 */
function getInheritedAttr(el: Element, attr: string): string | null {
  let current: Element | null = el;
  while (current) {
    const styleVal = (current as any).style?.[attr as any];
    const attrVal = current.getAttribute(attr);
    const val = styleVal || attrVal;
    if (val) return val;
    if (current.tagName.toLowerCase() === 'svg') break;
    current = current.parentElement;
  }
  return null;
}

/**
 * Compiles an SVG into a reusable standalone 1-page PDF document
 * where all vector graphics are drawn. This document can then be embedded
 * as a Form XObject in the target PDF and reused on any number of pages (Requirement 17).
 */
export async function compileSvgToPdfDocument(
  svgString: string,
  targetWidth: number,
  targetHeight: number
): Promise<PDFDocument> {
  const stampDoc = await PDFDocument.create();
  const stampPage = stampDoc.addPage([targetWidth, targetHeight]);

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl) {
    throw new Error('SVG inválido al compilar.');
  }

  // Determine viewBox
  let vx = 0, vy = 0, vw = targetWidth, vh = targetHeight;
  const viewBoxAttr = svgEl.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      [vx, vy, vw, vh] = parts;
    }
  }

  const scaleX = targetWidth / vw;
  const scaleY = targetHeight / vh;
  const scale = Math.min(scaleX, scaleY);

  // We can render all vector paths directly into stampPage
  const vectorElements = svgEl.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline');
  let renderedCount = 0;

  for (let i = 0; i < vectorElements.length; i++) {
    const el = vectorElements[i];
    const pathD = convertElementToPathD(el);
    if (!pathD) continue;

    // Get style or attribute properties, inheriting from ancestor <g>/<svg> elements
    // the same way a browser would (e.g. fill set on a parent <g>, not the path itself).
    const fillAttr = getInheritedAttr(el, 'fill');
    const strokeAttr = getInheritedAttr(el, 'stroke');
    const strokeWidthAttr = getInheritedAttr(el, 'stroke-width');

    const hasStroke = !!strokeAttr && strokeAttr !== 'none' && strokeAttr !== 'transparent';
    // SVG's initial/default fill is black when neither the element nor any ancestor sets it
    // (and a shape isn't explicitly filled "none").
    const hasFill = fillAttr !== 'none' && fillAttr !== 'transparent';

    const fillColor = hasFill
      ? parseColor(fillAttr, rgb(0, 0, 0))
      : undefined;
    const strokeColor = hasStroke ? parseColor(strokeAttr, rgb(0.12, 0.23, 0.37)) : undefined;
    const strokeWidth = strokeWidthAttr ? Math.max(0.5, parseFloat(strokeWidthAttr) * scale) : (hasStroke ? 1 : 0);

    try {
      stampPage.drawSvgPath(pathD, {
        x: -vx * scale,
        y: targetHeight + vy * scale,
        scale: scale,
        color: fillColor,
        borderColor: strokeColor,
        borderWidth: strokeWidth,
      });
      renderedCount++;
    } catch (err) {
      // If a complex or malformed path cannot be parsed by drawSvgPath, continue gracefully
      console.warn('Could not draw vector path with drawSvgPath:', err);
    }
  }

  // Also extract text elements from the SVG if present
  const textElements = svgEl.querySelectorAll('text');
  const fontHelvetica = await stampDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await stampDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await stampDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await stampDoc.embedFont(StandardFonts.TimesRomanBold);

  for (let i = 0; i < textElements.length; i++) {
    const textEl = textElements[i];
    const textContent = textEl.textContent?.trim();
    if (!textContent) continue;

    const rawX = parseFloat(textEl.getAttribute('x') || '0');
    const rawY = parseFloat(textEl.getAttribute('y') || '0');
    const fontSizeAttr = textEl.getAttribute('font-size') || (textEl as any).style?.fontSize || '10';
    const parsedFontSize = Math.max(6, parseFloat(fontSizeAttr) * scale);
    const fill = getInheritedAttr(textEl, 'fill') || '#1e3a5f';
    const color = parseColor(fill, rgb(0.12, 0.23, 0.37));

    const fontFamily = (textEl.getAttribute('font-family') || (textEl as any).style?.fontFamily || '').toLowerCase();
    const fontWeight = (textEl.getAttribute('font-weight') || (textEl as any).style?.fontWeight || '').toLowerCase();
    const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '600';

    let font = isBold ? fontHelveticaBold : fontHelvetica;
    if (fontFamily.includes('serif') || fontFamily.includes('times')) {
      font = isBold ? fontTimesBold : fontTimes;
    }

    const anchor = textEl.getAttribute('text-anchor') || (textEl as any).style?.textAnchor || 'start';
    let textWidth = font.widthOfTextAtSize(textContent, parsedFontSize);
    let drawX = (rawX - vx) * scale;
    if (anchor === 'middle') {
      drawX -= textWidth / 2;
    } else if (anchor === 'end') {
      drawX -= textWidth;
    }

    // In SVG Y is baseline or top; in PDF Y is bottom baseline
    const drawY = targetHeight - ((rawY - vy) * scale);

    try {
      stampPage.drawText(textContent, {
        x: drawX,
        y: drawY,
        size: parsedFontSize,
        font: font,
        color: color,
      });
      renderedCount++;
    } catch (e) {
      console.warn('Could not draw text inside SVG:', e);
    }
  }

  // Fallback: If the SVG had no extractable paths/text or complex filters that weren't parsed,
  // we render via an ultra-high resolution offscreen canvas and embed it so nothing is ever lost.
  if (renderedCount === 0) {
    try {
      const highResCanvas = document.createElement('canvas');
      const dpr = 4; // ultra-crisp 4x print resolution
      highResCanvas.width = targetWidth * dpr;
      highResCanvas.height = targetHeight * dpr;
      const ctx = highResCanvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load SVG into image canvas'));
          };
          img.src = url;
        });

        const pngDataUrl = highResCanvas.toDataURL('image/png');
        const pngBytes = await fetch(pngDataUrl).then(r => r.arrayBuffer());
        const embeddedImage = await stampDoc.embedPng(pngBytes);
        stampPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: targetWidth,
          height: targetHeight,
        });
      }
    } catch (fallbackErr) {
      console.warn('Fallback canvas rasterization also skipped:', fallbackErr);
    }
  }

  return stampDoc;
}
