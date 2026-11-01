import { useState, useEffect } from 'react';

const PATH = 'M20 130 C 90 20, 150 20, 210 105 S 330 190, 400 105 S 510 30, 580 115';
const DUR = '6s';
const SPLINE = '0.45 0 0.55 1; 0 0 1 1';

function RotatingWord({ words, delay = 0, interval = 2500, className = '' }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => setI((p) => (p + 1) % words.length), interval);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [words.length, delay, interval]);

  // key forces a remount, which restarts the fade-in animation
  return (
    <span key={i} className={`word-in inline-block ${className}`}>
      {words[i]}
    </span>
  );
}

const TAGLINES = [
  'Study together, share ideas, and learn smarter with your personal AI tutor.',
  'Collaborate in real time with an interactive whiteboard, live video, and AI-powered assistance.',
  'Connect with peers, collaborate on a shared canvas, and get instant guidance from an AI tutor.',
  'Bring real-time communication, interactive learning, and AI-powered guidance into one space.',
];

function RotatingLine({ lines, interval = 7000 }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((p) => (p + 1) % lines.length), interval);
    return () => clearInterval(timer);
  }, [lines.length, interval]);

  // key remounts the span, restarting the word-in fade animation
  return (
    <span key={i} className="word-in block">
      {lines[i]}
    </span>
  );
}

export default function Hero() {
  return (
    <div className="flex flex-col justify-center items-start max-w-xl w-full px-10">
      {/* ── Pencil + curvy line ── */}
      <svg viewBox="0 0 600 220" className="w-full h-auto mb-8" fill="none">
        <path
          d={PATH}
          pathLength="1"
          stroke="#6366f1"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="1 1"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="1;0;0"
            keyTimes="0;0.65;1"
            calcMode="spline"
            keySplines={SPLINE}
            dur={DUR}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;1;0"
            keyTimes="0;0.85;1"
            dur={DUR}
            repeatCount="indefinite"
          />
        </path>

        {/* Pencil: tip sits at (0,0) so it follows the line exactly */}
        <g>
          <animateMotion
            path={PATH}
            keyPoints="0;1;1"
            keyTimes="0;0.65;1"
            calcMode="spline"
            keySplines={SPLINE}
            dur={DUR}
            repeatCount="indefinite"
          />
          <g transform="rotate(40) scale(1.1)">
            <animate
              attributeName="opacity"
              values="1;1;0;0"
              keyTimes="0;0.65;0.75;1"
              dur={DUR}
              repeatCount="indefinite"
            />
            <polygon points="0,0 -5,-14 5,-14" fill="#f5d9a8" />
            <polygon points="0,0 -1.8,-5 1.8,-5" fill="#374151" />
            <rect x="-5" y="-58" width="10" height="44" fill="#6366f1" />
            <rect x="-5" y="-64" width="10" height="6" fill="#9ca3af" />
            <rect x="-5" y="-72" width="10" height="8" rx="2" fill="#f9a8d4" />
          </g>
        </g>
      </svg>

        {/* ── Headline ── */}
      <h2 className="text-2xl xl:text-3xl font-bold text-gray-800 leading-snug min-h-[7rem] xl:min-h-[11rem]">
        <RotatingLine lines={TAGLINES} />
      </h2>
    </div>
  );
}