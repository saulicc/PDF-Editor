/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import institutoCulturaSvg from '../assets/instituto_cultura_corrientes_vector(1).svg?raw';

export interface PresetStamp {
  id: string;
  name: string;
  category: string;
  description: string;
  svgContent: string;
  defaultWidth: number;
  defaultHeight: number;
  recommendedFolioRelativePosition: {
    x: number;
    y: number;
    fontSize: number;
    textAlign: 'left' | 'center' | 'right';
    color: string;
    defaultFormat: string;
  };
}

/**
 * High-fidelity vector SVG for "Instituto de Cultura de Corrientes"
 * Loaded directly from the local uploaded resource: instituto_cultura_corrientes_vector(1).svg
 */
export const INSTITUTO_CULTURA_CORRIENTES_SVG = institutoCulturaSvg;

/**
 * The ONLY preset stamp available in the application, as specifically requested by the user.
 */
export const PRESET_STAMPS: PresetStamp[] = [
  {
    id: 'instituto-cultura-corrientes',
    name: 'Instituto de Cultura de Corrientes',
    category: 'Oficial Provincial',
    description: 'Sello oficial del Instituto de Cultura de la Provincia de Corrientes con casilla integrada para foliación de expedientes (viewBox 0 0 896 1193).',
    svgContent: INSTITUTO_CULTURA_CORRIENTES_SVG,
    defaultWidth: 50, // 50 pt — valor MEDIO del rango de tamaño (mín 25 / máx 100)
    defaultHeight: 67, // 67 pt — valor MEDIO del rango de tamaño (mín 33.5 / máx 134)
    recommendedFolioRelativePosition: {
      x: 0.50, // Perfectly centered horizontally on the circular seal
      y: 0.51, // Vertically centered directly in the FOLIO N° receptive area
      fontSize: 13.5, // 13.5 pt al tamaño medio (50x67 pt); escala proporcionalmente con el sello
      textAlign: 'center',
      color: '#000000',
      defaultFormat: '{n}',
    },
  },
];

/**
 * Parses any raw SVG string and extracts viewBox, dimensions, and ensures valid XML.
 */
export function parseAndCleanSvg(svgText: string): {
  cleanSvg: string;
  width: number;
  height: number;
  viewBox: { x: number; y: number; width: number; height: number };
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText.trim(), 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl) {
    throw new Error('El archivo no contiene un elemento <svg> válido.');
  }

  // Extract or compute viewBox
  let vx = 0, vy = 0, vw = 300, vh = 200;
  const viewBoxAttr = svgEl.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      [vx, vy, vw, vh] = parts;
    }
  } else {
    // try width & height
    const wAttr = parseFloat(svgEl.getAttribute('width') || '300');
    const hAttr = parseFloat(svgEl.getAttribute('height') || '200');
    vw = isNaN(wAttr) ? 300 : wAttr;
    vh = isNaN(hAttr) ? 200 : hAttr;
    svgEl.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  }

  // Ensure xmlns
  if (!svgEl.getAttribute('xmlns')) {
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const serializer = new XMLSerializer();
  const cleanSvg = serializer.serializeToString(svgEl);

  return {
    cleanSvg,
    width: vw,
    height: vh,
    viewBox: { x: vx, y: vy, width: vw, height: vh },
  };
}
