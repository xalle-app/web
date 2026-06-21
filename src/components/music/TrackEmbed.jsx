import { useState, useEffect } from "react";
import { Play, Pause, Heart } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import * as Player from "../../lib/player.js";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export default function TrackEmbed({ trackId, shareToken, token }) {
  const [track, setTrack] = useState(null);
  const [liked, setLiked] = useState(false);
  const [playerState, setPlayerState] = useState(Player.getState());

  useEffect(() => {
    const url = shareToken ? `/tracks/by-token/${shareToken}` : `/tracks/${trackId}`;
    api(url, { token }).then(t => { setTrack(t); setLiked(!!t.liked); }).catch(() => {});
  }, [trackId, shareToken, token]);

  useEffect(() => Player.subscribe(setPlayerState), []);

  // Keep liked in sync with global like-change events
  useEffect(() => {
    const h = (e) => {
      if (e.detail?.id === (track?.id ?? trackId)) setLiked(e.detail.liked);
    };
    window.addEventListener("music:like-change", h);
    return () => window.removeEventListener("music:like-change", h);
  }, [trackId, track?.id]);

  if (!track) return null;

  const isCurrent = playerState.current?.id === track.id;
  const isPlaying = isCurrent && playerState.playing;

  const play = (e) => {
    e.stopPropagation();
    if (isCurrent) { Player.toggle(); return; }
    Player.play([track], 0);
  };

  const toggleLike = async (e) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await api(`/tracks/${track.id}/like`, { method: "POST", token });
      setLiked(res.liked);
      if (isCurrent) Player.patchCurrentLiked(res.liked);
      // Broadcast so player bar, MusicView tabs and other embeds all sync
      window.dispatchEvent(new CustomEvent("music:like-change", {
        detail: { id: track.id, liked: res.liked, track: { ...track, liked: res.liked } }
      }));
    } catch { /* ignore */ }
  };

  return (
    <div className="track-embed" onClick={e => e.stopPropagation()}>
      <button className="track-embed-play" onClick={play}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      {track.coverUrl
        ? <img src={assetUrl(track.coverUrl)} className="track-embed-cover" alt="" />
        : <div className="track-embed-cover track-embed-cover-empty">♪</div>
      }
      <div className="track-embed-info">
        <div className="track-embed-title">{track.title}</div>
        {track.artist && <div className="track-embed-artist">{track.artist}</div>}
      </div>
      {track.duration > 0 && <div className="track-embed-dur">{fmt(track.duration)}</div>}
      <button className={`track-embed-like ${liked ? "liked" : ""}`} onClick={toggleLike}>
        <Heart size={14} fill={liked ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
