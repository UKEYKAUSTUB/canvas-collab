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
  remoteName,
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
      className="absolute top-2 right-2 z-20 flex flex-col gap-1 w-72 sm:w-96 select-none"
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
        title="Drag to reposition call window"
      >
        <GripHorizontal size={18} />
      </div>

      {/* ── Remote video (large) ── */}
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800">
        {/* Remote video element — always rendered so srcObject can be set */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Overlays — shown when waiting for participant */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gray-900/95 p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 mb-0.5">
              <User size={22} />
            </div>
            <span className="text-gray-200 text-xs font-semibold">
              Waiting for participant to join…
            </span>
            <span className="text-gray-400 text-[11px] max-w-[220px] leading-relaxed">
              Live peer-to-peer video will appear here when a partner joins. Your camera preview is on the bottom right.
            </span>
          </div>
        )}

        {isConnected && !remoteMediaState?.cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
            <div className="w-14 h-14 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center shadow-inner">
              <User size={28} className="text-gray-300" />
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-gray-300 text-xs font-medium">
              <VideoOff size={14} className="text-red-400" />
              <span>Camera off</span>
            </div>
          </div>
        )}

        {/* Remote Participant Media Status Badges (Bottom-Left) */}
        {isConnected && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
            {/* Name pill */}
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-xs text-white">
              <User size={11} className="text-gray-300" />
              <span className="font-medium text-[11px] truncate max-w-[90px]">
                {remoteName || 'Partner'}
              </span>
            </div>

            {/* Mic Status Icon Badge */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-md shadow-sm transition-colors ${
                remoteMediaState?.micOn
                  ? 'bg-emerald-600/80 text-white'
                  : 'bg-red-600/90 text-white'
              }`}
              title={remoteMediaState?.micOn ? 'Microphone is ON' : 'Microphone is OFF (Muted)'}
            >
              {remoteMediaState?.micOn ? (
                <>
                  <Mic size={12} />
                  <span className="text-[10px]">Mic on</span>
                </>
              ) : (
                <>
                  <MicOff size={12} />
                  <span className="text-[10px]">Muted</span>
                </>
              )}
            </div>

            {/* Camera Status Icon Badge */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-md shadow-sm transition-colors ${
                remoteMediaState?.cameraOn
                  ? 'bg-black/60 text-white'
                  : 'bg-red-600/90 text-white'
              }`}
              title={remoteMediaState?.cameraOn ? 'Camera is ON' : 'Camera is OFF'}
            >
              {remoteMediaState?.cameraOn ? (
                <>
                  <Video size={12} />
                  <span className="text-[10px]">Cam on</span>
                </>
              ) : (
                <>
                  <VideoOff size={12} />
                  <span className="text-[10px]">Cam off</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top-Right Muted Warning Icon if Partner Mic is Muted */}
        {isConnected && !remoteMediaState?.micOn && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 bg-red-600/90 text-white px-2 py-0.5 rounded-full text-xs font-medium shadow-md pointer-events-none"
            title="Partner microphone is muted"
          >
            <MicOff size={12} />
            <span className="text-[10px]">Muted</span>
          </div>
        )}

        {/* Local PiP — bottom-right inside remote frame */}
        <div className="absolute bottom-2 right-2 w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-gray-800 z-10">
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${cameraOn ? '' : 'hidden'}`}
          />
          {!cameraOn && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 p-1">
              <User size={15} className="text-gray-400" />
              <span className="text-[8px] text-gray-400">Cam off</span>
            </div>
          )}

          {/* Local Mic & Camera status icons on PiP */}
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] text-white pointer-events-none">
            <span className="font-semibold text-[8px] text-gray-300">You</span>
            {micOn ? (
              <Mic size={9} className="text-emerald-400" title="Your mic is on" />
            ) : (
              <MicOff size={9} className="text-red-400" title="Your mic is off" />
            )}
            {cameraOn ? (
              <Video size={9} className="text-white" title="Your camera is on" />
            ) : (
              <VideoOff size={9} className="text-red-400" title="Your camera is off" />
            )}
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-gray-100">
        {mediaError && (
          <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 text-center font-medium">
            {mediaError}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Local Mic Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              title={micOn ? 'Microphone is ON (click to mute)' : 'Microphone is OFF (click to unmute)'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer
                ${
                  micOn
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
            >
              {micOn ? <Mic size={15} className="text-emerald-600" /> : <MicOff size={15} className="text-red-500" />}
              <span className="text-[11px]">{micOn ? 'Mute' : 'Unmute'}</span>
            </button>

            {/* Local Camera Toggle */}
            <button
              type="button"
              onClick={toggleCamera}
              title={cameraOn ? 'Camera is ON (click to turn off)' : 'Camera is OFF (click to turn on)'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer
                ${
                  cameraOn
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
            >
              {cameraOn ? <Video size={15} className="text-indigo-600" /> : <VideoOff size={15} className="text-red-500" />}
              <span className="text-[11px]">{cameraOn ? 'Stop Video' : 'Start Video'}</span>
            </button>
          </div>

          {/* Remote status indicator in controls bar */}
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 border-l border-gray-200 pl-2">
              <span className="text-[10px] text-gray-400 font-medium">Partner:</span>
              <span title={remoteMediaState?.micOn ? 'Partner Mic: ON' : 'Partner Mic: OFF (Muted)'}>
                {remoteMediaState?.micOn ? (
                  <Mic size={13} className="text-emerald-500" />
                ) : (
                  <MicOff size={13} className="text-red-500" />
                )}
              </span>
              <span title={remoteMediaState?.cameraOn ? 'Partner Camera: ON' : 'Partner Camera: OFF'}>
                {remoteMediaState?.cameraOn ? (
                  <Video size={13} className="text-indigo-500" />
                ) : (
                  <VideoOff size={13} className="text-red-500" />
                )}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 font-medium">1 user in room</span>
          )}
        </div>
      </div>
    </div>
  );
}
