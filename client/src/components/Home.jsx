import Hero from './Hero.jsx';
import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';

const ERRORS = {
  full: 'This room already has 2 people.',
  'not-found': 'No room with that code. Check it, or create a new room.',
};

export default function Home({ onJoin }) {
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const pendingRef = useRef(null);

  useEffect(() => {
    function onRoomState({ roomId: joinedRoom, strokes, userCount }) {
      if (!pendingRef.current) return;
      const { name: n } = pendingRef.current;
      pendingRef.current = null;
      setJoining(false);
      onJoin(n, joinedRoom, { strokes, userCount });
    }
    function onJoinRejected({ reason }) {
      pendingRef.current = null;
      setJoining(false);
      setError(ERRORS[reason] || 'Could not join the room.');
    }
    socket.on('room-state', onRoomState);
    socket.on('join-rejected', onJoinRejected);
    return () => {
      socket.off('room-state', onRoomState);
      socket.off('join-rejected', onJoinRejected);
    };
  }, [onJoin]);

  const canSubmit =
    name.trim().length > 0 &&
    (mode === 'create' || roomId.trim().length > 0) &&
    !joining;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setJoining(true);
    pendingRef.current = { name: name.trim() };
    socket.emit('join-room', {
      mode,
      name: name.trim(),
      roomId: mode === 'join' ? roomId.trim() : undefined,
    });
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  const tabClass = (active) =>
    `flex-1 py-2 text-sm font-medium rounded-lg transition ${
      active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="hidden lg:flex flex-1 items-center justify-center">
        <Hero />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">Canvas Collab</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Draw together in realtime</p>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button type="button" onClick={() => switchMode('create')} className={tabClass(mode === 'create')}>
            Create room
          </button>
          <button type="button" onClick={() => switchMode('join')} className={tabClass(mode === 'join')}>
            Join room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="name">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              autoComplete="off"
            />
          </div>

          {mode === 'join' ? (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600" htmlFor="room">
                Room Code
              </label>
              <input
                id="room"
                type="text"
                placeholder="e.g. K7M2QX"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                autoComplete="off"
                maxLength={12}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400 -mt-1">
              A room code will be generated. Share it with your friend after you enter.
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition"
          >
            {joining ? 'Please wait…' : mode === 'create' ? 'Create Room' : 'Join Room'}
          </button>

          {error && <p className="text-sm text-red-500 text-center mt-1">{error}</p>}
        </form>
      </div>
    </div>
    </div>
  );
}