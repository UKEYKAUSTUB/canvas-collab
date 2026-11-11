import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL_UDP || import.meta.env.VITE_TURN_URL_TCP
    ? [
        {
          urls: [
            import.meta.env.VITE_TURN_URL_UDP,
            import.meta.env.VITE_TURN_URL_TCP,
            import.meta.env.VITE_TURN_URL_TLS,
          ].filter(Boolean),
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
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
  const remoteStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const pendingLocalCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ micOn: true, cameraOn: true });
  const [mediaError, setMediaError] = useState(null);

  // ─── Attach local stream to video element whenever ready ───────────────────
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current.muted = true;
      localRef.current.play().catch(() => {});
    }
  }, [localStream, cameraOn]);

  // ─── Attach remote stream to video element whenever ready ──────────────────
  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
      remoteRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // ─── Flush queued ICE candidates received from peer ────────────────────────
  const flushPendingRemoteCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingRemoteCandidatesRef.current.splice(0);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (_) {}
    }
  }, []);

  // ─── Flush queued local ICE candidates to peer once socketId is known ─────
  const flushPendingLocalCandidates = useCallback(() => {
    if (!remoteSocketIdRef.current) return;
    const queued = pendingLocalCandidatesRef.current.splice(0);
    for (const candidate of queued) {
      socket.emit('webrtc-ice-candidate', {
        candidate,
        to: remoteSocketIdRef.current,
      });
    }
  }, [socket]);

  // ─── Build a fresh RTCPeerConnection ───────────────────────────────────────
  const createPC = useCallback(
    (stream) => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      remoteDescSetRef.current = false;
      pendingRemoteCandidatesRef.current = [];
      pendingLocalCandidatesRef.current = [];

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      // Handle incoming remote track
      pc.ontrack = (e) => {
        let incomingStream = e.streams && e.streams[0];
        if (!incomingStream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(e.track);
          incomingStream = remoteStreamRef.current;
        } else {
          remoteStreamRef.current = incomingStream;
        }

        setRemoteStream(incomingStream);
        if (remoteRef.current) {
          remoteRef.current.srcObject = incomingStream;
          remoteRef.current.play().catch(() => {});
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        if (remoteSocketIdRef.current) {
          socket.emit('webrtc-ice-candidate', {
            candidate: e.candidate,
            to: remoteSocketIdRef.current,
          });
        } else {
          pendingLocalCandidatesRef.current.push(e.candidate);
        }
      };

      const updateConnectionState = () => {
        const isConn =
          pc.connectionState === 'connected' ||
          pc.iceConnectionState === 'connected' ||
          pc.iceConnectionState === 'completed';

        setIsConnected(isConn);

        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          if (
            pc.iceConnectionState !== 'connected' &&
            pc.iceConnectionState !== 'completed'
          ) {
            setIsConnected(false);
            if (remoteRef.current) remoteRef.current.srcObject = null;
            setRemoteStream(null);
          }
        }
      };

      pc.onconnectionstatechange = updateConnectionState;
      pc.oniceconnectionstatechange = updateConnectionState;

      return pc;
    },
    [socket]
  );

  // ─── Create and send offer (called by existing user) ──────────────────────
  const makeOffer = useCallback(
    async (toSocketId) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { sdp: pc.localDescription, to: toSocketId });
      } catch (err) {
        console.error('makeOffer failed:', err);
      }
    },
    [socket]
  );

  // ─── Main media setup & WebRTC signaling effect ───────────────────────────
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

    // Existing user: newcomer joined → become the offerer
    async function onUserJoined({ socketId }) {
      await mediaReady;
      if (!active) return;
      remoteSocketIdRef.current = socketId;
      createPC(localStreamRef.current);
      flushPendingLocalCandidates();
      sendMyMediaState(socketId);
      await makeOffer(socketId);
    }

    // Newcomer: receive offer, send answer
    async function onOffer({ sdp, from }) {
      await mediaReady;
      if (!active) return;
      remoteSocketIdRef.current = from;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingRemoteCandidates();
        flushPendingLocalCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { sdp: pc.localDescription, to: from });
        sendMyMediaState(from);
      } catch (err) {
        console.error('onOffer failed:', err);
      }
    }

    // Offerer: receive answer
    async function onAnswer({ sdp }) {
      await mediaReady;
      if (!active) return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingRemoteCandidates();
        flushPendingLocalCandidates();
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
      if (!remoteDescSetRef.current || !pc.remoteDescription) {
        pendingRemoteCandidatesRef.current.push(new RTCIceCandidate(candidate));
      } else {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
    }

    // Remote user toggled mic or camera
    function onMediaState({ micOn: m, cameraOn: c }) {
      if (!active) return;
      setRemoteMediaState({ micOn: m, cameraOn: c });
    }

    // Register signaling listeners immediately
    socket.on('user-joined', onUserJoined);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice-candidate', onIceCandidate);
    socket.on('media-state', onMediaState);

    async function init() {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
        if (active) {
          setCameraOn(true);
          setMicOn(true);
          setMediaError(null);
        }
      } catch (err) {
        console.warn('Full video+audio getUserMedia failed:', err.name);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: MEDIA_CONSTRAINTS.audio,
          });
          if (active) {
            setCameraOn(false);
            setMicOn(true);
            setMediaError('Camera unavailable or in use by another tab. Microphone active.');
          }
        } catch (err2) {
          console.warn('Audio fallback getUserMedia failed:', err2.name);
          if (active) {
            setCameraOn(false);
            setMicOn(false);
            setMediaError(`Camera/mic permission denied or in use (${err2.name}).`);
          }
        }
      }

      if (!active) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        resolveReady();
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      if (stream && localRef.current) {
        localRef.current.srcObject = stream;
        localRef.current.muted = true;
        localRef.current.play().catch(() => {});
      }

      createPC(stream);
      resolveReady();
      socket.emit('call-ready');
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
      pendingRemoteCandidatesRef.current = [];
      pendingLocalCandidatesRef.current = [];
      remoteDescSetRef.current = false;
    };
  }, [createPC, flushPendingLocalCandidates, flushPendingRemoteCandidates, makeOffer, socket]);

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

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];

    // If video track exists, toggle enabled
    if (videoTrack) {
      const next = !cameraOn;
      videoTrack.enabled = next;
      setCameraOn(next);
      if (remoteSocketIdRef.current) {
        socket.emit('media-state', { micOn, cameraOn: next, to: remoteSocketIdRef.current });
      }
    } else if (!cameraOn) {
      // User didn't have video track earlier, try to re-acquire camera
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: MEDIA_CONSTRAINTS.video });
        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          stream.addTrack(newTrack);
          if (pcRef.current) {
            pcRef.current.addTrack(newTrack, stream);
          }
          setCameraOn(true);
          setLocalStream(stream);
          setMediaError(null);
          if (remoteSocketIdRef.current) {
            socket.emit('media-state', { micOn, cameraOn: true, to: remoteSocketIdRef.current });
          }
        }
      } catch (err) {
        setMediaError(`Could not access camera (${err.name}).`);
      }
    }
  }, [cameraOn, micOn, socket]);

  return {
    localRef,
    remoteRef,
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    remoteMediaState,
    isConnected,
    mediaError,
  };
}
