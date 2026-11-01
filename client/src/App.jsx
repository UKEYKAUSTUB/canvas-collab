import { useState } from 'react';
import Home from './components/Home.jsx';
import Room from './components/Room.jsx';

export default function App() {
  const [view, setView] = useState('home');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [initialState, setInitialState] = useState(null);

  function handleJoin(displayName, room, state) {
    setName(displayName);
    setRoomId(room);
    setInitialState(state);
    setView('room');
  }

  function handleLeave() {
    setRoomId('');
    setInitialState(null);
    setView('home');
  }

  if (view === 'room') {
    return (
      <Room
        name={name}
        roomId={roomId}
        initialState={initialState}
        onLeave={handleLeave}
      />
    );
  }

  return <Home onJoin={handleJoin} />;
}