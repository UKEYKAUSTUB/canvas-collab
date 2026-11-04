<div align="center">

# 🎨 Canvas Collab

**Draw together in real time, talk face to face, and learn with an AI tutor beside you.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-6366f1?style=for-the-badge)](https://canvas-collab-sooty.vercel.app/)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

[Live Demo](https://canvas-collab-sooty.vercel.app/) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## ✨ Overview

Canvas Collab is a real-time collaborative whiteboard for two people. Create a room, share the 6-character code, and start drawing together. A live video call and a shared AI tutor sit in the same room, so you can plan, study, brainstorm, or teach without switching tabs.

## 🚀 Features

- **Real-time whiteboard:** strokes sync instantly between both users using Socket.IO.
- **Drawing tools:** six colors, three brush sizes, pen, eraser, and clear board.
- **Resolution-independent canvas:** normalized coordinates keep drawings correct on any screen size.
- **Live video calling:** peer-to-peer audio and video using WebRTC, with mic and camera toggles that sync to the other user.
- **Draggable video panel:** move the call window anywhere on the board.
- **Shared AI helper:** ask questions by typing or by voice. Answers appear for everyone in the room.
- **Rich AI answers:** Markdown, code blocks, and LaTeX math rendering.
- **Room system:** unique 6-character room codes, a 2-user limit, and state restored for late joiners.
- **Responsive UI:** works on desktop and mobile.

## 🛠️ Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Lucide Icons |
| Backend | Node.js, Express, Socket.IO |
| Real-time video | WebRTC (custom signaling over Socket.IO, STUN) |
| AI | Groq API (Llama 3.3 70B) |
| Rendering | react-markdown, remark-gfm, remark-math, KaTeX |
| Voice input | Web Speech API |
| Deployment | Vercel |

## 🧩 How It Works

```
 User A ──┐                              ┌── User B
          │      Socket.IO (strokes,     │
          ├────► signaling, AI events) ◄─┤
          │              │               │
          │         Node + Express       │
          │              │               │
          │         Groq LLM API         │
          │                              │
          └────────── WebRTC ────────────┘
                (peer-to-peer video)
```

1. A user creates a room and the server generates a unique code.
2. The second user joins with that code.
3. Drawing events are relayed through Socket.IO and stored per room.
4. The newcomer's browser starts the WebRTC handshake, with the server only relaying signaling messages.
5. AI questions are sent to the server, forwarded to Groq, and the answer is broadcast to the room.

## 📁 Project Structure

```
canvas-collab/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # Home, Hero, Room, Board, Toolbar, VideoPanel, AIPanel
│       ├── hooks/           # useWebRTC, useSpeechRecognition
│       └── socket.js
├── server/                  # Node + Express + Socket.IO backend
│   ├── index.js
│   ├── rooms.js
│   └── ai.js
└── .env                     # GROQ_API_KEY (not committed)
```

## ⚙️ Getting Started

### Prerequisites

- Node.js 18 or higher
- A free [Groq API key](https://console.groq.com/)

### 1. Clone the repository

```bash
git clone https://github.com/UKEYKAUSTUB/canvas-collab.git
cd canvas-collab
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### 3. Start the backend

```bash
cd server
npm install
node index.js
```

The server runs on `http://localhost:4000`.

### 4. Start the frontend

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

### 5. Try it

Open the app in two browser windows. Create a room in one, join it with the code in the other, and allow camera and microphone access.

## 🤝 Contributing

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Commit your changes: `git commit -m "Add your feature"`
3. Push the branch: `git push origin feature/your-feature-name`
4. Open a Pull Request

## 🗺️ Roadmap

- [ ] Shapes and text tool
- [ ] Undo and redo
- [ ] Export board as an image
- [ ] Support for more than two users
- [ ] TURN server for stricter networks

## 👥 Contributors

- [Kaustubh Ukey](https://github.com/UKEYKAUSTUB)
- [Aditya Patil](https://github.com/Aditya-Patil15604)

---

<div align="center">

⭐ If you like this project, give it a star.

</div>
