/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { renderPdfPageToCanvas } from './pdfRenderer';

// In-memory cache for thumbnails to avoid recalculating on tab switches
const globalThumbnailCache = new WeakMap<Uint8Array, Map<number, string[]>>();

/**
 * Renderiza progresivamente miniaturas (JPEG data URL) de todas las páginas
 * de un PDF. Se usa en las pantallas de "Eliminar páginas", "Ordenar
 * páginas", "Dividir rangos", etc. para mostrar la grilla de hojas.
 * Funciona de forma transparente tanto con páginas normales como escaneadas.
 */
export function usePdfThumbnails(pdfBytes: Uint8Array | null, totalPages: number, scale = 0.22) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pdfBytes || totalPages === 0) {
      setThumbnails([]);
      setIsLoading(false);
      return;
    }

    // Check if we already have complete cached thumbnails for this exact buffer & scale
    const bufferCache = globalThumbnailCache.get(pdfBytes);
    const cachedList = bufferCache?.get(scale);
    if (cachedList && cachedList.length === totalPages && cachedList.every((url) => Boolean(url))) {
      setThumbnails(cachedList);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const initialThumbnails = new Array(totalPages).fill('');
    setThumbnails(initialThumbnails);

    const canvas = document.createElement('canvas');

    (async () => {
      const generatedList = new Array(totalPages).fill('');

      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) return;
        try {
          const res = await renderPdfPageToCanvas(pdfBytes, i, canvas, scale);
          if (res.width > 0 && res.height > 0) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
            if (cancelled) return;
            generatedList[i - 1] = dataUrl;
            setThumbnails((prev) => {
              const next = prev.slice();
              next[i - 1] = dataUrl;
              return next;
            });
          }
        } catch (pageErr) {
          console.warn(`[Thumbnails] Could not render thumbnail for page ${i}:`, pageErr);
        }
      }

      if (!cancelled) {
        setIsLoading(false);
        // Save to cache once fully processed
        if (!globalThumbnailCache.has(pdfBytes)) {
          globalThumbnailCache.set(pdfBytes, new Map());
        }
        globalThumbnailCache.get(pdfBytes)!.set(scale, generatedList);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, totalPages, scale]);

  return { thumbnails, isLoading };
}
