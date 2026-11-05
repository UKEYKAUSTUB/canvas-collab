const rooms = new Map();

function getRoom(roomId) {
  return rooms.get(roomId);
}

function joinRoom(roomId, socketId, name) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      strokes: [],
      users: new Set(),
      userNames: new Map(),
      userSlots: new Map(),
      aiHistory: [],
      aiInFlight: false,
      lastAiTime: 0,
    });
  }
  const room = rooms.get(roomId);
  room.users.add(socketId);
  const usedSlots = new Set(room.userSlots.values());
  room.userSlots.set(socketId, usedSlots.has(0) ? 1 : 0);
  if (name) {
    room.userNames.set(socketId, name);
  }
}

function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.users.delete(socketId);
  if (room.userSlots) {
    room.userSlots.delete(socketId);
  }
  if (room.userNames) {
    room.userNames.delete(socketId);
  }
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
}

function getUserName(roomId, socketId) {
  const room = rooms.get(roomId);
  return room?.userNames?.get(socketId) || 'User';
}

function addAiMessage(roomId, role, content) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.aiHistory.push({ role, content });
  if (room.aiHistory.length > 10) {
    room.aiHistory = room.aiHistory.slice(-10);
  }
}

function getAiHistory(roomId) {
  const room = rooms.get(roomId);
  return room ? [...room.aiHistory] : [];
}

function isAiInFlight(roomId) {
  const room = rooms.get(roomId);
  return room ? !!room.aiInFlight : false;
}

function setAiInFlight(roomId, inFlight) {
  const room = rooms.get(roomId);
  if (room) room.aiInFlight = inFlight;
}

function getLastAiTime(roomId) {
  const room = rooms.get(roomId);
  return room ? room.lastAiTime || 0 : 0;
}

function setLastAiTime(roomId, time) {
  const room = rooms.get(roomId);
  if (room) room.lastAiTime = time;
}

function getUserCount(roomId) {
  const room = rooms.get(roomId);
  return room ? room.users.size : 0;
}

function addStrokeStart(roomId, color, size) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.strokes.push({
    id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    color,
    size,
    points: [],
  });
}

function addStrokePoints(roomId, points) {
  const room = rooms.get(roomId);
  if (!room || room.strokes.length === 0) return;
  const current = room.strokes[room.strokes.length - 1];
  if (current.points) {
    current.points.push(...points);
  }
}

function addStrokeEnd(roomId) {
  // Stroke is already in place; nothing extra needed.
}

function addElement(roomId, element) {
  const room = rooms.get(roomId);
  if (!room || !element) return;
  room.strokes.push(element);
}

function updateElement(roomId, updatedElement) {
  const room = rooms.get(roomId);
  if (!room || !updatedElement || !updatedElement.id) return;
  const idx = room.strokes.findIndex((s) => s.id === updatedElement.id);
  if (idx !== -1) {
    room.strokes[idx] = { ...room.strokes[idx], ...updatedElement };
  }
}

function deleteElement(roomId, elementId) {
  const room = rooms.get(roomId);
  if (!room || !elementId) return;
  room.strokes = room.strokes.filter((s) => s.id !== elementId);
}

function setRoomStrokes(roomId, strokes) {
  const room = rooms.get(roomId);
  if (!room || !Array.isArray(strokes)) return;
  room.strokes = strokes;
}

function clearRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.strokes = [];
}

function getUserSlot(roomId, socketId) {
  const room = rooms.get(roomId);
  return room?.userSlots?.get(socketId) ?? 0;
}

function roomExists(roomId) {
  return rooms.has(roomId);
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(id));
  return id;
}

module.exports = {
  getRoom,
  joinRoom,
  leaveRoom,
  getUserName,
  getUserCount,
  addStrokeStart,
  addStrokePoints,
  addStrokeEnd,
  addElement,
  updateElement,
  deleteElement,
  setRoomStrokes,
  clearRoom,
  addAiMessage,
  getAiHistory,
  isAiInFlight,
  setAiInFlight,
  getLastAiTime,
  setLastAiTime,
  getUserSlot,
  roomExists,
  generateRoomId,
};
