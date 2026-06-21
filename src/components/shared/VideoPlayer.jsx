import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({ src, className = "", poster }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const hideTimer = useRef(null);
  const containerRef = useRef(null);

  const show = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 2800);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const toggle = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    show();
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    setProgress(v.duration ? v.currentTime / v.duration : 0);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
  };

  const onSeek = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    v.currentTime = frac * v.duration;
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    show();
  };

  const onVolumeChange = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    const val = parseFloat(e.target.value);
    if (v) { v.volume = val; v.muted = val === 0; }
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleFullscreen = (e) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`vp-wrap ${className}`}
      onMouseMove={show}
      onMouseEnter={show}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      onTouchStart={show}
      onClick={toggle}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="vp-video"
        playsInline
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Big center play button (when paused) */}
      {!playing && (
        <div className="vp-center-play">
          <Play size={36} fill="currentColor" />
        </div>
      )}

      {/* Controls overlay */}
      <div className={`vp-controls ${showControls || !playing ? "vp-controls-visible" : ""}`}
        onClick={e => e.stopPropagation()}>
        {/* Progress bar */}
        <div className="vp-progress" onClick={onSeek}>
          <div className="vp-buf" style={{ width: `${buffered * 100}%` }} />
          <div className="vp-fill" style={{ width: `${progress * 100}%` }} />
          <div className="vp-thumb" style={{ left: `${progress * 100}%` }} />
        </div>

        <div className="vp-bottom-row">
          <button className="vp-btn" onClick={toggle}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <span className="vp-time">{fmt(currentTime)} / {fmt(duration)}</span>
          <div className="vp-spacer" />
          <div className="vp-vol-group" onClick={e => e.stopPropagation()}>
            <button className="vp-btn" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={onVolumeChange} className="vp-vol-input" />
          </div>
          <button className="vp-btn" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
