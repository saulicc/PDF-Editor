/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { renderPdfPageToCanvas } from './pdfRenderer';

// In-memory cache for thumbnails to avoid recalculating on tab switches
const globalThumbnailCache = new WeakMap<Uint8Array, Map<string, string>>();

export interface UsePdfThumbnailsOptions {
  enabled?: boolean;
  targetPages?: number[];
}

/**
 * Renderiza progresivamente miniaturas (JPEG data URL) de páginas de un PDF.
 * Soporta modo bajo demanda (targetPages) y desactivación manual (enabled: false)
 * para documentos de gran volumen (10.000+ páginas) evitando colapsar la RAM.
 */
export function usePdfThumbnails(
  pdfBytes: Uint8Array | null,
  totalPages: number,
  scale = 0.22,
  options?: UsePdfThumbnailsOptions
) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbnailMap, setThumbnailMap] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEnabled = options?.enabled !== false;
  const targetPagesKey = options?.targetPages?.sort((a, b) => a - b).join(',') ?? 'all';

  useEffect(() => {
    if (!pdfBytes || totalPages === 0 || !isEnabled) {
      setThumbnails([]);
      setThumbnailMap({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const canvas = document.createElement('canvas');
    const pagesToRender: number[] = options?.targetPages && options.targetPages.length > 0
      ? Array.from(new Set(options.targetPages.filter((p) => p >= 1 && p <= totalPages)))
      : Array.from({ length: Math.min(totalPages, 150) }, (_, i) => i + 1);

    // Get cache bucket for this pdfBytes
    let bufferCache = globalThumbnailCache.get(pdfBytes);
    if (!bufferCache) {
      bufferCache = new Map<string, string>();
      globalThumbnailCache.set(pdfBytes, bufferCache);
    }

    (async () => {
      const nextMap: Record<number, string> = {};

      for (const p of pagesToRender) {
        if (cancelled) return;
        const cacheKey = `${scale}_${p}`;
        const cached = bufferCache.get(cacheKey);

        if (cached) {
          nextMap[p] = cached;
          setThumbnailMap((prev) => ({ ...prev, [p]: cached }));
          setThumbnails((prev) => {
            const next = prev.length >= totalPages ? prev.slice() : new Array(totalPages).fill('');
            next[p - 1] = cached;
            return next;
          });
          continue;
        }

        try {
          const res = await renderPdfPageToCanvas(pdfBytes, p, canvas, scale);
          if (res.width > 0 && res.height > 0) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
            if (cancelled) return;
            bufferCache.set(cacheKey, dataUrl);
            nextMap[p] = dataUrl;
            setThumbnailMap((prev) => ({ ...prev, [p]: dataUrl }));
            setThumbnails((prev) => {
              const next = prev.length >= totalPages ? prev.slice() : new Array(totalPages).fill('');
              next[p - 1] = dataUrl;
              return next;
            });
          }
        } catch (pageErr) {
          console.warn(`[Thumbnails] Could not render thumbnail for page ${p}:`, pageErr);
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, totalPages, scale, isEnabled, targetPagesKey]);

  return { thumbnails, thumbnailMap, isLoading };
}
