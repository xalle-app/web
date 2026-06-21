import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle, ChevronDown, X, Heart, Music } from "lucide-react";
import * as Player from "../../lib/player.js";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPlayer({ onOpenLibrary, token, onLikeChange, isListenGuest }) {
  const [state, setState] = useState(Player.getState());
  const [hidden, setHidden] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const volRef = useRef(null);
  const lastTrackId = useRef(null);

  useEffect(() => Player.subscribe(s => {
    setState(s);
    if (s.current?.id !== lastTrackId.current) {
      lastTrackId.current = s.current?.id ?? null;
      setLiked(!!s.current?.liked);
    }
  }), []);

  useEffect(() => {
    const h = (e) => {
      if (state.current && e.detail?.id === state.current.id) setLiked(e.detail.liked);
    };
    window.addEventListener("music:like-change", h);
    return () => window.removeEventListener("music:like-change", h);
  }, [state.current?.id]);

  // Auto-show player when new track starts
  useEffect(() => {
    if (state.current) setHidden(false);
  }, [state.current?.id]);

  const toggleLike = async () => {
    if (!state.current || !token || likeBusy) return;
    setLikeBusy(true);
    try {
      const res = await api(`/tracks/${state.current.id}/like`, { method: "POST", token });
      setLiked(res.liked);
      Player.patchCurrentLiked(res.liked);
      window.dispatchEvent(new CustomEvent("music:like-change", {
        detail: { id: state.current.id, liked: res.liked, track: state.current }
      }));
      onLikeChange?.(state.current.id, res.liked, state.current);
    } catch { }
    finally { setLikeBusy(false); }
  };

  if (!state.current) return null;

  const { current, playing, progress, currentTime, duration, volume, repeat, shuffle } = state;
  const nextRepeat = repeat === "none" ? "all" : repeat === "all" ? "one" : "none";

  // Floating restore pill (shown when player is hidden)
  if (hidden) {
    return (
      <div className="mp-float-pill" onClick={() => setHidden(false)} title="Открыть плеер">
        <div className="mp-float-art">
          {current.coverUrl
            ? <img src={assetUrl(current.coverUrl)} alt="" />
            : <Music size={14} />
          }
          {playing && <div className="mp-float-playing-dot" />}
        </div>
        <div className="mp-float-info">
          <div className="mp-float-title">{current.title}</div>
          {current.artist && <div className="mp-float-artist">{current.artist}</div>}
        </div>
        <button className="mp-float-play" onClick={e => { e.stopPropagation(); if (!isListenGuest) Player.toggle(); }}
          style={isListenGuest ? { opacity: 0.4, cursor: "default" } : {}}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>
    );
  }

  return (
    <div className="music-player">
      <div className="mp-track" onClick={onOpenLibrary} title="Открыть музыку">
        {current.coverUrl
          ? <img src={assetUrl(current.coverUrl)} className="mp-cover" alt={current.title} />
          : <div className="mp-cover mp-cover-placeholder">♪</div>
        }
        <div className="mp-info">
          <div className="mp-title">{current.title}</div>
          {current.artist && <div className="mp-artist">{current.artist}</div>}
        </div>
      </div>

      <div className="mp-center">
        <div className="mp-controls" style={isListenGuest ? { opacity: 0.4, pointerEvents: "none" } : {}}>
          <button className={`mp-btn mp-btn-sm ${shuffle ? "mp-btn-active" : ""}`} onClick={Player.toggleShuffle} title="Перемешать">
            <Shuffle size={15} />
          </button>
          <button className="mp-btn" onClick={Player.prev} title="Предыдущий">
            <SkipBack size={19} />
          </button>
          <button className="mp-play-btn" onClick={Player.toggle}>
            {playing ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <button className="mp-btn" onClick={Player.next} title="Следующий">
            <SkipForward size={19} />
          </button>
          <button className={`mp-btn mp-btn-sm ${repeat !== "none" ? "mp-btn-active" : ""}`} onClick={() => Player.setRepeat(nextRepeat)} title="Повтор">
            {repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>
        <div className="mp-progress-row">
          <span className="mp-time">{fmt(currentTime)}</span>
          <div className="mp-progress-bar" onClick={e => {
            if (isListenGuest) return;
            const rect = e.currentTarget.getBoundingClientRect();
            Player.seek((e.clientX - rect.left) / rect.width);
          }} style={isListenGuest ? { cursor: "default" } : {}}>
            <div className="mp-progress-fill" style={{ width: `${progress * 100}%` }} />
            <div className="mp-progress-thumb" style={{ left: `${progress * 100}%` }} />
          </div>
          <span className="mp-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* Mobile-only controls */}
      <div className="mp-mobile-controls" style={isListenGuest ? { opacity: 0.4, pointerEvents: "none" } : {}}>
        <button className="mp-btn" onClick={Player.prev}><SkipBack size={18} /></button>
        <button className="mp-play-btn" onClick={Player.toggle} style={{ width: 34, height: 34 }}>
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button className="mp-btn" onClick={Player.next}><SkipForward size={18} /></button>
      </div>

      <div className="mp-right">
        <button className={`mp-btn mp-heart-btn ${liked ? "mp-heart-active" : ""}`} onClick={toggleLike} title={liked ? "Убрать лайк" : "Нравится"}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
        </button>
        <div className="mp-vol-wrap" ref={volRef}>
          <button className="mp-btn" onClick={() => Player.setVolume(volume === 0 ? 0.7 : 0)} title="Громкость">
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input type="range" min={0} max={1} step={0.02} value={volume}
            onChange={e => Player.setVolume(parseFloat(e.target.value))}
            className="mp-vol-slider" title={`Громкость: ${Math.round(volume * 100)}%`} />
        </div>
        <button className="mp-btn" onClick={() => setHidden(true)} title="Свернуть плеер">
          <ChevronDown size={16} />
        </button>
        <button className="mp-btn mp-stop-btn" onClick={() => Player.stop()} title="Закрыть плеер">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
