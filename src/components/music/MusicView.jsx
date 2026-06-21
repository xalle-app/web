import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, Heart, Trash2, Upload, Music, CloudUpload, Share2, ListMusic, Plus, ChevronLeft, Globe, Lock, MoreHorizontal, Users, Search, X as XIcon, SlidersHorizontal, Pencil, Clock } from "lucide-react";
import { api } from "../../lib/api.js";
import { API_BASE, assetUrl } from "../../lib/config.js";
import * as Player from "../../lib/player.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import ShareTrackModal from "./ShareTrackModal.jsx";
import SharePlaylistModal from "./SharePlaylistModal.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function trackWord(n, t) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t("music.track.nMany");
  if (mod10 === 1) return t("music.track.1");
  if (mod10 >= 2 && mod10 <= 4) return t("music.track.n24");
  return t("music.track.nMany");
}

// ─── Upload Modal ─────────────────────────────────────────────
function UploadModal({ token, onClose, onUploaded }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [err, setErr] = useState("");
  const audioRef = useRef(null);
  const coverRef = useRef(null);
  const toast = useToast();
  // Track user edits so probe doesn't overwrite intentional changes
  const userEditedTitle = useRef(false);
  const userEditedArtist = useRef(false);
  const userEditedCover = useRef(false);

  const getAudioDuration = (file) => new Promise(res => {
    const url = URL.createObjectURL(file);
    const a = new Audio(url);
    a.addEventListener("loadedmetadata", () => { URL.revokeObjectURL(url); res(a.duration); });
    a.addEventListener("error", () => { URL.revokeObjectURL(url); res(0); });
  });

  const pickAudio = async (file) => {
    if (!file) return;
    setAudioFile(file);
    // Filename fallback immediately
    const filenameFallback = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
    if (!userEditedTitle.current) setTitle(filenameFallback);

    // Probe for ID3 metadata
    setProbing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch(`${API_BASE}/api/tracks/probe`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        const meta = await res.json();
        if (meta.title && !userEditedTitle.current) setTitle(meta.title);
        if (meta.artist && !userEditedArtist.current) setArtist(meta.artist);
        if (meta.coverBase64 && !userEditedCover.current) {
          setCoverPreview(meta.coverBase64);
          // Convert base64 to File for upload
          const blob = await fetch(meta.coverBase64).then(r => r.blob());
          setCoverFile(new File([blob], "cover.jpg", { type: "image/jpeg" }));
        }
      }
    } catch {}
    finally { setProbing(false); }
  };

  const pickCover = (file) => {
    if (!file) return;
    userEditedCover.current = true;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type.startsWith("audio/") || /\.(mp3|m4a|ogg|flac|wav|aac|opus)$/i.test(f.name)) pickAudio(f);
    else if (f.type.startsWith("image/")) pickCover(f);
  };

  const submit = async () => {
    if (!audioFile) { setErr(t("music.upload.noFile")); return; }
    setBusy(true); setErr("");
    try {
      const duration = await getAudioDuration(audioFile);
      const fd = new FormData();
      fd.append("audio", audioFile);
      if (coverFile) fd.append("cover", coverFile);
      fd.append("title", title || audioFile.name.replace(/\.[^.]+$/, ""));
      fd.append("artist", artist);
      fd.append("duration", String(duration));
      fd.append("public", isPublic ? "1" : "0");

      const res = await fetch(`${API_BASE}/api/tracks/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("music.upload.error"));
      toast(t("music.upload.success"), { type: "success" });
      onUploaded(data);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="music-upload-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="music-upload-modal card pop-in">
        <div className="music-upload-head">
          <h3>{t("music.upload.title")}</h3>
          <button className="music-upload-close" onClick={onClose}>✕</button>
        </div>

        <div className="music-upload-body">
          <div
            className={`music-dropzone ${audioFile ? "music-dropzone-done" : ""}`}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => audioRef.current?.click()}
          >
            <input ref={audioRef} type="file" accept=".mp3,.m4a,.ogg,.flac,.wav,.aac,.opus" style={{ display: "none" }}
              onChange={e => pickAudio(e.target.files[0])} />
            {audioFile ? (
              <div className="music-dropzone-picked">
                <div className="music-dropzone-ico">🎵</div>
                <div className="music-dropzone-filename">{audioFile.name}</div>
                <div className="music-dropzone-hint">
                  {probing ? <span className="music-probe-badge">{t("music.upload.probing")}</span> : t("music.upload.replace")}
                </div>
              </div>
            ) : (
              <div className="music-dropzone-empty">
                <CloudUpload size={32} className="music-dropzone-upload-ico" />
                <div className="music-dropzone-label">{t("music.upload.dropLabel")}</div>
                <div className="music-dropzone-hint">{t("music.upload.dropHint")}</div>
              </div>
            )}
          </div>

          <div className="music-upload-row">
            <div
              className={`music-cover-pick-wrap ${coverPreview ? "has-cover" : ""}`}
              onClick={() => coverRef.current?.click()}
              title={t("music.upload.coverTitle")}
            >
              <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                onChange={e => pickCover(e.target.files[0])} />
              {coverPreview
                ? <img src={coverPreview} className="music-cover-preview" alt="cover" />
                : <div className="music-cover-placeholder"><Music size={22} /><span>{t("music.upload.coverLabel")}</span></div>
              }
            </div>

            <div className="music-upload-fields">
              <div className="music-upload-field-wrap">
                <input placeholder={t("music.upload.titlePlaceholder")} value={title}
                  onChange={e => { userEditedTitle.current = true; setTitle(e.target.value); }} maxLength={200} />
                {probing && !title && <span className="music-probe-hint">{t("music.upload.probing")}</span>}
              </div>
              <div className="music-upload-field-wrap">
                <input placeholder={t("music.upload.artistPlaceholder")} value={artist}
                  onChange={e => { userEditedArtist.current = true; setArtist(e.target.value); }} maxLength={200} />
              </div>
              <label className="music-public-toggle">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                <span>{t("music.upload.public")}</span>
              </label>
            </div>
          </div>

          {err && <div className="err">{err}</div>}
          <button className="btn accent music-upload-submit" onClick={submit} disabled={busy || !audioFile}>
            {busy ? t("music.upload.uploading") : t("music.upload.btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Track Modal ─────────────────────────────────────────
function EditTrackModal({ track, token, onClose, onSaved }) {
  const [title, setTitle] = useState(track.title || "");
  const [artist, setArtist] = useState(track.artist || "");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(track.coverUrl ? assetUrl(track.coverUrl) : null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const coverRef = useRef(null);
  const toast = useToast();

  const pickCover = (file) => {
    if (!file) return;
    setRemoveCover(false);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleRemoveCover = () => {
    setRemoveCover(true);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const submit = async () => {
    if (!title.trim()) { setErr("Название не может быть пустым"); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("artist", artist.trim());
      if (coverFile) fd.append("cover", coverFile);
      if (removeCover && !coverFile) fd.append("removeCover", "1");
      const res = await fetch(`${API_BASE}/api/v2/tracks/${track.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast("Трек обновлён", { type: "success" });
      onSaved(data);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="music-upload-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="music-upload-modal card pop-in">
        <div className="music-upload-head">
          <h3>Редактировать трек</h3>
          <button className="music-upload-close" onClick={onClose}>✕</button>
        </div>
        <div className="music-upload-body">
          <div className="music-upload-row">
            <div
              className={`music-cover-pick-wrap ${coverPreview ? "has-cover" : ""}`}
              onClick={() => coverRef.current?.click()}
              title="Обложка"
            >
              <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                onChange={e => pickCover(e.target.files[0])} />
              {coverPreview
                ? <img src={coverPreview} className="music-cover-preview" alt="cover" />
                : <div className="music-cover-placeholder"><Music size={22} /><span>Обложка</span></div>
              }
            </div>
            <div className="music-upload-fields">
              <div className="music-upload-field-wrap">
                <input placeholder="Название трека" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} autoFocus />
              </div>
              <div className="music-upload-field-wrap">
                <input placeholder="Исполнитель" value={artist} onChange={e => setArtist(e.target.value)} maxLength={200} />
              </div>
              {track.coverUrl && (
                <label className="music-public-toggle" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={removeCover} onChange={e => { if (e.target.checked) handleRemoveCover(); else { setRemoveCover(false); setCoverPreview(assetUrl(track.coverUrl)); } }} />
                  <span>Удалить обложку</span>
                </label>
              )}
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn accent music-upload-submit" onClick={submit} disabled={busy || !title.trim()}>
            {busy ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add to Playlist Popup ────────────────────────────────────
function AddToPlaylistPopup({ track, token, playlists, onClose }) {
  const t = useT();
  const toast = useToast();
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const add = async (playlistId) => {
    try {
      await api(`/playlists/${playlistId}/tracks`, { method: "POST", token, body: { trackId: track.id } });
      toast(t("music.playlist.added"), { type: "success" });
    } catch { toast(t("music.playlist.alreadyAdded"), { type: "info" }); }
    onClose();
  };

  return (
    <div className="playlist-popup pop-in" ref={ref} onClick={e => e.stopPropagation()}>
      <div className="playlist-popup-title">{t("music.playlist.addTitle")}</div>
      {playlists.length === 0
        ? <div className="playlist-popup-empty">{t("music.playlist.noPlaylists")}</div>
        : playlists.map(p => (
          <button key={p.id} className="playlist-popup-item" onClick={() => add(p.id)}>
            <ListMusic size={14} />
            <span>{p.title}</span>
            <span className="playlist-popup-count">{p.track_count}</span>
          </button>
        ))
      }
    </div>
  );
}

// ─── Track Item ───────────────────────────────────────────────
function TrackItem({ track, token, isPlaying, isCurrent, onPlay, onDelete, onEdit, onLikeChange, showUploader, playlists, onRemoveFromPlaylist, onArtistClick }) {
  const t = useT();
  const [liked, setLiked] = useState(track.liked);
  const [showShare, setShowShare] = useState(false);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const moreRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!showMore) return;
    const h = (e) => { if (!moreRef.current?.contains(e.target)) setShowMore(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMore]);

  useEffect(() => {
    const h = (e) => { if (e.detail?.id === track.id) setLiked(e.detail.liked); };
    window.addEventListener("music:like-change", h);
    return () => window.removeEventListener("music:like-change", h);
  }, [track.id]);

  const toggleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await api(`/tracks/${track.id}/like`, { method: "POST", token });
      setLiked(res.liked);
      onLikeChange?.(track.id, res.liked);
      window.dispatchEvent(new CustomEvent("music:like-change", {
        detail: { id: track.id, liked: res.liked, track: { ...track, liked: res.liked } }
      }));
    } catch { toast(t("common.error"), { type: "error" }); }
  };

  return (
    <div className={`track-item ${isCurrent ? "track-current" : ""}`} onClick={() => onPlay(track)}>
      <button className="track-play-btn" onClick={e => { e.stopPropagation(); onPlay(track); }}>
        {isCurrent && isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="track-cover-wrap">
        {track.coverUrl
          ? <img src={assetUrl(track.coverUrl)} className="track-cover" alt={track.title} />
          : <div className="track-cover track-cover-empty"><Music size={16} /></div>
        }
      </div>
      <div className="track-info">
        <div className="track-title">
          {track.title}
          {track.status === "pending" && (
            <span className="track-pending-badge" title="Ожидает одобрения модератора"><Clock size={11} /> На проверке</span>
          )}
        </div>
        <div className="track-artist">
          {track.artist && (
            <button
              className="track-artist-btn"
              onClick={e => { e.stopPropagation(); onArtistClick?.(track.artist); }}
              title={track.artist}
            >{track.artist}</button>
          )}
          {showUploader && track.uploaderName && <span className="track-uploader">· {track.uploaderName}</span>}
        </div>
      </div>
      {track.playCount > 0 && <div className="track-plays">{track.playCount >= 1000 ? `${(track.playCount/1000).toFixed(1)}к` : track.playCount}</div>}
      <div className="track-duration">{fmt(track.duration)}</div>
      <button className={`track-like-btn ${liked ? "liked" : ""}`} onClick={toggleLike} title={liked ? t("music.track.unlike") : t("music.track.like")}>
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
      </button>
      {playlists && (
        <div style={{ position: "relative" }}>
          <button className="track-share-btn" onClick={e => { e.stopPropagation(); setShowAddPlaylist(v => !v); }} title={t("music.track.addPlaylist")}>
            <Plus size={15} />
          </button>
          {showAddPlaylist && (
            <AddToPlaylistPopup track={track} token={token} playlists={playlists} onClose={() => setShowAddPlaylist(false)} />
          )}
        </div>
      )}
      <button className="track-share-btn" onClick={e => { e.stopPropagation(); setShowShare(true); }} title={t("common.share")}>
        <Share2 size={15} />
      </button>
      {onRemoveFromPlaylist && (
        <button className="track-delete-btn" onClick={e => { e.stopPropagation(); onRemoveFromPlaylist(track); }} title={t("music.track.removePlaylist")}>
          <Trash2 size={15} />
        </button>
      )}
      {onEdit && (
        <button className="track-share-btn" onClick={e => { e.stopPropagation(); setShowEdit(true); }} title="Редактировать">
          <Pencil size={15} />
        </button>
      )}
      {onDelete && !onRemoveFromPlaylist && (
        <button className="track-delete-btn" onClick={e => { e.stopPropagation(); onDelete(track); }} title={t("common.delete")}>
          <Trash2 size={15} />
        </button>
      )}
      {/* Mobile 3-dot menu */}
      <div className="track-more-wrap" ref={moreRef}>
        <button className="track-more-btn" onClick={e => { e.stopPropagation(); setShowMore(v => !v); }}>
          <MoreHorizontal size={17} />
        </button>
        {showMore && (
          <div className="track-more-panel" onClick={e => e.stopPropagation()}>
            <button onClick={() => { onPlay(track); setShowMore(false); }}>
              {isCurrent && isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {isCurrent && isPlaying ? t("music.track.pause") : t("music.track.play")}
            </button>
            <button onClick={(e) => { toggleLike(e); setShowMore(false); }}>
              <Heart size={15} fill={liked ? "currentColor" : "none"} style={{ color: liked ? "#e05a72" : undefined }} />
              {liked ? t("music.track.unlike") : t("music.track.like")}
            </button>
            {playlists && (
              <button onClick={() => { setShowAddPlaylist(true); setShowMore(false); }}>
                <Plus size={15} /> {t("music.track.addPlaylist")}
              </button>
            )}
            <button onClick={() => { setShowShare(true); setShowMore(false); }}>
              <Share2 size={15} /> {t("common.share")}
            </button>
            {onRemoveFromPlaylist && (
              <button className="danger" onClick={() => { onRemoveFromPlaylist(track); setShowMore(false); }}>
                <Trash2 size={15} /> {t("music.track.removePlaylist")}
              </button>
            )}
            {onEdit && (
              <button onClick={() => { setShowEdit(true); setShowMore(false); }}>
                <Pencil size={15} /> Редактировать
              </button>
            )}
            {onDelete && !onRemoveFromPlaylist && (
              <button className="danger" onClick={() => { onDelete(track); setShowMore(false); }}>
                <Trash2 size={15} /> {t("common.delete")}
              </button>
            )}
          </div>
        )}
      </div>

      {showShare && (
        <ShareTrackModal track={track} token={token} onClose={() => setShowShare(false)} />
      )}
      {showEdit && (
        <EditTrackModal
          track={track}
          token={token}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { onEdit?.(track.id, updated); setShowEdit(false); }}
        />
      )}
    </div>
  );
}

// ─── Create Playlist Modal ────────────────────────────────────
function CreatePlaylistModal({ token, onClose, onCreate }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const p = await api("/playlists", { method: "POST", token, body: { title: title.trim(), isPublic } });
      onCreate(p);
      onClose();
    } catch { toast(t("common.error"), { type: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="cpl-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cpl-modal pop-in">
        <div className="cpl-icon"><ListMusic size={28} /></div>
        <h3 className="cpl-title">{t("music.cpl.title")}</h3>
        <p className="cpl-sub">{t("music.cpl.sub")}</p>

        <div className="cpl-field">
          <input
            className="cpl-input"
            placeholder={t("music.cpl.namePlaceholder")}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
          <span className="cpl-char">{title.length}/80</span>
        </div>

        <div className="cpl-vis">
          <button className={`cpl-vis-btn ${!isPublic ? "cpl-vis-on" : ""}`} onClick={() => setIsPublic(false)} type="button">
            <Lock size={15} />
            <span>{t("music.cpl.private")}</span>
            <span className="cpl-vis-hint">{t("music.cpl.private.hint")}</span>
          </button>
          <button className={`cpl-vis-btn ${isPublic ? "cpl-vis-on" : ""}`} onClick={() => setIsPublic(true)} type="button">
            <Globe size={15} />
            <span>{t("music.cpl.public")}</span>
            <span className="cpl-vis-hint">{t("music.cpl.public.hint")}</span>
          </button>
        </div>

        <div className="cpl-actions">
          <button className="cpl-cancel" onClick={onClose}>{t("common.cancel")}</button>
          <button className="cpl-submit" onClick={submit} disabled={busy || !title.trim()}>
            {busy ? t("music.cpl.creating") : t("music.cpl.btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Playlist Card ────────────────────────────────────────────
function PlaylistCard({ playlist, onOpen, onPlay, onDelete, onShare }) {
  const t = useT();
  return (
    <div className="playlist-card" onClick={() => onOpen(playlist)}>
      <div className="playlist-card-cover">
        {playlist.cover_url
          ? <img src={assetUrl(playlist.cover_url)} alt={playlist.title} />
          : <div className="playlist-card-cover-empty"><ListMusic size={24} /></div>
        }
        <button className="playlist-card-play" onClick={e => { e.stopPropagation(); onPlay(playlist); }} title={t("music.playlist.play")}>
          <Play size={16} />
        </button>
      </div>
      <div className="playlist-card-info">
        <div className="playlist-card-title">{playlist.title}</div>
        <div className="playlist-card-meta">
          {playlist.track_count} {trackWord(playlist.track_count, t)}
          {playlist.is_public ? <Globe size={11} style={{ marginLeft: 6 }} /> : <Lock size={11} style={{ marginLeft: 6 }} />}
        </div>
      </div>
      <div className="playlist-card-actions" onClick={e => e.stopPropagation()}>
        {playlist.is_public && onShare && (
          <button className="playlist-card-action-btn" onClick={() => onShare(playlist)} title={t("common.share")}>
            <Share2 size={14} />
          </button>
        )}
        <button className="playlist-card-delete" onClick={() => onDelete(playlist)} title={t("common.delete")}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Playlist Detail View ─────────────────────────────────────
function PlaylistDetail({ playlist, token, playerState, playlists, onBack, onUpdated }) {
  const t = useT();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(!!playlist.is_public);
  const [togglingVis, setTogglingVis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api(`/playlists/${playlist.id}`, { token })
      .then(d => setTracks(d.tracks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playlist.id, token]);

  // Real-time playlist sync via WebSocket
  useEffect(() => {
    const onAdded = (e) => {
      if (e.detail.playlistId !== playlist.id) return;
      const track = e.detail.track;
      setTracks(prev => prev.find(t => t.id === track.id) ? prev : [...prev, track]);
      onUpdated({ ...playlist, track_count: (playlist.track_count || 0) + 1 });
    };
    const onRemoved = (e) => {
      if (e.detail.playlistId !== playlist.id) return;
      setTracks(prev => prev.filter(t => t.id !== e.detail.trackId));
      onUpdated({ ...playlist, track_count: Math.max(0, (playlist.track_count || 1) - 1) });
    };
    window.addEventListener("playlist:track_added", onAdded);
    window.addEventListener("playlist:track_removed", onRemoved);
    return () => {
      window.removeEventListener("playlist:track_added", onAdded);
      window.removeEventListener("playlist:track_removed", onRemoved);
    };
  }, [playlist.id]);

  const handlePlay = (track) => {
    if (playerState.current?.id === track.id) { Player.toggle(); return; }
    const idx = tracks.findIndex(tr => tr.id === track.id);
    Player.play(tracks, idx >= 0 ? idx : 0);
  };

  const playAll = () => {
    if (tracks.length) Player.play(tracks, 0);
  };

  const removeTrack = async (track) => {
    try {
      await api(`/playlists/${playlist.id}/tracks/${track.id}`, { method: "DELETE", token });
      setTracks(l => l.filter(tr => tr.id !== track.id));
      onUpdated({ ...playlist, track_count: (playlist.track_count || 1) - 1 });
      toast(t("music.playlist.removed"), { type: "info" });
    } catch { toast(t("common.error"), { type: "error" }); }
  };

  const onLikeChange = (id, liked) => {
    setTracks(l => l.map(tr => tr.id === id ? { ...tr, liked } : tr));
  };

  const toggleVisibility = async () => {
    setTogglingVis(true);
    try {
      const newPublic = !isPublic;
      await api(`/playlists/${playlist.id}`, { method: "PATCH", token, body: { isPublic: newPublic } });
      setIsPublic(newPublic);
      onUpdated({ ...playlist, is_public: newPublic ? 1 : 0 });
      toast(newPublic ? t("music.playlist.madePublic") : t("music.playlist.madePrivate"), { type: "success" });
    } catch { toast(t("common.error"), { type: "error" }); }
    finally { setTogglingVis(false); }
  };

  const [showShare, setShowShare] = useState(false);

  const sharePlaylist = () => {
    if (playlist.share_token) {
      setShowShare(true);
    } else {
      toast(t("music.playlist.noToken"), { type: "info" });
    }
  };

  const currentId = playerState.current?.id;

  return (
    <div className="playlist-detail">
      <div className="playlist-detail-head">
        <button className="playlist-back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> {t("music.playlists.back")}
        </button>
        <div className="playlist-detail-cover">
          {playlist.cover_url
            ? <img src={assetUrl(playlist.cover_url)} alt={playlist.title} />
            : <div className="playlist-detail-cover-empty"><ListMusic size={32} /></div>
          }
        </div>
        <div className="playlist-detail-info">
          <h2 className="playlist-detail-title">{playlist.title}</h2>
          <div className="playlist-detail-meta">
            {tracks.length} {trackWord(tracks.length, t)}
            <button
              className={`playlist-vis-badge playlist-vis-toggle ${togglingVis ? "loading" : ""}`}
              onClick={toggleVisibility}
              disabled={togglingVis}
              title={isPublic ? t("music.playlist.makePrivate") : t("music.playlist.makePublic")}
            >
              {isPublic
                ? <><Globe size={12} /> {t("music.playlist.public")}</>
                : <><Lock size={12} /> {t("music.playlist.private")}</>
              }
            </button>
          </div>
          <div className="playlist-detail-actions">
            {tracks.length > 0 && (
              <button className="btn accent" onClick={playAll}>
                <Play size={14} /> {t("music.playlist.listen")}
              </button>
            )}
            {isPublic && (
              <button className="btn" onClick={sharePlaylist} title={t("common.share")}>
                <Share2 size={14} /> {t("common.share")}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="music-empty">{t("common.loading")}</div>
      ) : tracks.length === 0 ? (
        <div className="music-empty">
          <ListMusic size={36} className="music-empty-ico" />
          <div>{t("music.playlist.empty.hint")}</div>
        </div>
      ) : (
        <div className="track-list">
          {tracks.map(trk => (
            <TrackItem
              key={trk.id}
              track={trk}
              token={token}
              isCurrent={currentId === trk.id}
              isPlaying={playerState.playing}
              onPlay={handlePlay}
              onLikeChange={onLikeChange}
              playlists={playlists}
              onRemoveFromPlaylist={removeTrack}
            />
          ))}
        </div>
      )}
      {showShare && (
        <SharePlaylistModal
          playlist={{ ...playlist, share_token: playlist.share_token, track_count: tracks.length }}
          token={token}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function MusicView({ token, me }) {
  const t = useT();
  const [tab, setTab] = useState("feed");
  const switchTab = (tabKey) => { setTab(tabKey); if (tabKey !== "playlists") setActivePlaylist(null); };
  const [feedTracks, setFeedTracks] = useState([]);
  const [myTracks, setMyTracks] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [sharePlaylist, setSharePlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerState, setPlayerState] = useState(Player.getState());
  const [searchQ, setSearchQ] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [sortBy, setSortBy] = useState("default"); // "default" | "plays" | "short" | "long" | "new"
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => Player.subscribe(setPlayerState), []);


  useEffect(() => {
    const h = async e => {
      const { token: shareToken } = e.detail;
      try {
        const data = await api(`/playlists/by-token/${shareToken}`, { token });
        setActivePlaylist(data);
        switchTab("playlists");
      } catch { toast(t("music.playlist.notFound"), { type: "error" }); }
    };
    window.addEventListener("music:open-playlist", h);
    return () => window.removeEventListener("music:open-playlist", h);
  }, [token]);

  useEffect(() => {
    const h = async e => {
      const { token: shareToken } = e.detail;
      try {
        const data = await api(`/tracks/by-token/${shareToken}`, { token });
        Player.play([data], 0);
        setTab("feed");
        toast(`▶ ${data.title}${data.artist ? " — " + data.artist : ""}`, { type: "success" });
      } catch { toast(t("music.track.notFound"), { type: "error" }); }
    };
    window.addEventListener("music:open-track", h);
    return () => window.removeEventListener("music:open-track", h);
  }, [token]);

  useEffect(() => {
    const h = (e) => {
      const { id, liked, track } = e.detail;
      const patch = l => l.map(x => x.id === id ? { ...x, liked } : x);
      setMyTracks(patch); setFeedTracks(patch);
      if (liked) {
        setLikedTracks(l => l.find(x => x.id === id) ? patch(l) : [{ ...track, liked: true }, ...l]);
      } else {
        setLikedTracks(l => l.filter(x => x.id !== id));
      }
    };
    window.addEventListener("music:like-change", h);
    return () => window.removeEventListener("music:like-change", h);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      api("/tracks/feed", { token }).then(setFeedTracks).catch(() => {}),
      api("/tracks/my", { token }).then(setMyTracks).catch(() => {}),
      api("/tracks/liked", { token }).then(setLikedTracks).catch(() => {}),
      api("/playlists", { token }).then(setPlaylists).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handlePlay = (track, list) => {
    const currentId = playerState.current?.id;
    if (currentId === track.id) { Player.toggle(); return; }
    const idx = list.findIndex(tr => tr.id === track.id);
    Player.play(list, idx >= 0 ? idx : 0);
  };

  const handleDelete = async (track) => {
    if (!(await confirm({ title: t("music.track.delete.title"), message: t("music.track.delete.msg", { title: track.title }), danger: true, okText: t("common.delete") }))) return;
    try {
      await api(`/tracks/${track.id}`, { method: "DELETE", token });
      setMyTracks(l => l.filter(tr => tr.id !== track.id));
      setFeedTracks(l => l.filter(tr => tr.id !== track.id));
      toast(t("music.track.deleted"), { type: "info" });
    } catch { toast(t("music.track.deleteError"), { type: "error" }); }
  };

  const handleEdit = (id, updated) => {
    const patch = l => l.map(tr => tr.id === id ? { ...tr, ...updated } : tr);
    setMyTracks(patch);
    setFeedTracks(patch);
    Player.patchCurrentMeta?.(id, updated);
  };

  const handleDeletePlaylist = async (playlist) => {
    if (!(await confirm({ title: t("music.playlist.delete.title"), message: t("music.playlist.delete.msg", { title: playlist.title }), danger: true, okText: t("common.delete") }))) return;
    try {
      await api(`/playlists/${playlist.id}`, { method: "DELETE", token });
      setPlaylists(l => l.filter(p => p.id !== playlist.id));
      if (activePlaylist?.id === playlist.id) setActivePlaylist(null);
      toast(t("music.playlist.deleted"), { type: "info" });
    } catch { toast(t("common.error"), { type: "error" }); }
  };

  const handlePlayPlaylist = async (playlist) => {
    try {
      const data = await api(`/playlists/${playlist.id}`, { token });
      if (data.tracks?.length) Player.play(data.tracks, 0);
      else toast(t("music.playlist.emptyToast"), { type: "info" });
    } catch { toast(t("common.error"), { type: "error" }); }
  };

  const onLikeChange = (id, liked) => {
    const patch = l => l.map(x => x.id === id ? { ...x, liked } : x);
    setMyTracks(patch); setFeedTracks(patch);
    setLikedTracks(l => liked ? l : l.filter(x => x.id !== id));
  };

  const currentId = playerState.current?.id;
  const rawTracks = tab === "my" ? myTracks : tab === "liked" ? likedTracks : feedTracks;

  const tracks = useMemo(() => {
    let list = [...rawTracks];
    const q = searchQ.trim().toLowerCase();
    if (q) list = list.filter(tr => tr.title?.toLowerCase().includes(q) || tr.artist?.toLowerCase().includes(q) || tr.uploaderName?.toLowerCase().includes(q));
    if (artistFilter) list = list.filter(tr => tr.artist?.toLowerCase() === artistFilter.toLowerCase());
    if (sortBy === "plays") list.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    else if (sortBy === "short") list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    else if (sortBy === "long") list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    else if (sortBy === "new") list.sort((a, b) => (b.id || 0) - (a.id || 0));
    return list;
  }, [rawTracks, searchQ, artistFilter, sortBy]);

  if (tab === "playlists" && activePlaylist) {
    return (
      <div className="music-view">
        <PlaylistDetail
          playlist={activePlaylist}
          token={token}
          playerState={playerState}
          playlists={playlists}
          onBack={() => setActivePlaylist(null)}
          onUpdated={updated => setPlaylists(l => l.map(p => p.id === updated.id ? updated : p))}
        />
        {showCreatePlaylist && (
          <CreatePlaylistModal token={token} onClose={() => setShowCreatePlaylist(false)}
            onCreate={p => setPlaylists(l => [p, ...l])} />
        )}
      </div>
    );
  }

  return (
    <div className="music-view">
      <div className="music-header">
        <h2 className="music-title">{t("music.title")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "playlists" && (
            <button className="btn" onClick={() => setShowCreatePlaylist(true)}>
              <Plus size={15} /> {t("music.create")}
            </button>
          )}
          <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent("listen:open-modal"))} title={t("music.together.title")}>
            <Users size={15} /> {t("music.together")}
          </button>
          <button className="btn accent music-upload-btn" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> {t("music.upload.btn2")}
          </button>
        </div>
      </div>

      <div className="music-tabs">
        <button className={tab === "feed" ? "on" : ""} onClick={() => switchTab("feed")}>{t("music.tab.feed")}</button>
        <button className={tab === "my" ? "on" : ""} onClick={() => switchTab("my")}>{t("music.tab.my")}</button>
        <button className={tab === "liked" ? "on" : ""} onClick={() => switchTab("liked")}>{t("music.tab.liked")}</button>
        <button className={tab === "playlists" ? "on" : ""} onClick={() => switchTab("playlists")}>
          <ListMusic size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{t("music.playlists.title")}
        </button>
      </div>

      {tab === "playlists" ? (
        loading ? (
          <div className="music-empty">{t("common.loading")}</div>
        ) : playlists.length === 0 ? (
          <div className="music-empty">
            <ListMusic size={40} className="music-empty-ico" />
            <div>{t("music.playlists.empty")}</div>
            <button className="btn accent" onClick={() => setShowCreatePlaylist(true)}>
              <Plus size={14} /> {t("music.cpl.btn")}
            </button>
          </div>
        ) : (
          <div className="playlist-grid">
            {playlists.map(p => (
              <PlaylistCard
                key={p.id}
                playlist={p}
                onOpen={setActivePlaylist}
                onPlay={handlePlayPlaylist}
                onDelete={handleDeletePlaylist}
                onShare={p.is_public ? (pl) => {
                  setSharePlaylist(pl);
                } : null}
              />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="music-empty">{t("common.loading")}</div>
      ) : (
        <>
          {/* Search & filter bar */}
          {tab !== "playlists" && (
            <div className="music-filter-bar">
              <div className="music-filter-search">
                <Search size={14} className="music-filter-search-ico" />
                <input
                  className="music-filter-input"
                  placeholder={t("music.filter.search")}
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                {searchQ && <button className="music-filter-clear" onClick={() => setSearchQ("")}><XIcon size={13} /></button>}
              </div>
              <div className="music-filter-sort">
                <SlidersHorizontal size={13} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="music-filter-select">
                  <option value="default">{t("music.filter.sort.default")}</option>
                  <option value="new">{t("music.filter.sort.new")}</option>
                  <option value="plays">{t("music.filter.sort.plays")}</option>
                  <option value="short">{t("music.filter.sort.short")}</option>
                  <option value="long">{t("music.filter.sort.long")}</option>
                </select>
              </div>
              {artistFilter && (
                <div className="music-filter-pill">
                  {artistFilter}
                  <button onClick={() => setArtistFilter("")}><XIcon size={11} /></button>
                </div>
              )}
            </div>
          )}
          {tracks.length === 0 && !loading ? (
            <div className="music-empty">
              <Music size={40} className="music-empty-ico" />
              <div>
                {searchQ || artistFilter ? t("music.filter.noResults") :
                  tab === "feed" ? t("music.tab.feed.empty") :
                  tab === "my" ? t("music.tab.my.empty") : t("music.tab.liked.empty")}
              </div>
              {(tab === "feed" || tab === "my") && !searchQ && !artistFilter && (
                <button className="btn accent" onClick={() => setShowUpload(true)}>{t("music.upload.btn")}</button>
              )}
            </div>
          ) : (
            <div className="track-list">
              {tracks.map(trk => (
                <TrackItem
                  key={trk.id}
                  track={trk}
                  token={token}
                  isCurrent={currentId === trk.id}
                  isPlaying={playerState.playing}
                  onPlay={tr => handlePlay(tr, tracks)}
                  onDelete={tab === "my" || trk.userId === me?.id ? handleDelete : null}
                  onEdit={tab === "my" || trk.userId === me?.id ? handleEdit : null}
                  onLikeChange={onLikeChange}
                  showUploader={tab === "feed"}
                  playlists={playlists}
                  onArtistClick={a => { setArtistFilter(a); setSearchQ(""); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showUpload && (
        <UploadModal token={token} onClose={() => setShowUpload(false)}
          onUploaded={trk => { setMyTracks(l => [trk, ...l]); if (trk.public) setFeedTracks(l => [trk, ...l]); }} />
      )}
      {showCreatePlaylist && (
        <CreatePlaylistModal token={token} onClose={() => setShowCreatePlaylist(false)}
          onCreate={p => setPlaylists(l => [p, ...l])} />
      )}
      {sharePlaylist && (
        <SharePlaylistModal playlist={sharePlaylist} token={token} onClose={() => setSharePlaylist(null)} />
      )}
    </div>
  );
}
