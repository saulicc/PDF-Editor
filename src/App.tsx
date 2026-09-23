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

export type AppView = 'dashboard' | 'stamp' | 'merge' | 'remove' | 'split' | 'reorder';

export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const goToDashboard = () => setView('dashboard');

  if (view === 'stamp') return <StampTool onBack={goToDashboard} />;
  if (view === 'merge') return <MergeTool onBack={goToDashboard} />;
  if (view === 'remove') return <RemovePagesTool onBack={goToDashboard} />;
  if (view === 'split') return <SplitRangesTool onBack={goToDashboard} />;
  if (view === 'reorder') return <ReorderPagesTool onBack={goToDashboard} />;

  return (
    <Dashboard onSelect={setView} themeMode={themeMode} onThemeModeChange={setThemeMode} />
  );
}
