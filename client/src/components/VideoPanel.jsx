import { useState, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, User, GripHorizontal } from 'lucide-react';

export default function VideoPanel({
  localRef,
  remoteRef,
  micOn,
  cameraOn,
  toggleMic,
  toggleCamera,
  remoteMediaState,
  isConnected,
  mediaError,
}) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, posX: 0, posY: 0 });

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: posRef.current.x,
      posY: posRef.current.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !panelRef.current) return;
    const parent = panelRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();

    const currentPosX = posRef.current.x;
    const currentPosY = posRef.current.y;

    const untransformedLeft = panelRect.left - currentPosX - parentRect.left;
    const untransformedTop = panelRect.top - currentPosY - parentRect.top;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    const targetX = dragStartRef.current.posX + deltaX;
    const targetY = dragStartRef.current.posY + deltaY;

    const minX = -untransformedLeft;
    const maxX = parentRect.width - panelRect.width - untransformedLeft;
    const minY = -untransformedTop;
    const maxY = parentRect.height - panelRect.height - untransformedTop;

    const clampedX = Math.min(Math.max(targetX, Math.min(minX, maxX)), Math.max(minX, maxX));
    const clampedY = Math.min(Math.max(targetY, Math.min(minY, maxY)), Math.max(minY, maxY));

    posRef.current = { x: clampedX, y: clampedY };
    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-2 right-2 z-20 flex flex-col gap-1 w-72 sm:w-96"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {/* ── Drag handle ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full flex items-center justify-center py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition select-none"
        style={{ touchAction: 'none' }}
        title="Drag to reposition"
      >
        <GripHorizontal size={18} />
      </div>

      {/* ── Remote video (large) ── */}
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-xl">
        {/* Remote video element — always rendered so srcObject can be set */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Overlays — shown on top of the video element */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
            <span className="text-gray-400 text-xs text-center px-2">
              Waiting for participant…
            </span>
          </div>
        )}

        {isConnected && !remoteMediaState.cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
            <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
              <User size={24} className="text-gray-300" />
            </div>
            <span className="text-gray-400 text-xs mt-2">Camera off</span>
          </div>
        )}

        {/* Local PiP — bottom-right inside remote frame */}
        <div className="absolute bottom-2 right-2 w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-gray-800">
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${cameraOn ? '' : 'hidden'}`}
          />
          {!cameraOn && (
            <div className="w-full h-full flex items-center justify-center">
              <User size={16} className="text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex items-center justify-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow border border-gray-100">
        {mediaError ? (
          <span className="text-red-500 text-xs text-center">{mediaError}</span>
        ) : (
          <>
            <button
              onClick={toggleMic}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition
                ${micOn ? 'text-gray-600 hover:bg-gray-100' : 'bg-red-100 text-red-500 hover:bg-red-200'}`}
            >
              {micOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button
              onClick={toggleCamera}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition
                ${cameraOn ? 'text-gray-600 hover:bg-gray-100' : 'bg-red-100 text-red-500 hover:bg-red-200'}`}
            >
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>

            <span className="text-xs text-gray-400 ml-1">
              {isConnected ? 'Live' : 'Waiting…'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
