import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Mic, MicOff, X, Sparkles } from 'lucide-react';
import socket from '../socket.js';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js';
import MarkdownMessage from './MarkdownMessage.jsx';

const SLOT_COLORS = [
  { bubble: 'bg-indigo-600', label: 'text-indigo-600' },
  { bubble: 'bg-emerald-600', label: 'text-emerald-600' },
];

export default function AIPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { supported, listening, start, stop, transcript } = useSpeechRecognition();
  const wasListeningRef = useRef(false);
  const messagesEndRef = useRef(null);

  // ─── Socket listeners for AI events ────────────────────────────────────────
  useEffect(() => {
    function onAiMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    function onAiThinking({ thinking: isThinking }) {
      setThinking(isThinking);
    }

    function onAiError({ message }) {
      setErrorMessage(message);
    }

    socket.on('ai-message', onAiMessage);
    socket.on('ai-thinking', onAiThinking);
    socket.on('ai-error', onAiError);

    return () => {
      socket.off('ai-message', onAiMessage);
      socket.off('ai-thinking', onAiThinking);
      socket.off('ai-error', onAiError);
    };
  }, []);

  // ─── Auto-scroll to newest message ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, thinking, isOpen]);

  // ─── Speech transcript handling ────────────────────────────────────────────
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // When speech recognition ends, automatically send the question
  useEffect(() => {
    if (wasListeningRef.current && !listening) {
      wasListeningRef.current = false;
      const textToSend = transcript.trim() || input.trim();
      if (textToSend) {
        socket.emit('ai-ask', { text: textToSend });
        setInput('');
      }
    } else if (listening) {
      wasListeningRef.current = true;
    }
  }, [listening, transcript, input]);

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  function handleSend(e) {
    e.preventDefault();
    if (listening) {
      stop();
    }
    const trimmed = input.trim();
    if (!trimmed || thinking) return;
    socket.emit('ai-ask', { text: trimmed });
    setInput('');
  }

  function handleMicToggle() {
    if (listening) {
      stop();
    } else {
      start();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed sm:absolute right-0 top-0 bottom-0 w-full sm:w-80 md:w-96 z-30 bg-white border-l border-gray-200 shadow-2xl flex flex-col
                 max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:right-0 max-sm:h-3/4 max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">AI Helper</h2>
            <p className="text-[11px] text-gray-400">Shared room tutor</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Messages List ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2">
              <Bot size={24} />
            </div>
            <p className="text-sm font-medium text-gray-700">Need a quick explanation?</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
              Type or speak a question. Answers are shared with everyone in this room.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const mine = isUser && msg.userId === socket.id;
          const c = SLOT_COLORS[(msg.slot ?? 0) % SLOT_COLORS.length];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
            >
              {isUser ? (
                <>
                  <span className={`text-[11px] font-medium mb-1 px-1 ${c.label}`}>
                    {msg.name || 'User'}{mine ? ' (you)' : ''}
                  </span>
                  <div
                    className={`${c.bubble} text-white rounded-2xl px-3.5 py-2 max-w-[85%] text-xs shadow-xs break-words ${
                      mine ? 'rounded-tr-xs' : 'rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-medium text-gray-500 mb-1 px-1 flex items-center gap-1">
                    <Bot size={12} /> AI Tutor
                  </span>
                  <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-xs px-3.5 py-2 max-w-[85%] text-xs shadow-xs border border-gray-200/60 break-words">
                    <MarkdownMessage text={msg.text} />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {thinking && (
          <div className="flex items-center gap-2 text-gray-500 text-xs px-3 py-1.5 bg-gray-50 rounded-xl w-fit animate-pulse border border-gray-100">
            <Bot size={14} className="text-indigo-500" />
            <span>Thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? 'Listening to your question…' : 'Ask a question…'}
            disabled={thinking}
            maxLength={500}
            className="flex-1 bg-transparent px-2 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
          />

          {supported && (
            <button
              type="button"
              onClick={handleMicToggle}
              title={listening ? 'Stop listening' : 'Speak question'}
              disabled={thinking}
              className={`p-1.5 rounded-lg transition ${
                listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
              }`}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="p-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition"
            title="Send question"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
