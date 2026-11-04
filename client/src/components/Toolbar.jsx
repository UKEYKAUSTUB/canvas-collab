import { useEffect } from 'react';
import {
  MousePointer2,
  Pencil,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Triangle,
  Eraser,
  Trash2,
} from 'lucide-react';
import socket from '../socket.js';

const COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#a855f7', label: 'Purple' },
];

const SIZES = [
  { value: 4, label: 'S' },
  { value: 10, label: 'M' },
  { value: 22, label: 'L' },
];

const SHAPES = [
  { mode: 'rectangle', icon: Square, label: 'Rectangle (R)' },
  { mode: 'circle', icon: Circle, label: 'Circle (C)' },
  { mode: 'line', icon: Minus, label: 'Line (L)' },
  { mode: 'arrow', icon: ArrowRight, label: 'Arrow (A)' },
  { mode: 'triangle', icon: Triangle, label: 'Triangle' },
];

export default function Toolbar({
  color,
  size,
  mode,
  onColorChange,
  onSizeChange,
  onModeChange,
  roomId,
}) {
  function handleClear() {
    socket.emit('clear-board');
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const target = e.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') onModeChange('select');
      else if (key === 'p') onModeChange('pen');
      else if (key === 't') onModeChange('text');
      else if (key === 'e') onModeChange('eraser');
      else if (key === 'r') onModeChange('rectangle');
      else if (key === 'c') onModeChange('circle');
      else if (key === 'l') onModeChange('line');
      else if (key === 'a') onModeChange('arrow');
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange]);

  return (
    <div
      className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-2.5 z-20 sm:left-4
                 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:translate-y-0 max-sm:top-auto max-sm:bottom-4 max-sm:flex-row max-sm:rounded-2xl max-sm:max-w-[95vw] max-sm:overflow-x-auto max-sm:py-2"
    >
      {/* Color Palette */}
      <div className="grid grid-cols-2 gap-1.5 max-sm:flex max-sm:flex-row items-center justify-center">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => {
              onColorChange(c.value);
              if (mode === 'eraser') onModeChange('pen');
            }}
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none cursor-pointer"
            style={{
              backgroundColor: c.value,
              borderColor: color === c.value && mode !== 'eraser' ? '#6366f1' : 'transparent',
              boxShadow: color === c.value && mode !== 'eraser' ? '0 0 0 2px #6366f1' : 'none',
            }}
          />
        ))}
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto max-sm:self-stretch" />

      {/* Stroke Sizes */}
      <div className="flex flex-row justify-between gap-1 max-sm:flex-row items-center">
        {SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={`Size ${s.label}`}
            onClick={() => onSizeChange(s.value)}
            className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold transition cursor-pointer
              ${
                size === s.value
                  ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto max-sm:self-stretch" />

      {/* Primary Tools: Select/Move, Pen & Text */}
      <div className="flex flex-col gap-1 items-center max-sm:flex-row">
        <button
          type="button"
          title="Select & Move (V)"
          onClick={() => onModeChange('select')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer
            ${
              mode === 'select'
                ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
          <MousePointer2 size={16} />
        </button>

        <button
          type="button"
          title="Pen (P)"
          onClick={() => onModeChange('pen')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer
            ${
              mode === 'pen'
                ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
          <Pencil size={16} />
        </button>

        <button
          type="button"
          title="Text Box (T)"
          onClick={() => onModeChange('text')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer
            ${
              mode === 'text'
                ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
          <Type size={16} />
        </button>
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto max-sm:self-stretch" />

      {/* Shapes Group */}
      <div className="flex flex-col gap-1 items-center max-sm:flex-row">
        {SHAPES.map((shape) => {
          const Icon = shape.icon;
          const isActive = mode === shape.mode;
          return (
            <button
              key={shape.mode}
              type="button"
              title={shape.label}
              onClick={() => onModeChange(shape.mode)}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer
                ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto max-sm:self-stretch" />

      {/* Eraser and Clear Board */}
      <div className="flex flex-col gap-1 items-center max-sm:flex-row">
        <button
          type="button"
          title="Eraser (E)"
          onClick={() => onModeChange('eraser')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer
            ${
              mode === 'eraser'
                ? 'bg-indigo-100 text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
          <Eraser size={16} />
        </button>

        <button
          type="button"
          title="Clear board"
          onClick={handleClear}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition cursor-pointer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
