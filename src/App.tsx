/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import StampTool from './components/StampTool';
import MergeTool from './components/MergeTool';
import RemovePagesTool from './components/RemovePagesTool';
import SplitRangesTool from './components/SplitRangesTool';
import ReorderPagesTool from './components/ReorderPagesTool';
import { useTheme } from './lib/useTheme';
import { GlobalPdfDropOverlay } from './components/GlobalPdfDropOverlay';

export type AppView = 'dashboard' | 'stamp' | 'merge' | 'remove' | 'split' | 'reorder';

export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [stampInitialFile, setStampInitialFile] = useState<File | null>(null);
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const goToDashboard = () => {
    setStampInitialFile(null);
    setView('dashboard');
  };

  const handleGlobalDashboardDrop = (file: File) => {
    setStampInitialFile(file);
    setView('stamp');
  };

  if (view === 'stamp') return <StampTool onBack={goToDashboard} initialFile={stampInitialFile} />;
  if (view === 'merge') return <MergeTool onBack={goToDashboard} />;
  if (view === 'remove') return <RemovePagesTool onBack={goToDashboard} />;
  if (view === 'split') return <SplitRangesTool onBack={goToDashboard} />;
  if (view === 'reorder') return <ReorderPagesTool onBack={goToDashboard} />;

  return (
    <>
      <GlobalPdfDropOverlay
        onFileDrop={handleGlobalDashboardDrop}
        title="Soltá tu archivo PDF en cualquier parte"
        description="Se abrirá automáticamente en la herramienta de sellar y foliar."
      />
      <Dashboard onSelect={setView} themeMode={themeMode} onThemeModeChange={setThemeMode} />
    </>
  );
}
