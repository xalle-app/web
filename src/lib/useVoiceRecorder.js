import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(100);
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (e) {
      setError(e.name === "NotAllowedError" ? "mic_denied" : "error");
    }
  }, []);

  const stop = useCallback(() => new Promise(resolve => {
    if (!mediaRef.current) return resolve(null);
    clearInterval(timerRef.current);
    const rec = mediaRef.current;
    rec.onstop = () => {
      rec.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType });
      mediaRef.current = null;
      setRecording(false);
      setDuration(0);
      resolve(blob);
    };
    rec.stop();
  }), []);

  const cancel = useCallback(() => {
    if (!mediaRef.current) return;
    clearInterval(timerRef.current);
    const rec = mediaRef.current;
    rec.onstop = () => { rec.stream.getTracks().forEach(t => t.stop()); };
    rec.stop();
    mediaRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
  }, []);

  return { recording, duration, error, start, stop, cancel };
}
