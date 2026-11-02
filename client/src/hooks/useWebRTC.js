import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      import.meta.env.VITE_TURN_URL_UDP,
      import.meta.env.VITE_TURN_URL_TCP,
      import.meta.env.VITE_TURN_URL_TLS,
    ].filter(Boolean),
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  },
];

const MEDIA_CONSTRAINTS = {
  audio: { echoCancellation: true, noiseSuppression: true },
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
};

export function useWebRTC({ name, roomId, socket }) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ micOn: true, cameraOn: true });
  const [mediaError, setMediaError] = useState(null);

  // ─── Flush queued ICE candidates ───────────────────────────────────────────
  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingCandidatesRef.current.splice(0);
    for (const c of queued) {
      try { await pc.addIceCandidate(c); } catch (_) {}
    }
  }, []);

  // ─── Build a fresh RTCPeerConnection ───────────────────────────────────────
  const createPC = useCallback((stream) => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    remoteDescSetRef.current = false;
    pendingCandidatesRef.current = [];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    if (stream) {
      // Add all local tracks
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    // Remote track → remoteRef video element
    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0];
      }
    };

    // ICE candidate ready → relay to peer
    pc.onicecandidate = (e) => {
      if (e.candidate && remoteSocketIdRef.current) {
        socket.emit('webrtc-ice-candidate', {
          candidate: e.candidate,
          to: remoteSocketIdRef.current,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setIsConnected(state === 'connected');
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setIsConnected(false);
        if (remoteRef.current) remoteRef.current.srcObject = null;
      }
    };

    return pc;
  }, [socket]);

  // ─── Create and send offer (called by the existing user) ──────────────────
  const makeOffer = useCallback(async (toSocketId) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { sdp: pc.localDescription, to: toSocketId });
    } catch (err) {
      console.error('makeOffer failed:', err);
    }
  }, [socket]);

  // ─── Main effect: register socket listeners first, then acquire media ─────
  useEffect(() => {
    let active = true;
    let resolveReady;
    const mediaReady = new Promise((resolve) => {
      resolveReady = resolve;
    });

    function sendMyMediaState(to) {
      const s = localStreamRef.current;
      socket.emit('media-state', {
        micOn: !!s?.getAudioTracks()[0]?.enabled,
        cameraOn: !!s?.getVideoTracks()[0]?.enabled,
        to,
      });
    }

    // Existing user: a newcomer is ready → become the offerer
    async function onUserJoined({ socketId }) {
      await mediaReady;
      if (!active) return;
      remoteSocketIdRef.current = socketId;
      createPC(localStreamRef.current);
      sendMyMediaState(socketId);
      await makeOffer(socketId);
    }

    // Newcomer: receive the offer, send the answer
    async function onOffer({ sdp, from }) {
      await mediaReady;
      if (!active) return;
      remoteSocketIdRef.current = from;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { sdp: pc.localDescription, to: from });
        sendMyMediaState(from);
      } catch (err) {
        console.error('onOffer failed:', err);
      }
    }

    // Offerer: receive the answer
    async function onAnswer({ sdp }) {
      await mediaReady;
      if (!active) return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
      } catch (err) {
        console.error('onAnswer failed:', err);
      }
    }

    // ICE candidate from peer
    async function onIceCandidate({ candidate }) {
      await mediaReady;
      if (!active || !candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!remoteDescSetRef.current) {
        pendingCandidatesRef.current.push(new RTCIceCandidate(candidate));
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
      }
    }

    // Remote user toggled mic or camera
    function onMediaState({ micOn: m, cameraOn: c }) {
      if (!active) return;
      setRemoteMediaState({ micOn: m, cameraOn: c });
    }

    // Listeners go live immediately (before we wait for camera/mic)
    socket.on('user-joined', onUserJoined);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice-candidate', onIceCandidate);
    socket.on('media-state', onMediaState);

    async function init() {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      } catch (err) {
        // Camera busy or denied → try audio only before giving up
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: MEDIA_CONSTRAINTS.audio,
          });
          if (active) setCameraOn(false);
        } catch (err2) {
          if (active) setMediaError(`Camera/mic unavailable (${err2.name}). Whiteboard still works.`);
        }
      }

      if (!active) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        resolveReady();
        return;
      }

      localStreamRef.current = stream;
      if (stream && localRef.current) {
        localRef.current.srcObject = stream;
      }

      createPC(stream);
      resolveReady();
      socket.emit('call-ready'); // tell the other user we can receive an offer now
    }

    init();

    return () => {
      active = false;
      resolveReady();

      socket.off('user-joined', onUserJoined);
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice-candidate', onIceCandidate);
      socket.off('media-state', onMediaState);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localRef.current) localRef.current.srcObject = null;
      if (remoteRef.current) remoteRef.current.srcObject = null;

      remoteSocketIdRef.current = null;
      pendingCandidatesRef.current = [];
      remoteDescSetRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Media toggles ────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const next = !micOn;
    audioTrack.enabled = next;
    setMicOn(next);
    if (remoteSocketIdRef.current) {
      socket.emit('media-state', { micOn: next, cameraOn, to: remoteSocketIdRef.current });
    }
  }, [micOn, cameraOn, socket]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const next = !cameraOn;
    videoTrack.enabled = next;
    setCameraOn(next);
    if (remoteSocketIdRef.current) {
      socket.emit('media-state', { micOn, cameraOn: next, to: remoteSocketIdRef.current });
    }
  }, [cameraOn, micOn, socket]);

  return {
    localRef,
    remoteRef,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    remoteMediaState,
    isConnected,
    mediaError,
  };
}
