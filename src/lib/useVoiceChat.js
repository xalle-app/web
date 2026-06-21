import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turns:xalle.emris-host.ru:5349",              username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:xalle.emris-host.ru:3478?transport=tcp", username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:93.185.159.89:3478",                     username: "xalle", credential: "turn_secret_2024" },
];

// Good audio constraints: mono, echo/noise cancellation on
const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  },
  video: false,
};

function sendWs(payload) {
  window.dispatchEvent(new CustomEvent("app:ws:send", { detail: payload }));
}

// Speaking detection: poll analyser at 100ms intervals (not RAF)
function makeSpeakDetector(stream, onSpeaking) {
  let ctx, interval;
  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    interval = setInterval(() => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 2; i <= 20; i++) sum += buf[i];
      onSpeaking(sum / 19 > 12);
    }, 100);
  } catch {}

  return () => {
    clearInterval(interval);
    try { ctx?.close(); } catch {}
  };
}

export function useVoiceChat(myUserId) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peersState, setPeersState] = useState([]);
  const [error, setError] = useState(null);

  const pcsRef = useRef(new Map());        // userId → RTCPeerConnection
  const streamRef = useRef(null);          // local MediaStream
  const stopLocalDetectRef = useRef(null); // cleanup fn for local speak detector
  // per-peer audio cleanup fns
  const peerAudioCleanupRef = useRef(new Map()); // userId → cleanup fn
  const muteRef = useRef(false);
  const activeRef = useRef(false);

  const cleanupPeer = useCallback((userId) => {
    const pc = pcsRef.current.get(userId);
    if (pc) { pc.close(); pcsRef.current.delete(userId); }

    const cleanup = peerAudioCleanupRef.current.get(userId);
    if (cleanup) { cleanup(); peerAudioCleanupRef.current.delete(userId); }

    const el = document.getElementById(`voice-audio-${userId}`);
    if (el) el.remove();

    setPeersState(prev => prev.filter(p => p.userId !== userId));
  }, []);

  const createPeer = useCallback((targetId, isOfferer) => {
    // Don't create duplicate
    if (pcsRef.current.has(targetId)) return pcsRef.current.get(targetId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(targetId, pc);

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        pc.addTrack(track, streamRef.current);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) sendWs({ type: "voice:ice", targetId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        cleanupPeer(targetId);
      }
    };

    // ontrack fires once per track; guard so we only set up audio once per peer
    let audioSetup = false;
    pc.ontrack = (e) => {
      if (audioSetup) return;
      audioSetup = true;

      const remoteStream = e.streams[0] || new MediaStream([e.track]);

      // Audio element for playback
      let el = document.getElementById(`voice-audio-${targetId}`);
      if (!el) {
        el = document.createElement("audio");
        el.id = `voice-audio-${targetId}`;
        el.autoplay = true;
        el.setAttribute("playsinline", "");
        document.body.appendChild(el);
      }
      el.srcObject = remoteStream;

      // Speaking detection for this peer (100ms polling, one context total)
      const stopDetect = makeSpeakDetector(remoteStream, (isSpeaking) => {
        setPeersState(prev => {
          const exists = prev.find(p => p.userId === targetId);
          if (!exists) return [...prev, { userId: targetId, speaking: isSpeaking }];
          if (exists.speaking === isSpeaking) return prev;
          return prev.map(p => p.userId === targetId ? { ...p, speaking: isSpeaking } : p);
        });
      });
      peerAudioCleanupRef.current.set(targetId, stopDetect);
    };

    if (isOfferer) {
      // Small delay to ensure tracks are added before negotiation
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          sendWs({ type: "voice:offer", targetId, sdp: pc.localDescription });
        } catch {}
      }, 50);
    }

    return pc;
  }, [cleanupPeer]);

  const join = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      streamRef.current = stream;
      muteRef.current = false;
      setMuted(false);

      const stopDetect = makeSpeakDetector(stream, setSpeaking);
      stopLocalDetectRef.current = stopDetect;

      sendWs({ type: "voice:join" });
    } catch (err) {
      setError(err.name === "NotAllowedError" ? "mic_denied" : "mic_error");
    }
  }, []);

  const leave = useCallback(() => {
    if (!activeRef.current) return;
    sendWs({ type: "voice:leave" });

    for (const [uid] of [...pcsRef.current]) cleanupPeer(uid);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (stopLocalDetectRef.current) {
      stopLocalDetectRef.current();
      stopLocalDetectRef.current = null;
    }

    setSpeaking(false);
    setPeersState([]);
    activeRef.current = false;
    setActive(false);
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const next = !muteRef.current;
    muteRef.current = next;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }, []);

  useEffect(() => {
    const handler = async (e) => {
      const m = e.detail;
      if (!m?.type) return;

      if (m.type === "voice:joined") {
        activeRef.current = true;
        setActive(true);
        // Offer to all existing peers
        for (const peerId of (m.peers || [])) {
          if (peerId === myUserId) continue;
          setPeersState(prev => prev.find(p => p.userId === peerId) ? prev : [...prev, { userId: peerId, speaking: false }]);
          createPeer(peerId, true);
        }
      }

      if (m.type === "voice:user-joined") {
        if (m.userId === myUserId || !activeRef.current) return;
        // They will send us an offer; just register slot
        setPeersState(prev => prev.find(p => p.userId === m.userId) ? prev : [...prev, { userId: m.userId, speaking: false }]);
        createPeer(m.userId, false);
      }

      if (m.type === "voice:user-left") {
        cleanupPeer(m.userId);
      }

      if (m.type === "voice:offer") {
        const peerId = m.fromId;
        let pc = pcsRef.current.get(peerId);
        if (!pc) {
          setPeersState(prev => prev.find(p => p.userId === peerId) ? prev : [...prev, { userId: peerId, speaking: false }]);
          pc = createPeer(peerId, false);
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWs({ type: "voice:answer", targetId: peerId, sdp: pc.localDescription });
        } catch {}
      }

      if (m.type === "voice:answer") {
        const pc = pcsRef.current.get(m.fromId);
        if (pc && pc.signalingState !== "stable") {
          try { await pc.setRemoteDescription(new RTCSessionDescription(m.sdp)); } catch {}
        }
      }

      if (m.type === "voice:ice") {
        const pc = pcsRef.current.get(m.fromId);
        if (pc && m.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(m.candidate)); } catch {}
        }
      }

      if (m.type === "voice:error") {
        setError(m.code || "error");
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        if (stopLocalDetectRef.current) { stopLocalDetectRef.current(); stopLocalDetectRef.current = null; }
      }
    };

    window.addEventListener("voice:ws:msg", handler);
    return () => window.removeEventListener("voice:ws:msg", handler);
  }, [myUserId, createPeer, cleanupPeer]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (activeRef.current) leave();
  }, [leave]);

  return { active, muted, speaking, peersState, error, join, leave, toggleMute };
}
