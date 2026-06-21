import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turns:xalle.emris-host.ru:5349",              username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:xalle.emris-host.ru:3478?transport=tcp", username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:93.185.159.89:3478",                     username: "xalle", credential: "turn_secret_2024" },
];

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

function sendWs(payload) {
  window.dispatchEvent(new CustomEvent("app:ws:send", { detail: payload }));
}

// Улучшить качество Opus: 128kbps, стерео отключено (голос), DTX выключен
function setOpusParams(sdp) {
  return sdp
    .replace(/a=fmtp:(\d+) (.*useinbandfec=1.*)/g, (_, pt, rest) => {
      const params = rest
        .replace(/maxaveragebitrate=\d+/, "")
        .replace(/stereo=\d+/, "")
        .replace(/sprop-stereo=\d+/, "")
        .replace(/cbr=\d+/, "")
        .trim()
        .replace(/;+/g, ";")
        .replace(/;$/, "");
      return `a=fmtp:${pt} ${params};maxaveragebitrate=128000;stereo=0;useinbandfec=1;cbr=0`;
    });
}

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
  return () => { clearInterval(interval); try { ctx?.close(); } catch {} };
}

export function useVoiceCall(myUserId) {
  const [state, setState] = useState({
    active: false, muted: false, speaking: false, sharing: false,
    callCode: null, members: [], peers: [], remoteSharingUserId: null,
    incomingCall: null, // { code, callerName, callerAvatar, callerId }
  });

  const pcsRef = useRef(new Map());       // audio PCs
  const screenPcsRef = useRef(new Map()); // screen share PCs
  const streamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteScreenStreamRef = useRef(null);
  const stopLocalDetectRef = useRef(null);
  const peerAudioCleanupRef = useRef(new Map());
  const muteRef = useRef(false);
  const activeRef = useRef(false);
  const membersRef = useRef([]);
  const speakingMapRef = useRef(new Map());

  const setSpeaking = useCallback((v) => setState(s => s.speaking === v ? s : { ...s, speaking: v }), []);

  const updateMembers = useCallback((members) => {
    membersRef.current = members;
    setState(s => ({ ...s, members }));
  }, []);

  const cleanupPeer = useCallback((userId) => {
    const pc = pcsRef.current.get(userId);
    if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(userId); }
    const cleanup = peerAudioCleanupRef.current.get(userId);
    if (cleanup) { cleanup(); peerAudioCleanupRef.current.delete(userId); }
    const el = document.getElementById(`vcall-audio-${userId}`);
    if (el) el.remove();
    // Also cleanup screen PC for this peer
    const spc = screenPcsRef.current.get(userId);
    if (spc) { try { spc.close(); } catch {} screenPcsRef.current.delete(userId); }
    setState(s => ({
      ...s,
      peers: Array.isArray(s.peers) ? s.peers.filter(id => id !== userId) : [],
      remoteSharingUserId: s.remoteSharingUserId === userId ? null : s.remoteSharingUserId,
    }));
  }, []);

  const createPeer = useCallback((targetId, isOfferer) => {
    if (pcsRef.current.has(targetId)) return pcsRef.current.get(targetId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(targetId, pc);

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        pc.addTrack(track, streamRef.current);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) sendWs({ type: "vcall:ice", targetId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") cleanupPeer(targetId);
    };

    let audioSetup = false;
    pc.ontrack = (e) => {
      if (audioSetup) return;
      audioSetup = true;
      const remoteStream = e.streams[0] || new MediaStream([e.track]);

      let el = document.getElementById(`vcall-audio-${targetId}`);
      if (!el) {
        el = document.createElement("audio");
        el.id = `vcall-audio-${targetId}`;
        el.autoplay = true;
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        document.body.appendChild(el);
      }
      el.srcObject = remoteStream;
      // Явный play() — Android WebView блокирует autoplay
      el.play().catch(() => {
        // Если заблокировано — пробуем после любого пользовательского жеста
        const resume = () => { el.play().catch(() => {}); document.removeEventListener("click", resume); document.removeEventListener("touchend", resume); };
        document.addEventListener("click", resume, { once: true });
        document.addEventListener("touchend", resume, { once: true });
      });

      const stopDetect = makeSpeakDetector(remoteStream, (speaking) => {
        speakingMapRef.current.set(targetId, speaking);
        setState(s => ({ ...s, _t: Date.now() }));
      });
      peerAudioCleanupRef.current.set(targetId, stopDetect);
    };

    if (isOfferer) {
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          // Принудительно ставим Opus с максимальным битрейтом
          const sdp = setOpusParams(offer.sdp);
          await pc.setLocalDescription({ type: offer.type, sdp });
          sendWs({ type: "vcall:offer", targetId, sdp: pc.localDescription });
        } catch {}
      }, 80);
    }

    return pc;
  }, [cleanupPeer]);

  // ── Screen sharing ────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    for (const [peerId, pc] of screenPcsRef.current) {
      try { pc.close(); } catch {}
      sendWs({ type: "vcall:screen-stop", targetId: peerId });
    }
    screenPcsRef.current.clear();
    setState(s => ({ ...s, sharing: false }));
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setState(s => ({ ...s, sharing: true }));

      for (const [peerId] of pcsRef.current) {
        const spc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        screenPcsRef.current.set(peerId, spc);

        for (const track of stream.getTracks()) spc.addTrack(track, stream);

        spc.onicecandidate = e => {
          if (e.candidate) sendWs({ type: "vcall:screen-ice", targetId: peerId, candidate: e.candidate });
        };

        try {
          const offer = await spc.createOffer();
          await spc.setLocalDescription(offer);
          sendWs({ type: "vcall:screen-offer", targetId: peerId, sdp: spc.localDescription });
        } catch {}
      }

      // Auto-stop when user clicks "Stop sharing" in browser UI
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (e) {
      if (e.name !== "NotAllowedError") console.error(e);
    }
  }, [stopScreenShare]);

  const getMicStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error("MediaDevices API not available"), { name: "NotSupportedError" });
    }
    return navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
  };

  const pendingTargetRef = useRef(null);

  const startCall = useCallback(async (targetId = null) => {
    if (activeRef.current) return null;
    setState(s => ({ ...s, error: null }));
    try {
      const stream = await getMicStream();
      streamRef.current = stream;
      muteRef.current = false;
      stopLocalDetectRef.current = makeSpeakDetector(stream, setSpeaking);
      pendingTargetRef.current = targetId;
      sendWs({ type: "vcall:create" });
      return true;
    } catch (err) {
      console.error("[vcall] startCall error:", err.name, err.message);
      const code = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "mic_denied"
        : err.name === "NotSupportedError" ? "mic_unavailable" : "mic_error";
      setState(s => ({ ...s, error: code }));
      return false;
    }
  }, [setSpeaking]);

  const declineIncomingCall = useCallback(() => {
    setState(s => ({ ...s, incomingCall: null }));
  }, []);

  const joinCall = useCallback(async (code) => {
    if (activeRef.current) return null;
    setState(s => ({ ...s, error: null }));
    try {
      const stream = await getMicStream();
      streamRef.current = stream;
      muteRef.current = false;
      stopLocalDetectRef.current = makeSpeakDetector(stream, setSpeaking);
      sendWs({ type: "vcall:join", code });
      return true;
    } catch (err) {
      console.error("[vcall] joinCall error:", err.name, err.message);
      const errCode = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "mic_denied"
        : err.name === "NotSupportedError" ? "mic_unavailable" : "mic_error";
      setState(s => ({ ...s, error: errCode }));
      return false;
    }
  }, [setSpeaking]);

  const leaveCall = useCallback(() => {
    if (!activeRef.current) return;
    sendWs({ type: "vcall:leave" });
    for (const [uid] of [...pcsRef.current]) cleanupPeer(uid);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (stopLocalDetectRef.current) { stopLocalDetectRef.current(); stopLocalDetectRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    for (const [, pc] of screenPcsRef.current) { try { pc.close(); } catch {} }
    screenPcsRef.current.clear();
    remoteScreenStreamRef.current = null;
    speakingMapRef.current.clear();
    activeRef.current = false;
    setState({ active: false, muted: false, speaking: false, sharing: false, callCode: null, members: [], peers: [], remoteSharingUserId: null, incomingCall: null });
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const next = !muteRef.current;
    muteRef.current = next;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setState(s => ({ ...s, muted: next }));
  }, []);

  useEffect(() => {
    const handler = async (e) => {
      const m = e.detail;
      if (!m?.type) return;

      if (m.type === "vcall:created" || m.type === "vcall:joined") {
        activeRef.current = true;
        const peers = m.peers || [];
        setState(s => ({ ...s, active: true, callCode: m.code, members: m.members || [], peers, incomingCall: null }));
        membersRef.current = m.members || [];
        for (const peerId of peers) {
          if (peerId !== myUserId) createPeer(peerId, true);
        }
        // Send invite if this was a direct call (startCall(targetId))
        if (m.type === "vcall:created" && pendingTargetRef.current) {
          sendWs({ type: "vcall:invite", targetId: pendingTargetRef.current, code: m.code });
          pendingTargetRef.current = null;
        }
      }

      if (m.type === "vcall:incoming") {
        // Incoming call from another user
        if (activeRef.current) return; // already in a call
        setState(s => ({ ...s, incomingCall: { code: m.code, callerName: m.fromName, callerAvatar: m.fromAvatar, callerId: m.fromId } }));
      }

      if (m.type === "vcall:user-joined") {
        if (m.userId === myUserId || !activeRef.current) return;
        updateMembers(m.members || []);
        setState(s => ({ ...s, peers: [...new Set([...s.peers, m.userId])] }));
        createPeer(m.userId, false);
      }

      if (m.type === "vcall:user-left") {
        updateMembers(m.members || []);
        setState(s => ({ ...s, peers: s.peers.filter(id => id !== m.userId) }));
        cleanupPeer(m.userId);
        speakingMapRef.current.delete(m.userId);
      }

      if (m.type === "vcall:offer") {
        if (!activeRef.current) return;
        const peerId = m.fromId;
        let pc = pcsRef.current.get(peerId);
        if (!pc) {
          setState(s => ({ ...s, peers: [...new Set([...s.peers, peerId])] }));
          pc = createPeer(peerId, false);
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWs({ type: "vcall:answer", targetId: peerId, sdp: pc.localDescription });
        } catch {}
      }

      if (m.type === "vcall:answer") {
        const pc = pcsRef.current.get(m.fromId);
        if (pc && pc.signalingState !== "stable") {
          try { await pc.setRemoteDescription(new RTCSessionDescription(m.sdp)); } catch {}
        }
      }

      if (m.type === "vcall:ice") {
        const pc = pcsRef.current.get(m.fromId);
        if (pc && m.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(m.candidate)); } catch {}
        }
      }

      // ── Screen share signaling ────────────────────────────────

      if (m.type === "vcall:screen-offer") {
        const peerId = m.fromId;
        let spc = screenPcsRef.current.get(peerId);
        if (!spc) {
          spc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          screenPcsRef.current.set(peerId, spc);
          spc.onicecandidate = e => {
            if (e.candidate) sendWs({ type: "vcall:screen-ice", targetId: peerId, candidate: e.candidate });
          };
          spc.ontrack = e => {
            const stream = e.streams[0] || new MediaStream([e.track]);
            remoteScreenStreamRef.current = stream;
            setState(s => ({ ...s, remoteSharingUserId: peerId }));
          };
        }
        try {
          await spc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          const answer = await spc.createAnswer();
          await spc.setLocalDescription(answer);
          sendWs({ type: "vcall:screen-answer", targetId: peerId, sdp: spc.localDescription });
        } catch {}
      }

      if (m.type === "vcall:screen-answer") {
        const spc = screenPcsRef.current.get(m.fromId);
        if (spc && spc.signalingState !== "stable") {
          try { await spc.setRemoteDescription(new RTCSessionDescription(m.sdp)); } catch {}
        }
      }

      if (m.type === "vcall:screen-ice") {
        const spc = screenPcsRef.current.get(m.fromId);
        if (spc && m.candidate) {
          try { await spc.addIceCandidate(new RTCIceCandidate(m.candidate)); } catch {}
        }
      }

      if (m.type === "vcall:screen-stop") {
        const spc = screenPcsRef.current.get(m.fromId);
        if (spc) { try { spc.close(); } catch {} screenPcsRef.current.delete(m.fromId); }
        remoteScreenStreamRef.current = null;
        setState(s => ({ ...s, remoteSharingUserId: null }));
      }

      if (m.type === "vcall:error") {
        setState(s => ({ ...s, error: m.code || "error" }));
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (stopLocalDetectRef.current) { stopLocalDetectRef.current(); stopLocalDetectRef.current = null; }
        activeRef.current = false;
      }
    };

    window.addEventListener("vcall:ws:msg", handler);
    return () => window.removeEventListener("vcall:ws:msg", handler);
  }, [myUserId, createPeer, cleanupPeer, updateMembers]);

  useEffect(() => () => { if (activeRef.current) leaveCall(); }, [leaveCall]);

  return {
    ...state,
    speakingMap: speakingMapRef.current,
    remoteScreenStream: remoteScreenStreamRef,
    startCall, joinCall, leaveCall, toggleMute,
    startScreenShare, stopScreenShare, declineIncomingCall,
  };
}
