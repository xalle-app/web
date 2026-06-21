import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

function fmtDur(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return "—";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export default function VoiceMessage({ src, mine }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrent(a.currentTime);
      // WebM from MediaRecorder has Infinity duration; track real duration from currentTime
      if (!isFinite(a.duration) && a.currentTime > 0) {
        setDuration(prev => Math.max(prev, a.currentTime));
      }
    };
    const onDur = () => { if (isFinite(a.duration)) setDuration(a.duration); };
    const onEnd = () => {
      // currentTime at end = actual duration for Infinity-duration WebM
      setDuration(prev => (a.currentTime > 0 ? a.currentTime : prev));
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !duration || !isFinite(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = frac * duration;
    setCurrent(a.currentTime);
  };

  const progress = (duration && isFinite(duration)) ? current / duration : 0;

  return (
    <div className={`voice-msg${mine ? " voice-msg-mine" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="voice-msg-play" onClick={toggle}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="voice-msg-track" onClick={seek}>
        <div className="voice-msg-fill" style={{ width: `${progress * 100}%` }} />
        <div className="voice-msg-thumb" style={{ left: `${progress * 100}%` }} />
      </div>
      <span className="voice-msg-time">{playing ? fmtDur(current) : fmtDur(duration)}</span>
    </div>
  );
}
