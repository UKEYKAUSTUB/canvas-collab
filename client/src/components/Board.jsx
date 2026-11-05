import { useEffect, useRef, useState, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import socket from '../socket.js';

// SVG cursor generator for visible color cursor
function getCursorStyle(
  mode,
  color,
  size,
  isHoveringMovable,
  isMoving,
  hoverHandleCursor
) {
  if (mode === 'select') {
    if (hoverHandleCursor) return hoverHandleCursor;
    if (isMoving) return 'grabbing';
    if (isHoveringMovable) return 'grab';
    return 'default';
  }

  if (mode === 'eraser') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="10" stroke="%23ffffff" stroke-width="3.5"/>
      <circle cx="13" cy="13" r="10" stroke="%23f43f5e" stroke-width="2" stroke-dasharray="3 2"/>
      <circle cx="13" cy="13" r="3" fill="%23f43f5e"/>
    </svg>`;
    return `url('data:image/svg+xml;utf8,${svg.replace(/\n\s*/g, '')}') 13 13, cell`;
  }

  if (mode === 'text') {
    const encodedColor = encodeURIComponent(color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M6 7V5h16v2M14 5v18M10 23h8" stroke="%23ffffff" stroke-width="4" stroke-linecap="round"/>
      <path d="M6 7V5h16v2M14 5v18M10 23h8" stroke="${encodedColor}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    return `url('data:image/svg+xml;utf8,${svg.replace(/\n\s*/g, '')}') 14 14, text`;
  }

  // Pen and shapes: precision visible reticle in active color with high-contrast white outline
  const encodedColor = encodeURIComponent(color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="8" stroke="%23ffffff" stroke-width="3.5"/>
    <line x1="14" y1="2" x2="14" y2="8" stroke="%23ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="14" y1="20" x2="14" y2="26" stroke="%23ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="2" y1="14" x2="8" y2="14" stroke="%23ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="20" y1="14" x2="26" y2="14" stroke="%23ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="14" cy="14" r="8" stroke="${encodedColor}" stroke-width="1.8"/>
    <line x1="14" y1="3" x2="14" y2="8" stroke="${encodedColor}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="14" y1="20" x2="14" y2="25" stroke="${encodedColor}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="3" y1="14" x2="8" y2="14" stroke="${encodedColor}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="20" y1="14" x2="25" y2="14" stroke="${encodedColor}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="14" cy="14" r="2.5" fill="%23ffffff"/>
    <circle cx="14" cy="14" r="1.8" fill="${encodedColor}"/>
  </svg>`;
  return `url('data:image/svg+xml;utf8,${svg.replace(/\n\s*/g, '')}') 14 14, crosshair`;
}

// Distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Check if a point hits an element
function hitTestElement(el, px, py, width, height) {
  if (!el) return false;

  if (el.type === 'text') {
    const fontSize = Math.max(14, Math.round((el.size || 4) * 2.5 + 8));
    const lineHeight = fontSize * 1.25;
    const lines = (el.text || '').split('\n');
    const x = el.x * width;
    const y = el.y * height;
    const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
    const approxWidth = Math.max(40, maxLineLen * fontSize * 0.62);
    const approxHeight = lines.length * lineHeight;
    return (
      px >= x - 8 &&
      px <= x + approxWidth + 8 &&
      py >= y - 8 &&
      py <= y + approxHeight + 8
    );
  }

  if (el.type === 'rectangle') {
    if (!el.points || el.points.length < 2) return false;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const x0 = p0.x * width;
    const y0 = p0.y * height;
    const x1 = p1.x * width;
    const y1 = p1.y * height;
    const minX = Math.min(x0, x1) - 10;
    const maxX = Math.max(x0, x1) + 10;
    const minY = Math.min(y0, y1) - 10;
    const maxY = Math.max(y0, y1) + 10;
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }

  if (el.type === 'circle') {
    if (!el.points || el.points.length < 2) return false;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const cx = ((p0.x + p1.x) / 2) * width;
    const cy = ((p0.y + p1.y) / 2) * height;
    const rx = Math.max(8, (Math.abs(p1.x - p0.x) / 2) * width) + 10;
    const ry = Math.max(8, (Math.abs(p1.y - p0.y) / 2) * height) + 10;
    return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
  }

  if (el.type === 'line' || el.type === 'arrow') {
    if (!el.points || el.points.length < 2) return false;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const x0 = p0.x * width;
    const y0 = p0.y * height;
    const x1 = p1.x * width;
    const y1 = p1.y * height;
    return distToSegment(px, py, x0, y0, x1, y1) <= Math.max(14, (el.size || 4) + 8);
  }

  if (el.type === 'triangle') {
    if (!el.points || el.points.length < 2) return false;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const topY = Math.min(p0.y, p1.y) * height;
    const botY = Math.max(p0.y, p1.y) * height;
    const leftX = Math.min(p0.x, p1.x) * width;
    const rightX = Math.max(p0.x, p1.x) * width;
    const minX = Math.min(leftX, rightX) - 10;
    const maxX = Math.max(leftX, rightX) + 10;
    const minY = topY - 10;
    const maxY = botY + 10;
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }

  return false;
}

// Get resize handles for an element
function getElementHandles(el, width, height) {
  if (!el) return [];
  const w = width;
  const h = height;

  if (el.type === 'line' || el.type === 'arrow') {
    if (!el.points || el.points.length < 2) return [];
    return [
      { id: 'start', x: el.points[0].x * w, y: el.points[0].y * h, cursor: 'crosshair' },
      { id: 'end', x: el.points[1].x * w, y: el.points[1].y * h, cursor: 'crosshair' },
    ];
  }

  let minX, minY, maxX, maxY;
  if (el.type === 'text') {
    const fontSize = Math.max(14, Math.round((el.size || 4) * 2.5 + 8));
    const lineHeight = fontSize * 1.25;
    const lines = (el.text || '').split('\n');
    const x = el.x * w;
    const y = el.y * h;
    const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
    const approxWidth = Math.max(40, maxLineLen * fontSize * 0.62);
    const approxHeight = lines.length * lineHeight;
    minX = x - 6;
    minY = y - 4;
    maxX = x + approxWidth + 6;
    maxY = y + approxHeight + 4;
  } else if (el.points && el.points.length >= 2) {
    const xs = el.points.map((p) => p.x * w);
    const ys = el.points.map((p) => p.y * h);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  } else {
    return [];
  }

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return [
    { id: 'tl', x: minX, y: minY, cursor: 'nwse-resize' },
    { id: 'tr', x: maxX, y: minY, cursor: 'nesw-resize' },
    { id: 'br', x: maxX, y: maxY, cursor: 'nwse-resize' },
    { id: 'bl', x: minX, y: maxY, cursor: 'nesw-resize' },
    { id: 't', x: midX, y: minY, cursor: 'ns-resize' },
    { id: 'b', x: midX, y: maxY, cursor: 'ns-resize' },
    { id: 'l', x: minX, y: midY, cursor: 'ew-resize' },
    { id: 'r', x: maxX, y: midY, cursor: 'ew-resize' },
  ];
}

// Find handle hit at pixel position
function findHandleAt(handles, px, py) {
  const hitRadius = 10;
  for (const handle of handles) {
    const dist = Math.hypot(handle.x - px, handle.y - py);
    if (dist <= hitRadius) {
      return handle;
    }
  }
  return null;
}

// Draw selection box and resize handles around selected element
function drawSelectionBox(ctx, el) {
  if (!el) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const handles = getElementHandles(el, w, h);
  if (handles.length === 0) return;

  ctx.save();

  if (el.type === 'line' || el.type === 'arrow') {
    // For line and arrow: draw endpoint circle handles
    for (const handle of handles) {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Draw dashed bounding box
  const tl = handles.find((h) => h.id === 'tl');
  const br = handles.find((h) => h.id === 'br');
  if (tl && br) {
    const boxW = br.x - tl.x;
    const boxH = br.y - tl.y;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(tl.x, tl.y, boxW, boxH);
  }

  // Draw square resize handles
  ctx.setLineDash([]);
  const handleSize = 8;
  for (const handle of handles) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  }

  ctx.restore();
}

// Draw any element (stroke, shape, or text)
function drawElement(ctx, el) {
  if (!el) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  if (el.type === 'text') {
    if (!el.text) return;
    const fontSize = Math.max(14, Math.round((el.size || 4) * 2.5 + 8));
    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = el.color || '#000000';
    ctx.textBaseline = 'top';
    const lines = el.text.split('\n');
    const lineHeight = fontSize * 1.25;
    lines.forEach((line, i) => {
      ctx.fillText(line, el.x * w, el.y * h + i * lineHeight);
    });
    ctx.restore();
    return;
  }

  if (el.type === 'rectangle') {
    if (!el.points || el.points.length < 2) return;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const x = Math.min(p0.x, p1.x) * w;
    const y = Math.min(p0.y, p1.y) * h;
    const width = Math.abs(p1.x - p0.x) * w;
    const height = Math.abs(p1.y - p0.y) * h;
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 4);
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();
    return;
  }

  if (el.type === 'circle') {
    if (!el.points || el.points.length < 2) return;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const cx = ((p0.x + p1.x) / 2) * w;
    const cy = ((p0.y + p1.y) / 2) * h;
    const rx = Math.max(1, (Math.abs(p1.x - p0.x) / 2) * w);
    const ry = Math.max(1, (Math.abs(p1.y - p0.y) / 2) * h);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.type === 'line') {
    if (!el.points || el.points.length < 2) return;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.moveTo(p0.x * w, p0.y * h);
    ctx.lineTo(p1.x * w, p1.y * h);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.type === 'arrow') {
    if (!el.points || el.points.length < 2) return;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const fromX = p0.x * w;
    const fromY = p0.y * h;
    const toX = p1.x * w;
    const toY = p1.y * h;
    const headLength = Math.max(12, el.size * 2.8);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.fillStyle = el.color;
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (el.type === 'triangle') {
    if (!el.points || el.points.length < 2) return;
    const p0 = el.points[0];
    const p1 = el.points[el.points.length - 1];
    const topX = ((p0.x + p1.x) / 2) * w;
    const topY = Math.min(p0.y, p1.y) * h;
    const botY = Math.max(p0.y, p1.y) * h;
    const leftX = Math.min(p0.x, p1.x) * w;
    const rightX = Math.max(p0.x, p1.x) * w;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, botY);
    ctx.lineTo(leftX, botY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Default: freehand stroke
  if (!el.points || el.points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(el.points[0].x * w, el.points[0].y * h);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x * w, el.points[i].y * h);
  }
  ctx.stroke();
  ctx.restore();
}

function redrawAll(ctx, strokes, selectedId = null) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  let selectedElement = null;
  for (const stroke of strokes) {
    drawElement(ctx, stroke);
    if (selectedId && stroke.id === selectedId) {
      selectedElement = stroke;
    }
  }
  if (selectedElement) {
    drawSelectionBox(ctx, selectedElement);
  }
}

export default function Board({ color, size, mode, roomId, initialStrokes, userName }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef(
    initialStrokes
      ? initialStrokes.map((s) => ({
          ...s,
          id: s.id || `el-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          points: s.points ? s.points.map((p) => ({ ...p })) : undefined,
        }))
      : []
  );

  const isDrawingRef = useRef(false);
  const pendingPointsRef = useRef([]);
  const rafRef = useRef(null);
  const remoteStrokeRef = useRef(null);
  const lastLocalPointRef = useRef(null);

  // Shape drag preview ref
  const dragStartRef = useRef(null);
  const previewShapeRef = useRef(null);

  // Local hover cursor position for visible brush ring indicator
  const [hoverCursor, setHoverCursor] = useState(null);

  // Active textbox state
  const [editingText, setEditingText] = useState(null);
  const textareaRef = useRef(null);

  // Collaborative remote cursors
  const [remoteCursors, setRemoteCursors] = useState({});
  const lastCursorEmitRef = useRef(0);

  // Move / Select tool state
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdRef = useRef(null);
  const isMovingRef = useRef(false);
  const dragMoveStartRef = useRef(null);
  const initialElementCoordsRef = useRef(null);
  const [isHoveringMovable, setIsHoveringMovable] = useState(false);

  // Resizing state
  const isResizingRef = useRef(false);
  const activeHandleRef = useRef(null);
  const resizeSnapRef = useRef(null);
  const [hoverHandleCursor, setHoverHandleCursor] = useState(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext('2d');
    redrawAll(ctx, strokesRef.current, selectedIdRef.current);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Focus textarea when editingText becomes active
  useEffect(() => {
    if (editingText && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingText]);

  // Clear selection if mode changes away from 'select'
  useEffect(() => {
    if (mode !== 'select' && selectedIdRef.current) {
      setSelectedId(null);
      selectedIdRef.current = null;
      setHoverHandleCursor(null);
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current, null);
    }
  }, [mode, getCtx]);

  // Delete selected element with Delete or Backspace key
  useEffect(() => {
    function handleKeyDown(e) {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        const idToDelete = selectedIdRef.current;
        strokesRef.current = strokesRef.current.filter((s) => s.id !== idToDelete);
        setSelectedId(null);
        selectedIdRef.current = null;
        setHoverHandleCursor(null);
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, strokesRef.current, null);
        socket.emit('delete-element', { id: idToDelete });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getCtx]);

  // Socket event listeners
  useEffect(() => {
    function onRoomState({ strokes, userCount }) {
      strokesRef.current = strokes.map((s) => ({
        ...s,
        id: s.id || `el-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        points: s.points ? s.points.map((p) => ({ ...p })) : undefined,
      }));
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current, selectedIdRef.current);
    }

    function onRemoteStrokeStart({ color: c, size: s }) {
      remoteStrokeRef.current = {
        id: `remote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        color: c,
        size: s,
        points: [],
      };
      strokesRef.current.push(remoteStrokeRef.current);
    }

    function onRemoteStrokePoints({ points }) {
      if (!remoteStrokeRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const existing = remoteStrokeRef.current.points;
      const newPoints = points;

      ctx.beginPath();
      ctx.strokeStyle = remoteStrokeRef.current.color;
      ctx.lineWidth = remoteStrokeRef.current.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const startPoint =
        existing.length > 0 ? existing[existing.length - 1] : newPoints[0];
      ctx.moveTo(startPoint.x * w, startPoint.y * h);

      for (const pt of newPoints) {
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();

      remoteStrokeRef.current.points.push(...newPoints);
    }

    function onRemoteStrokeEnd() {
      remoteStrokeRef.current = null;
    }

    function onAddElement(element) {
      strokesRef.current.push(element);
      const ctx = getCtx();
      if (ctx) drawElement(ctx, element);
    }

    function onUpdateElement(updated) {
      const idx = strokesRef.current.findIndex((s) => s.id === updated.id);
      if (idx !== -1) {
        strokesRef.current[idx] = { ...strokesRef.current[idx], ...updated };
        const ctx = getCtx();
        if (ctx) redrawAll(ctx, strokesRef.current, selectedIdRef.current);
      }
    }

    function onDeleteElement({ id }) {
      strokesRef.current = strokesRef.current.filter((s) => s.id !== id);
      if (selectedIdRef.current === id) {
        setSelectedId(null);
        selectedIdRef.current = null;
        setHoverHandleCursor(null);
      }
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current, selectedIdRef.current);
    }

    function onClearBoard() {
      strokesRef.current = [];
      setSelectedId(null);
      selectedIdRef.current = null;
      setHoverHandleCursor(null);
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    function onRemoteCursor(data) {
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: {
          x: data.x,
          y: data.y,
          name: data.name || 'User',
          slot: data.slot || 0,
        },
      }));
    }

    function onRemoteCursorLeave({ userId }) {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }

    socket.on('room-state', onRoomState);
    socket.on('stroke-start', onRemoteStrokeStart);
    socket.on('stroke-points', onRemoteStrokePoints);
    socket.on('stroke-end', onRemoteStrokeEnd);
    socket.on('add-element', onAddElement);
    socket.on('update-element', onUpdateElement);
    socket.on('delete-element', onDeleteElement);
    socket.on('clear-board', onClearBoard);
    socket.on('remote-cursor', onRemoteCursor);
    socket.on('remote-cursor-leave', onRemoteCursorLeave);

    return () => {
      socket.off('room-state', onRoomState);
      socket.off('stroke-start', onRemoteStrokeStart);
      socket.off('stroke-points', onRemoteStrokePoints);
      socket.off('stroke-end', onRemoteStrokeEnd);
      socket.off('add-element', onAddElement);
      socket.off('update-element', onUpdateElement);
      socket.off('delete-element', onDeleteElement);
      socket.off('clear-board', onClearBoard);
      socket.off('remote-cursor', onRemoteCursor);
      socket.off('remote-cursor-leave', onRemoteCursorLeave);
    };
  }, [getCtx]);

  const flushPoints = useCallback(() => {
    rafRef.current = null;
    if (pendingPointsRef.current.length === 0) return;
    const pts = pendingPointsRef.current.splice(0);
    socket.emit('stroke-points', { points: pts });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(flushPoints);
  }, [flushPoints]);

  // Commit active text box
  const commitText = useCallback(() => {
    if (!editingText) return;
    const trimmed = (editingText.text || '').trim();
    if (trimmed.length > 0) {
      if (editingText.id) {
        // Updating existing text
        const idx = strokesRef.current.findIndex((s) => s.id === editingText.id);
        if (idx !== -1) {
          strokesRef.current[idx] = {
            ...strokesRef.current[idx],
            text: trimmed,
            color: editingText.color,
            size: editingText.size,
          };
          socket.emit('update-element', strokesRef.current[idx]);
        }
      } else {
        // Creating new text
        const textElement = {
          id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'text',
          text: trimmed,
          x: editingText.x,
          y: editingText.y,
          color: editingText.color,
          size: editingText.size,
        };
        strokesRef.current.push(textElement);
        socket.emit('add-element', textElement);
      }
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current, selectedIdRef.current);
    }
    setEditingText(null);
  }, [editingText, getCtx]);

  // If mode changes while typing text, commit text
  useEffect(() => {
    if (mode !== 'text' && editingText) {
      commitText();
    }
  }, [mode, editingText, commitText]);

  // Double-click on canvas: edit text if double clicked
  const onDoubleClick = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      for (let i = strokesRef.current.length - 1; i >= 0; i--) {
        const el = strokesRef.current[i];
        if (el.type === 'text' && hitTestElement(el, px, py, canvas.width, canvas.height)) {
          setEditingText({
            id: el.id,
            x: el.x,
            y: el.y,
            clientX: el.x * canvas.width,
            clientY: el.y * canvas.height,
            text: el.text,
            color: el.color,
            size: el.size,
          });
          setSelectedId(el.id);
          selectedIdRef.current = el.id;
          return;
        }
      }
    },
    []
  );

  // Pointer interactions
  const onPointerDown = useCallback(
    (e) => {
      if (editingText) {
        commitText();
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const nx = px / rect.width;
      const ny = py / rect.height;

      // SELECT TOOL: Handle resizing or moving
      if (mode === 'select') {
        // 1. Check if user clicked on a resize handle of the currently selected element
        if (selectedIdRef.current) {
          const selectedEl = strokesRef.current.find((s) => s.id === selectedIdRef.current);
          if (selectedEl) {
            const handles = getElementHandles(selectedEl, canvas.width, canvas.height);
            const clickedHandle = findHandleAt(handles, px, py);

            if (clickedHandle) {
              e.currentTarget.setPointerCapture(e.pointerId);
              isResizingRef.current = true;
              activeHandleRef.current = clickedHandle.id;

              if (selectedEl.type === 'line' || selectedEl.type === 'arrow') {
                resizeSnapRef.current = {
                  points: selectedEl.points.map((p) => ({ ...p })),
                };
              } else if (selectedEl.type === 'text') {
                resizeSnapRef.current = {
                  x: selectedEl.x,
                  y: selectedEl.y,
                  size: selectedEl.size || 4,
                  px,
                  py,
                };
              } else {
                const xs = selectedEl.points.map((p) => p.x);
                const ys = selectedEl.points.map((p) => p.y);
                resizeSnapRef.current = {
                  minX: Math.min(...xs),
                  maxX: Math.max(...xs),
                  minY: Math.min(...ys),
                  maxY: Math.max(...ys),
                };
              }
              return;
            }
          }
        }

        // 2. Check if user clicked on any movable element
        let foundEl = null;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          const el = strokesRef.current[i];
          if (hitTestElement(el, px, py, canvas.width, canvas.height)) {
            foundEl = el;
            break;
          }
        }

        if (foundEl) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setSelectedId(foundEl.id);
          selectedIdRef.current = foundEl.id;
          isMovingRef.current = true;
          dragMoveStartRef.current = { x: nx, y: ny };

          if (foundEl.type === 'text') {
            initialElementCoordsRef.current = { x: foundEl.x, y: foundEl.y };
          } else if (foundEl.points) {
            initialElementCoordsRef.current = {
              points: foundEl.points.map((p) => ({ ...p })),
            };
          }

          const ctx = getCtx();
          if (ctx) redrawAll(ctx, strokesRef.current, foundEl.id);
        } else {
          // Clicked empty area: deselect
          setSelectedId(null);
          selectedIdRef.current = null;
          setHoverHandleCursor(null);
          const ctx = getCtx();
          if (ctx) redrawAll(ctx, strokesRef.current, null);
        }
        return;
      }

      // TEXT MODE
      if (mode === 'text') {
        setEditingText({
          x: nx,
          y: ny,
          clientX: px,
          clientY: py,
          text: '',
          color,
          size,
        });
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      // SHAPE MODES
      const isShape = ['rectangle', 'circle', 'line', 'arrow', 'triangle'].includes(mode);
      if (isShape) {
        dragStartRef.current = { x: nx, y: ny };
        previewShapeRef.current = {
          id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: mode,
          color,
          size,
          points: [{ x: nx, y: ny }, { x: nx, y: ny }],
        };
        return;
      }

      // PEN AND ERASER MODES
      pendingPointsRef.current = [];
      lastLocalPointRef.current = null;

      const actualColor = mode === 'eraser' ? '#ffffff' : color;
      const newStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        color: actualColor,
        size,
        points: [],
      };
      strokesRef.current.push(newStroke);

      newStroke.points.push({ x: nx, y: ny });
      lastLocalPointRef.current = { x: nx, y: ny };

      socket.emit('stroke-start', { color: actualColor, size });
      pendingPointsRef.current.push({ x: nx, y: ny });
      scheduleFlush();
    },
    [color, size, mode, editingText, commitText, getCtx, scheduleFlush]
  );

  const onPointerMove = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const nx = clientX / rect.width;
      const ny = clientY / rect.height;

      // Update hover cursor for indicator ring (hidden in select mode)
      setHoverCursor(mode === 'select' ? null : { clientX, clientY });

      // Throttle remote cursor broadcast
      const now = performance.now();
      if (now - lastCursorEmitRef.current > 40) {
        lastCursorEmitRef.current = now;
        socket.emit('cursor-move', { x: nx, y: ny });
      }

      // SELECT MODE INTERACTIONS
      if (mode === 'select') {
        const selectedEl = strokesRef.current.find((s) => s.id === selectedIdRef.current);

        // A. Resizing in progress
        if (isResizingRef.current && selectedEl && activeHandleRef.current && resizeSnapRef.current) {
          const handle = activeHandleRef.current;

          if (selectedEl.type === 'line' || selectedEl.type === 'arrow') {
            if (handle === 'start') {
              selectedEl.points[0] = { x: nx, y: ny };
            } else if (handle === 'end') {
              selectedEl.points[1] = { x: nx, y: ny };
            }
          } else if (selectedEl.type === 'text') {
            const snap = resizeSnapRef.current;
            let delta = 0;
            if (handle === 'br' || handle === 'r' || handle === 'b') {
              delta = (clientX - snap.px) + (clientY - snap.py);
              const scale = Math.max(0.2, 1 + delta / 100);
              selectedEl.size = Math.max(2, Math.min(60, Math.round(snap.size * scale)));
            } else if (handle === 'tl' || handle === 'l' || handle === 't') {
              delta = (snap.px - clientX) + (snap.py - clientY);
              const scale = Math.max(0.2, 1 + delta / 100);
              selectedEl.size = Math.max(2, Math.min(60, Math.round(snap.size * scale)));
              selectedEl.x = nx;
              selectedEl.y = ny;
            } else if (handle === 'tr') {
              delta = (clientX - snap.px) + (snap.py - clientY);
              const scale = Math.max(0.2, 1 + delta / 100);
              selectedEl.size = Math.max(2, Math.min(60, Math.round(snap.size * scale)));
              selectedEl.y = ny;
            } else if (handle === 'bl') {
              delta = (snap.px - clientX) + (clientY - snap.py);
              const scale = Math.max(0.2, 1 + delta / 100);
              selectedEl.size = Math.max(2, Math.min(60, Math.round(snap.size * scale)));
              selectedEl.x = nx;
            }
          } else {
            // Shapes: rectangle, circle, triangle
            let { minX, maxX, minY, maxY } = resizeSnapRef.current;
            const minPadding = 0.005;

            if (handle === 'tl') {
              minX = Math.min(nx, maxX - minPadding);
              minY = Math.min(ny, maxY - minPadding);
            } else if (handle === 'tr') {
              maxX = Math.max(nx, minX + minPadding);
              minY = Math.min(ny, maxY - minPadding);
            } else if (handle === 'br') {
              maxX = Math.max(nx, minX + minPadding);
              maxY = Math.max(ny, minY + minPadding);
            } else if (handle === 'bl') {
              minX = Math.min(nx, maxX - minPadding);
              maxY = Math.max(ny, minY + minPadding);
            } else if (handle === 't') {
              minY = Math.min(ny, maxY - minPadding);
            } else if (handle === 'b') {
              maxY = Math.max(ny, minY + minPadding);
            } else if (handle === 'l') {
              minX = Math.min(nx, maxX - minPadding);
            } else if (handle === 'r') {
              maxX = Math.max(nx, minX + minPadding);
            }

            selectedEl.points = [
              { x: minX, y: minY },
              { x: maxX, y: maxY },
            ];
          }

          const ctx = getCtx();
          if (ctx) redrawAll(ctx, strokesRef.current, selectedEl.id);
          return;
        }

        // B. Moving in progress
        if (isMovingRef.current && selectedIdRef.current && dragMoveStartRef.current) {
          const dx = nx - dragMoveStartRef.current.x;
          const dy = ny - dragMoveStartRef.current.y;
          const el = strokesRef.current.find((s) => s.id === selectedIdRef.current);
          if (el && initialElementCoordsRef.current) {
            if (el.type === 'text') {
              el.x = initialElementCoordsRef.current.x + dx;
              el.y = initialElementCoordsRef.current.y + dy;
            } else if (el.points && initialElementCoordsRef.current.points) {
              el.points = initialElementCoordsRef.current.points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
              }));
            }
            const ctx = getCtx();
            if (ctx) redrawAll(ctx, strokesRef.current, el.id);
          }
          return;
        }

        // C. Hover check: check if mouse is over a resize handle of selected element
        if (selectedEl) {
          const handles = getElementHandles(selectedEl, canvas.width, canvas.height);
          const hoveredH = findHandleAt(handles, clientX, clientY);
          if (hoveredH) {
            setHoverHandleCursor(hoveredH.cursor);
            setIsHoveringMovable(false);
            return;
          }
        }
        setHoverHandleCursor(null);

        // D. Hover check: check if mouse is over any movable element
        let hovering = false;
        for (let i = strokesRef.current.length - 1; i >= 0; i--) {
          const el = strokesRef.current[i];
          if (hitTestElement(el, clientX, clientY, canvas.width, canvas.height)) {
            hovering = true;
            break;
          }
        }
        setIsHoveringMovable(hovering);
        return;
      }

      if (!isDrawingRef.current) return;

      // Live drag preview for shapes
      const isShape = ['rectangle', 'circle', 'line', 'arrow', 'triangle'].includes(mode);
      if (isShape && dragStartRef.current) {
        previewShapeRef.current = {
          ...previewShapeRef.current,
          points: [dragStartRef.current, { x: nx, y: ny }],
        };
        const ctx = getCtx();
        if (ctx) {
          redrawAll(ctx, strokesRef.current, selectedIdRef.current);
          drawElement(ctx, previewShapeRef.current);
        }
        return;
      }

      // Live drawing for pen and eraser
      const currentStroke = strokesRef.current[strokesRef.current.length - 1];
      if (!currentStroke) return;
      const ctx = getCtx();
      if (ctx && lastLocalPointRef.current) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.beginPath();
        ctx.strokeStyle = currentStroke.color;
        ctx.lineWidth = currentStroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(lastLocalPointRef.current.x * w, lastLocalPointRef.current.y * h);
        ctx.lineTo(nx * w, ny * h);
        ctx.stroke();
      }

      currentStroke.points.push({ x: nx, y: ny });
      lastLocalPointRef.current = { x: nx, y: ny };
      pendingPointsRef.current.push({ x: nx, y: ny });
      scheduleFlush();
    },
    [color, size, mode, getCtx, scheduleFlush]
  );

  const onPointerUp = useCallback(() => {
    // Finish resizing in select mode
    if (mode === 'select' && isResizingRef.current) {
      isResizingRef.current = false;
      activeHandleRef.current = null;
      resizeSnapRef.current = null;
      const el = strokesRef.current.find((s) => s.id === selectedIdRef.current);
      if (el) {
        socket.emit('update-element', el);
      }
      return;
    }

    // Finish moving in select mode
    if (mode === 'select' && isMovingRef.current) {
      isMovingRef.current = false;
      dragMoveStartRef.current = null;
      initialElementCoordsRef.current = null;
      const el = strokesRef.current.find((s) => s.id === selectedIdRef.current);
      if (el) {
        socket.emit('update-element', el);
      }
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Finish shape creation
    const isShape = ['rectangle', 'circle', 'line', 'arrow', 'triangle'].includes(mode);
    if (isShape && previewShapeRef.current) {
      const p0 = previewShapeRef.current.points[0];
      const p1 = previewShapeRef.current.points[1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

      if (dist > 0.003) {
        strokesRef.current.push(previewShapeRef.current);
        socket.emit('add-element', previewShapeRef.current);
      }
      previewShapeRef.current = null;
      dragStartRef.current = null;
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current, selectedIdRef.current);
      return;
    }

    // Finish pen/eraser stroke
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingPointsRef.current.length > 0) {
      socket.emit('stroke-points', { points: pendingPointsRef.current.splice(0) });
    }
    socket.emit('stroke-end');
    lastLocalPointRef.current = null;
  }, [mode, getCtx]);

  const onPointerLeave = useCallback(() => {
    setHoverCursor(null);
    setIsHoveringMovable(false);
    setHoverHandleCursor(null);
    socket.emit('cursor-leave');
  }, []);

  const cursorStyle = getCursorStyle(
    mode,
    color,
    size,
    isHoveringMovable,
    isMovingRef.current,
    hoverHandleCursor
  );

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden select-none"
      onPointerLeave={onPointerLeave}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          touchAction: 'none',
          cursor: cursorStyle,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />

      {/* Visible Local Cursor Indicator (brush/eraser preview follower) */}
      {hoverCursor && mode !== 'select' && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-75"
          style={{
            left: hoverCursor.clientX,
            top: hoverCursor.clientY,
            width: Math.max(8, mode === 'eraser' ? size * 2 : size),
            height: Math.max(8, mode === 'eraser' ? size * 2 : size),
            backgroundColor:
              mode === 'eraser' ? 'rgba(255, 255, 255, 0.7)' : color,
            border:
              mode === 'eraser'
                ? '2px dashed #f43f5e'
                : '1.5px solid #ffffff',
            boxShadow:
              mode === 'eraser'
                ? '0 0 0 1px rgba(0,0,0,0.3)'
                : '0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.15)',
            opacity: mode === 'text' ? 0 : 0.85,
          }}
        />
      )}

      {/* Collaborative Remote Cursors */}
      {Object.entries(remoteCursors).map(([userId, rc]) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const posX = rc.x * canvas.width;
        const posY = rc.y * canvas.height;
        const slotColor = rc.slot === 0 ? '#4f46e5' : '#db2777';

        return (
          <div
            key={userId}
            className="pointer-events-none absolute transition-all duration-75 ease-out z-30"
            style={{
              left: posX,
              top: posY,
              transform: 'translate(0, 0)',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L17.7846 12.3673H5.65376Z"
                fill={slotColor}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>
            <div
              className="ml-4 -mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-md whitespace-nowrap"
              style={{ backgroundColor: slotColor }}
            >
              {rc.name}
            </div>
          </div>
        );
      })}

      {/* Active Textbox Input */}
      {editingText && (
        <div
          className="absolute z-40 flex flex-col gap-1.5"
          style={{
            left: Math.max(10, Math.min(editingText.clientX, (canvasRef.current?.width || 800) - 220)),
            top: Math.max(10, Math.min(editingText.clientY, (canvasRef.current?.height || 600) - 100)),
          }}
        >
          <textarea
            ref={textareaRef}
            rows={2}
            placeholder="Type text... (Enter to finish, Shift+Enter for newline)"
            value={editingText.text}
            onChange={(e) =>
              setEditingText((prev) => (prev ? { ...prev, text: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitText();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingText(null);
              }
            }}
            className="p-2 rounded-lg bg-white/95 backdrop-blur-sm shadow-xl border-2 outline-none resize-none transition-all"
            style={{
              borderColor: editingText.color,
              color: editingText.color,
              fontSize: `${Math.max(14, Math.round(editingText.size * 2.5 + 8))}px`,
              minWidth: '180px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 600,
            }}
          />
          <div className="flex items-center gap-1.5 self-end bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-md border border-gray-100">
            <button
              type="button"
              onClick={commitText}
              title="Add text to canvas (Enter)"
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500 hover:bg-indigo-600 text-white transition cursor-pointer"
            >
              <Check size={13} />
              <span>Done</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingText(null)}
              title="Cancel (Esc)"
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
