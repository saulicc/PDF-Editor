/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { renderPdfPageToCanvas } from './pdfRenderer';

/**
 * Renderiza progresivamente miniaturas (JPEG data URL) de todas las páginas
 * de un PDF. Se usa en las pantallas de "Eliminar páginas" y "Ordenar
 * páginas" para mostrar la grilla de hojas chicas.
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

    let cancelled = false;
    setIsLoading(true);
    setThumbnails(new Array(totalPages).fill(''));
    const canvas = document.createElement('canvas');

    (async () => {
      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) return;
        try {
          await renderPdfPageToCanvas(pdfBytes, i, canvas, scale);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (cancelled) return;
          setThumbnails((prev) => {
            const next = prev.slice();
            next[i - 1] = dataUrl;
            return next;
          });
        } catch (_) {
          // Ignore individual page render failures; leave that slot blank
        }
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, totalPages, scale]);

  return { thumbnails, isLoading };
}
