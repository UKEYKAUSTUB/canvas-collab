import { Pencil, Eraser, Trash2 } from 'lucide-react';
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

export default function Toolbar({ color, size, mode, onColorChange, onSizeChange, onModeChange, roomId }) {
  function handleClear() {
    socket.emit('clear-board');
  }

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-20 sm:left-4
                    max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:translate-y-0 max-sm:top-auto max-sm:bottom-4 max-sm:flex-row max-sm:rounded-2xl">

      <div className="flex flex-col gap-1.5 max-sm:flex-row">
        {COLORS.map((c) => (
          <button
            key={c.value}
            title={c.label}
            onClick={() => { onColorChange(c.value); onModeChange('pen'); }}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: c.value,
              borderColor: color === c.value && mode === 'pen' ? '#6366f1' : 'transparent',
              boxShadow: color === c.value && mode === 'pen' ? '0 0 0 2px #6366f1' : 'none',
            }}
          />
        ))}
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto" />

      <div className="flex flex-col gap-1.5 items-center max-sm:flex-row">
        {SIZES.map((s) => (
          <button
            key={s.value}
            title={`Size ${s.label}`}
            onClick={() => onSizeChange(s.value)}
            className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold transition
              ${size === s.value ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="w-full h-px bg-gray-100 max-sm:w-px max-sm:h-auto" />

      <div className="flex flex-col gap-1.5 items-center max-sm:flex-row">
        <button
          title="Pen"
          onClick={() => onModeChange('pen')}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition
            ${mode === 'pen' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
        >
          <Pencil size={18} />
        </button>

        <button
          title="Eraser"
          onClick={() => onModeChange('eraser')}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition
            ${mode === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
        >
          <Eraser size={18} />
        </button>

        <button
          title="Clear board"
          onClick={handleClear}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
