import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  LogOut,
  Mic,
  MicOff,
  Video,
  VideoOff,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import socket from '../socket.js';
import Board from './Board.jsx';
import Toolbar from './Toolbar.jsx';
import VideoPanel from './VideoPanel.jsx';
import AIPanel from './AIPanel.jsx';
import { useWebRTC } from '../hooks/useWebRTC.js';

export default function Room({ name, roomId, initialState, onLeave }) {
  const [userCount, setUserCount] = useState(initialState?.userCount ?? 1);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [mode, setMode] = useState('pen');
  const [aiOpen, setAiOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Undo / Redo state
  const boardRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Toast notifications & remote participant info
  const [toasts, setToasts] = useState([]);
  const [remoteName, setRemoteName] = useState('');

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function copyRoomId() {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function doLeave() {
    socket.emit('leave-room');
    onLeave();
  }

  function handleLeaveClick() {
    if (userCount <= 1) {
      setConfirmLeave(true); // last person: warn before the board is erased
    } else {
      doLeave();
    }
  }

  const {
    localRef,
    remoteRef,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    remoteMediaState,
    isConnected,
    mediaError,
  } = useWebRTC({ name, roomId, socket });

  useEffect(() => {
    function onUserCount({ count }) {
      setUserCount(count);
    }

    function onUserLeft({ name: leftName }) {
      addToast({
        id: Date.now() + Math.random(),
        type: 'leave',
        title: `${leftName || 'A participant'} left the meeting`,
        message: 'The participant has left or disconnected from the room.',
      });
      setRemoteName('');
    }

    function onUserJoinedRoom({ name: joinedName }) {
      if (joinedName) {
        setRemoteName(joinedName);
      }
      addToast({
        id: Date.now() + Math.random(),
        type: 'join',
        title: `${joinedName || 'A participant'} joined the meeting`,
        message: 'A participant has entered the room.',
      });
    }

    socket.on('user-count', onUserCount);
    socket.on('user-left', onUserLeft);
    socket.on('user-joined-room', onUserJoinedRoom);

    return () => {
      socket.off('user-count', onUserCount);
      socket.off('user-left', onUserLeft);
      socket.off('user-joined-room', onUserJoinedRoom);
    };
  }, [addToast]);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* ── Meeting Notifications Toast Container (top-center) ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 text-sm animate-in fade-in slide-in-from-top-4 duration-300 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  toast.type === 'leave'
                    ? 'bg-red-50 text-red-500 border border-red-100'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}
              >
                {toast.type === 'leave' ? <UserMinus size={18} /> : <UserPlus size={18} />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-gray-800 text-xs sm:text-sm truncate">
                  {toast.title}
                </span>
                <span className="text-gray-500 text-[11px] truncate">
                  {toast.message}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Header Bar ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Current User Pill with Mic/Camera status icons */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-semibold uppercase">
              {name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-gray-800 max-w-[110px] truncate">{name}</span>

            {/* Local Mic & Camera status icons in header */}
            <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded-md">
              <span title={micOn ? 'Your microphone is ON' : 'Your microphone is MUTED (OFF)'}>
                {micOn ? (
                  <Mic size={12} className="text-emerald-500" />
                ) : (
                  <MicOff size={12} className="text-red-500" />
                )}
              </span>
              <span title={cameraOn ? 'Your camera is ON' : 'Your camera is OFF'}>
                {cameraOn ? (
                  <Video size={12} className="text-indigo-500" />
                ) : (
                  <VideoOff size={12} className="text-red-500" />
                )}
              </span>
            </div>
          </div>

          <span className="w-px h-4 bg-gray-200" />

          {/* Room ID Copy */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 text-sm">Room:</span>
            <span className="font-mono text-blue-500 text-sm tracking-widest">{roomId}</span>
            <button
              onClick={copyRoomId}
              title="Copy room code"
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Partner Media Status Pill (when in call or connected) */}
          {userCount > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <span className="font-medium text-gray-600 text-[11px]">
                {remoteName || 'Partner'}:
              </span>
              <span
                className="flex items-center gap-0.5"
                title={remoteMediaState?.micOn ? 'Partner Mic is ON' : 'Partner Mic is OFF (Muted)'}
              >
                {remoteMediaState?.micOn ? (
                  <Mic size={13} className="text-emerald-500" />
                ) : (
                  <MicOff size={13} className="text-red-500" />
                )}
              </span>
              <span
                className="flex items-center gap-0.5"
                title={remoteMediaState?.cameraOn ? 'Partner Camera is ON' : 'Partner Camera is OFF'}
              >
                {remoteMediaState?.cameraOn ? (
                  <Video size={13} className="text-indigo-500" />
                ) : (
                  <VideoOff size={13} className="text-red-500" />
                )}
              </span>
            </div>
          )}

          {/* AI Helper Toggle */}
          <button
            onClick={() => setAiOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition border cursor-pointer ${
              aiOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title="Toggle AI Helper"
          >
            <Sparkles size={14} className={aiOpen ? 'text-indigo-600' : 'text-gray-400'} />
            <span>AI Helper</span>
          </button>

          {/* User count & Leave Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  userCount > 1 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span>
                {userCount} {userCount === 1 ? 'user' : 'users'}
              </span>
            </div>

            <button
              onClick={handleLeaveClick}
              title="Leave room"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span>Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Canvas Viewport ── */}
      <div className="relative flex-1 overflow-hidden">
        {confirmLeave && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs">
              <h3 className="text-base font-semibold text-gray-800 mb-1">Leave this room?</h3>
              <p className="text-sm text-gray-500 mb-5">
                You are the last person here. The board and AI chat will be erased.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Stay
                </button>
                <button
                  onClick={doLeave}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white transition cursor-pointer"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
        <Board
          ref={boardRef}
          color={color}
          size={size}
          mode={mode}
          roomId={roomId}
          initialStrokes={initialState?.strokes}
          userName={name}
          onHistoryChange={({ canUndo: u, canRedo: r }) => {
            setCanUndo(u);
            setCanRedo(r);
          }}
        />
        <Toolbar
          color={color}
          size={size}
          mode={mode}
          onColorChange={setColor}
          onSizeChange={setSize}
          onModeChange={setMode}
          roomId={roomId}
          onUndo={() => boardRef.current?.undo()}
          onRedo={() => boardRef.current?.redo()}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <VideoPanel
          localRef={localRef}
          remoteRef={remoteRef}
          micOn={micOn}
          cameraOn={cameraOn}
          toggleMic={toggleMic}
          toggleCamera={toggleCamera}
          remoteMediaState={remoteMediaState}
          isConnected={isConnected}
          mediaError={mediaError}
          remoteName={remoteName}
        />
        <AIPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      </div>
    </div>
  );
}
