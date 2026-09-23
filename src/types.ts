/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PageRangeType = 'all' | 'custom' | 'odd' | 'even' | 'current';

export type StandardFontName = 
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Times-Roman'
  | 'Times-Roman-Bold'
  | 'Courier'
  | 'Courier-Bold';

export interface RelativeFolioPosition {
  /** Relative horizontal position inside/relative to SVG bounding box: 0 = left edge, 0.5 = center, 1 = right edge */
  x: number;
  /** Relative vertical position inside/relative to SVG bounding box: 0 = top edge, 1 = bottom edge, 1.15 = below stamp */
  y: number;
  /** Base font size in points at scale 1.0 (scales proportionally with the stamp) */
  fontSize: number;
  /** Text alignment relative to the anchor point */
  textAlign: 'left' | 'center' | 'right';
  /** Text color in HEX */
  color: string;
  /** Vector font family */
  fontFamily: StandardFontName;
  /** Whether text is bold */
  isBold?: boolean;
}

export interface FolioConfig {
  /** Initial folio number (e.g. 1, 100) */
  startNumber: number;
  /** Number format template, e.g. "Folio N° {n}", "Folio {n}", "{n}", "Expte. N° {n}" */
  format: string;
  /** Minimum digits with leading zeros: 0 = no padding, 2 = 01, 3 = 001, 4 = 0001 */
  padDigits: number;
  /** Relative position and typography bound permanently inside the StampGroup */
  relativePosition: RelativeFolioPosition;
}

/**
 * StampGroup: The single composite unit uniting the SVG stamp and the Folio number.
 * Conforms to Requirement 14:
 * StampGroup {
 *   svg
 *   folio
 *   relativePosition
 *   scale
 *   rotation
 *   opacity
 * }
 */
export interface StampGroup {
  id: string;
  name: string;
  /** Clean SVG raw string */
  svgRaw: string;
  /** Original SVG viewBox dimensions */
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
  
  /** Base nominal dimension at scale 1.0 (defaults to initial default width/height) */
  baseWidth?: number;
  baseHeight?: number;
  
  /** Placement preset anchor or custom coordinates */
  placementPreset?: 'top-right' | 'top-left' | 'bottom-right' | 'center' | 'custom';
  
  /** Edge anchoring for multi-orientation / multi-size pages */
  anchorHorizontal?: 'left' | 'right' | 'center';
  anchorVertical?: 'top' | 'bottom' | 'center';
  
  /** Distance in points from the physical page edge to the visible stamp border */
  marginRight?: number;
  marginLeft?: number;
  marginTop?: number;
  marginBottom?: number;
  
  /** Current position on the PDF page in PDF points (origin: top-left of page in UI coordinates) */
  x: number;
  y: number;
  /** Current rendered width of the stamp in PDF points */
  width: number;
  /** Current rendered height of the stamp in PDF points */
  height: number;
  /** Scale multiplier */
  scale: number;
  /** Rotation angle in degrees (0 - 360) */
  rotation: number;
  /** Opacity (0.1 - 1.0) */
  opacity: number;
  
  /** Folio settings and its relative position bound to the SVG bounding box */
  folio: FolioConfig;
  
  /** Whether the composition is locked (true = single rigid unit, false = folio calibration mode) */
  isCompositionLocked?: boolean;
}

export interface PageInfo {
  pageNumber: number;
  width: number; // in PDF points (e.g. 595.28 for A4)
  height: number; // in PDF points (e.g. 841.89 for A4)
  rotation?: number;
}

export interface DocumentInfo {
  fileName: string;
  fileSize: number;
  totalPages: number;
  pages: PageInfo[];
  pdfBytes: Uint8Array;
}
