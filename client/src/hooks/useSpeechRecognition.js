import { useState, useRef, useCallback, useEffect } from 'react';

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognition);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition || listening) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }

    setTranscript('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setTranscript(text);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (_) {
      setListening(false);
    }
  }, [SpeechRecognition, listening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  return {
    supported,
    listening,
    start,
    stop,
    transcript,
  };
}
