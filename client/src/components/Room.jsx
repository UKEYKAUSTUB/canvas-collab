import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, LogOut } from 'lucide-react';
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
    socket.on('user-count', onUserCount);
    return () => socket.off('user-count', onUserCount);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-semibold uppercase">
              {name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-gray-800 max-w-[110px] truncate">{name}</span>
          </div>
          <span className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 text-sm">Room:</span>
            <span className="font-mono text-blue-500 text-sm tracking-widest">{roomId}</span>
            <button
              onClick={copyRoomId}
              title="Copy room code"
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAiOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition border ${
              aiOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title="Toggle AI Helper"
          >
            <Sparkles size={14} className={aiOpen ? 'text-indigo-600' : 'text-gray-400'} />
            <span>AI Helper</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                      <button
            onClick={handleLeaveClick}
            title="Leave room"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
          >
            <LogOut size={14} />
            <span>Leave</span>
          </button>
            <span className="text-sm text-gray-500">
              {userCount} {userCount === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>
      </header>

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
                className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                Stay
              </button>
              <button
                onClick={doLeave}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
        <Board
          color={color}
          size={size}
          mode={mode}
          roomId={roomId}
          initialStrokes={initialState?.strokes}
        />
        <Toolbar
          color={color}
          size={size}
          mode={mode}
          onColorChange={setColor}
          onSizeChange={setSize}
          onModeChange={setMode}
          roomId={roomId}
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
        />
        <AIPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      </div>
    </div>
  );
}
