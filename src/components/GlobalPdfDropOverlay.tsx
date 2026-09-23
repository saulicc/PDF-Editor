/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface GlobalPdfDropOverlayProps {
  onFileDrop: (file: File) => void;
  onFilesDrop?: (files: File[]) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Overlay global para detectar drag and drop de archivos PDF en cualquier parte de la ventana / pantalla.
 * Permite al usuario arrastrar un archivo desde el explorador y soltarlo en cualquier sector.
 */
export const GlobalPdfDropOverlay: React.FC<GlobalPdfDropOverlayProps> = ({
  onFileDrop,
  onFilesDrop,
  title = 'Soltá tu archivo PDF en cualquier parte',
  description = 'Se cargará de inmediato para que puedas continuar trabajando sin interrupciones.',
  disabled = false,
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (disabled) return;

    const hasFiles = (e: DragEvent): boolean => {
      if (!e.dataTransfer) return false;
      const types = Array.from(e.dataTransfer.types || []);
      return types.includes('Files');
    };

    const handleDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingFile(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const fileList = Array.from(files);
        if (onFilesDrop) {
          const pdfs = fileList.filter(
            (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
          );
          if (pdfs.length > 0) {
            onFilesDrop(pdfs);
          } else {
            onFilesDrop(fileList);
          }
        } else {
          // Buscar el primer archivo PDF o el primer archivo arrastrado
          let selectedFile: File | null = null;
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
              selectedFile = f;
              break;
            }
          }
          if (!selectedFile && files[0]) {
            selectedFile = files[0];
          }

          if (selectedFile) {
            onFileDrop(selectedFile);
          }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [disabled, onFileDrop]);

  if (!isDraggingFile || disabled) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      aria-hidden="true"
    >
      <div className="w-full max-w-lg border-3 border-dashed border-blue-400 bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-4 transform scale-100 transition-transform">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner animate-bounce">
          <Upload className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            {description}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <FileText className="w-3.5 h-3.5" />
          <span>Soltá acá o en cualquier sector de la pantalla</span>
        </div>
      </div>
    </div>
  );
};
