/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Stamp, Combine, ListX, Scissors, ArrowUpDown, Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '../lib/useTheme';
import type { AppView } from '../App';

interface DashboardProps {
  onSelect: (view: AppView) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Claro', Icon: Sun },
  { mode: 'dark', label: 'Oscuro', Icon: Moon },
  { mode: 'system', label: 'Sistema', Icon: Monitor },
];

const TOOLS: {
  view: AppView;
  title: string;
  description: string;
  Icon: typeof Stamp;
  color: string;
}[] = [
  {
    view: 'stamp',
    title: 'Sellar y Foliar',
    description: 'Estampá el sello oficial y numerá las fojas de un expediente en PDF.',
    Icon: Stamp,
    color: 'bg-blue-600',
  },
  {
    view: 'merge',
    title: 'Unir PDF',
    description: 'Combiná varios archivos PDF en uno solo, en el orden que los subas.',
    Icon: Combine,
    color: 'bg-emerald-600',
  },
  {
    view: 'remove',
    title: 'Eliminar Páginas',
    description: 'Mirá miniaturas de todas las hojas y sacá fácil las que no querés.',
    Icon: ListX,
    color: 'bg-rose-600',
  },
  {
    view: 'split',
    title: 'Dividir PDF',
    description: 'Separá un PDF en varios archivos definiendo rangos de páginas.',
    Icon: Scissors,
    color: 'bg-amber-600',
  },
  {
    view: 'reorder',
    title: 'Ordenar Páginas',
    description: 'Reacomodá el orden de las hojas de un PDF arrastrando miniaturas.',
    Icon: ArrowUpDown,
    color: 'bg-violet-600',
  },
];

export default function Dashboard({ onSelect, themeMode, onThemeModeChange }: DashboardProps) {
  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-start justify-between mb-8 gap-3">
          <div>
            <h1 className="font-bold text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
              Herramientas PDF
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Instituto de Cultura de Corrientes — elegí qué querés hacer
            </p>
          </div>

          <div
            role="group"
            aria-label="Elegir tema"
            className="flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0 shadow-sm"
          >
            {THEME_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                title={label}
                aria-label={`Tema ${label}`}
                aria-pressed={themeMode === mode}
                onClick={() => onThemeModeChange(mode)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  themeMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-100 hover:dark:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOOLS.map(({ view, title, description, Icon, color }) => (
            <button
              key={view}
              type="button"
              id={`dashboard-tool-${view}`}
              onClick={() => onSelect(view)}
              className="text-left p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
            >
              <div
                className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-white shadow-sm mb-3 group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
