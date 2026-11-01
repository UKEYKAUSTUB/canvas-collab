import { useEffect, useRef, useCallback } from 'react';
import socket from '../socket.js';

function drawStroke(ctx, stroke) {
  if (!stroke.points || stroke.points.length < 2) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
  }
  ctx.stroke();
}

function redrawAll(ctx, strokes) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

export default function Board({ color, size, mode, roomId, initialStrokes }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef(
    initialStrokes
      ? initialStrokes.map((s) => ({
          ...s,
          points: s.points ? s.points.map((p) => ({ ...p })) : [],
        }))
      : []
  );
  const isDrawingRef = useRef(false);
  const pendingPointsRef = useRef([]);
  const rafRef = useRef(null);
  const remoteStrokeRef = useRef(null);
  const lastLocalPointRef = useRef(null);

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
    redrawAll(ctx, strokesRef.current);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    function onRoomState({ strokes, userCount }) {
      strokesRef.current = strokes.map((s) => ({ ...s, points: [...s.points] }));
      const ctx = getCtx();
      if (ctx) redrawAll(ctx, strokesRef.current);
    }

    function onRemoteStrokeStart({ color: c, size: s }) {
      remoteStrokeRef.current = { color: c, size: s, points: [] };
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

    function onClearBoard() {
      strokesRef.current = [];
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    socket.on('room-state', onRoomState);
    socket.on('stroke-start', onRemoteStrokeStart);
    socket.on('stroke-points', onRemoteStrokePoints);
    socket.on('stroke-end', onRemoteStrokeEnd);
    socket.on('clear-board', onClearBoard);

    return () => {
      socket.off('room-state', onRoomState);
      socket.off('stroke-start', onRemoteStrokeStart);
      socket.off('stroke-points', onRemoteStrokePoints);
      socket.off('stroke-end', onRemoteStrokeEnd);
      socket.off('clear-board', onClearBoard);
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

  const onPointerDown = useCallback(
    (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      pendingPointsRef.current = [];
      lastLocalPointRef.current = null;

      const actualColor = mode === 'eraser' ? '#ffffff' : color;
      const newStroke = { color: actualColor, size, points: [] };
      strokesRef.current.push(newStroke);

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      newStroke.points.push({ x: nx, y: ny });
      lastLocalPointRef.current = { x: nx, y: ny };

      socket.emit('stroke-start', { color: actualColor, size });
      pendingPointsRef.current.push({ x: nx, y: ny });
      scheduleFlush();
    },
    [color, size, mode, scheduleFlush]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;

      const currentStroke = strokesRef.current[strokesRef.current.length - 1];
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
    [getCtx, scheduleFlush]
  );

  const onPointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingPointsRef.current.length > 0) {
      socket.emit('stroke-points', { points: pendingPointsRef.current.splice(0) });
    }
    socket.emit('stroke-end');
    lastLocalPointRef.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none', cursor: mode === 'eraser' ? 'cell' : 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
