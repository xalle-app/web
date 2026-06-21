import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, SkipForward, SkipBack, X, Users, Music, Send, Copy, QrCode, ChevronUp, Radio, Settings, ListMusic, UserX, Shield, Globe, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import * as Player from "../../lib/player.js";
import { useToast } from "../shared/ui.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MiniAvatar({ member }) {
  return member.avatar
    ? <img src={assetUrl(member.avatar)} className="lmini-av" alt={member.name} title={`@${member.handle}`} />
    : <div className="lmini-av lmini-av-letter" title={`@${member.handle}`}>{(member.name || "?")[0]}</div>;
}

function RoomAvatar({ name, avatar, size = 30 }) {
  return avatar
    ? <img src={assetUrl(avatar)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt={name} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>{(name || "?")[0]}</div>;
}

// ── Mini persistent widget ──────────────────────────────────────
function ListenMini({ listenRoom, isHost, playerState, selfHideCode, onExpand, onLeave }) {
  const t = useT();
  const track = listenRoom.room?.track;
  const members = listenRoom.room?.members || [];

  return createPortal(
    <div className="lmini-widget">
      <div className="lmini-head">
        <span className="lmini-pulse" />
        <span className="lmini-head-label">{t("listen.mini.label")}</span>
        <button className="lmini-head-btn" onClick={onExpand} title={t("listen.minimize")}>
          <ChevronUp size={13} />
        </button>
        <button className="lmini-head-btn lmini-head-btn-close" onClick={onLeave} title={t("listen.leave.btn")}>
          <X size={13} />
        </button>
      </div>

      <div className="lmini-track-row">
        {track ? (
          <>
            {track.coverUrl
              ? <img src={assetUrl(track.coverUrl)} className="lmini-cover" alt={track.title} />
              : <div className="lmini-cover lmini-cover-empty"><Music size={12} /></div>
            }
            <div className="lmini-track-info">
              <div className="lmini-track-title">{track.title}</div>
              {track.artist && <div className="lmini-track-artist">{track.artist}</div>}
            </div>
            {isHost && (
              <button className="lmini-play-btn" onClick={() => Player.toggle()}>
                {playerState?.playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
            )}
          </>
        ) : (
          <div className="lmini-no-track"><Radio size={15} /><span>{t("listen.noTrack")}</span></div>
        )}
      </div>

      {track && playerState?.duration > 0 && (
        <div className="lmini-progress">
          <div className="lmini-progress-fill" style={{ width: `${((playerState.progress || 0) * 100).toFixed(1)}%` }} />
        </div>
      )}
      <div className="lmini-foot">
        <span className={`lmini-code${(listenRoom.room?.settings?.hideCode || selfHideCode) ? " listen-code-blur" : ""}`}>{listenRoom.code}</span>
        <div className="lmini-members">
          {members.slice(0, 3).map(m => <MiniAvatar key={m.id} member={m} />)}
          {members.length > 3 && <div className="lmini-av lmini-av-extra">+{members.length - 3}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Share modal ────────────────────────────────────────────────
function ShareModal({ code, token, settings, onClose }) {
  const t = useT();
  const [tab, setTab] = useState("link");
  const [handle, setHandle] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const suggestTimer = useRef(null);
  const toast = useToast();
  const link = `${window.location.origin}?listen=${code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(link)}&size=180x180&margin=10`;
  const hideCode = settings?.hideCode;

  const copyLink = () => { navigator.clipboard?.writeText(link); toast(t("listen.share.link.copied"), { type: "success" }); };
  const copyCode = () => { navigator.clipboard?.writeText(code); toast(t("listen.share.code.copied"), { type: "success" }); };

  const onHandleChange = (v) => {
    setHandle(v); setSent(false); setSuggestions([]);
    clearTimeout(suggestTimer.current);
    const q = v.replace(/^@/, "").trim();
    if (!q) return;
    suggestTimer.current = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(q)}`, { token })
        .then(rows => setSuggestions(rows.slice(0, 4)))
        .catch(() => {});
    }, 250);
  };

  const sendToFriend = async (h) => {
    const handle2 = (h || handle).replace(/^@/, "").trim();
    if (!handle2) return;
    setSuggestions([]);
    setSending(true);
    try {
      const { convId } = await api(`/messages/open/${handle2}`, { method: "POST", token });
      await api(`/messages/${convId}/send`, { method: "POST", token, body: { body: t("listen.invite.msg", { code, link }) } });
      setSent(true);
      toast(t("listen.share.toast", { handle: handle2 }), { type: "success" });
    } catch (e) { toast(e.message || t("listen.share.notFound"), { type: "error" }); }
    finally { setSending(false); }
  };

  return (
    <div className="listen-share-overlay" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="listen-share-modal pop-in">
        <div className="share-modal-head">
          <span className="share-modal-title">{t("listen.share.title")}</span>
          <button className="share-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="share-modal-tabs">
          <button className={`share-modal-tab ${tab === "link" ? "active" : ""}`} onClick={() => setTab("link")}>{t("listen.share.tab.link")}</button>
          <button className={`share-modal-tab ${tab === "username" ? "active" : ""}`} onClick={() => setTab("username")}>{t("listen.share.tab.username")}</button>
          <button className={`share-modal-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>{t("listen.share.tab.qr")}</button>
        </div>
        {tab === "link" && (
          <div className="share-modal-body">
            <div className="share-modal-link-row">
              <span className={`share-modal-link-text${hideCode ? " listen-code-blur" : ""}`}>{link}</span>
              <button className="btn accent" onClick={copyLink}><Copy size={13} /> {t("listen.share.copy")}</button>
            </div>
            <div className="listen-share-code-block">
              <div className="listen-share-code-label">{t("listen.share.roomCode")}</div>
              <div className="listen-share-code-display">
                <span className={`listen-share-code-value${hideCode ? " listen-code-blur" : ""}`}>{code}</span>
                <button className="btn ghost" onClick={copyCode}><Copy size={13} /></button>
              </div>
            </div>
          </div>
        )}
        {tab === "username" && (
          <div className="share-modal-body">
            {sent ? (
              <div className="share-modal-sent">{t("listen.share.sent", { handle: handle.replace(/^@/, "") })}</div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="listen-share-input" placeholder={t("listen.share.handle.placeholder")} value={handle}
                  onChange={e => onHandleChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendToFriend()}
                  autoFocus />
                {suggestions.length > 0 && (
                  <div className="listen-share-suggest">
                    {suggestions.map(u => (
                      <button key={u.handle} className="listen-share-suggest-item" onMouseDown={e => { e.preventDefault(); sendToFriend(u.handle); }}>
                        {u.avatar_url
                          ? <img src={assetUrl(u.avatar_url)} className="lss-av" alt={u.name} />
                          : <div className="lss-av lss-av-letter">{(u.name||"?")[0]}</div>
                        }
                        <div className="lss-info">
                          <span className="lss-name">{u.name}</span>
                          <span className="lss-handle">@{u.handle}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn accent" style={{ marginTop: 10, width: "100%" }} onClick={() => sendToFriend()} disabled={sending || !handle.trim()}>
                  {sending ? t("listen.share.sending") : t("listen.share.sendBtn")}
                </button>
              </div>
            )}
          </div>
        )}
        {tab === "qr" && (
          <div className="share-modal-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <img src={qrUrl} alt="QR" width={160} height={160} style={{ borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>{t("listen.share.qr.hint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Room Settings Panel ────────────────────────────────────────
function SettingsPanel({ settings, onUpdate, onClose }) {
  const t = useT();
  const [local, setLocal] = useState({ ...settings });

  const set = (key, val) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onUpdate(next);
  };

  return (
    <div className="listen-settings-panel pop-in">
      <div className="listen-settings-head">
        <span>{t("listen.settings.title")}</span>
        <button onClick={onClose}><X size={15} /></button>
      </div>

      <div className="listen-settings-section">
        <div className="listen-settings-label">{t("listen.settings.visibility")}</div>
        <div className="listen-settings-opts">
          {[["public", Globe], ["friends", Users], ["invite", Lock]].map(([v, Icon]) => (
            <button key={v} className={`listen-settings-opt ${local.visibility === v ? "active" : ""}`} onClick={() => set("visibility", v)}>
              <Icon size={13} /> {t(`listen.settings.vis.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="listen-settings-section">
        <div className="listen-settings-label">{t("listen.settings.canPlay")}</div>
        <div className="listen-settings-opts">
          <button className={`listen-settings-opt ${local.canPlay === "host" ? "active" : ""}`} onClick={() => set("canPlay", "host")}>
            {t("listen.settings.canPlay.host")}
          </button>
          <button className={`listen-settings-opt ${local.canPlay === "all" ? "active" : ""}`} onClick={() => set("canPlay", "all")}>
            {t("listen.settings.canPlay.all")}
          </button>
        </div>
      </div>

      <div className="listen-settings-section">
        <div className="listen-settings-label">{t("listen.settings.canInvite")}</div>
        <div className="listen-settings-opts">
          <button className={`listen-settings-opt ${local.canInvite === "all" ? "active" : ""}`} onClick={() => set("canInvite", "all")}>
            {t("listen.settings.canInvite.all")}
          </button>
          <button className={`listen-settings-opt ${local.canInvite === "host" ? "active" : ""}`} onClick={() => set("canInvite", "host")}>
            {t("listen.settings.canInvite.host")}
          </button>
        </div>
      </div>

      <label className="listen-settings-toggle">
        <div className="listen-settings-toggle-label">
          {local.hideCode ? <EyeOff size={14} /> : <Eye size={14} />}
          {t("listen.settings.hideCode.hint")}
        </div>
        <input type="checkbox" checked={!!local.hideCode} onChange={e => set("hideCode", e.target.checked)} />
        <div className="listen-settings-toggle-switch" />
      </label>
    </div>
  );
}

// ── Playlist Picker ────────────────────────────────────────────
function PlaylistPicker({ token, onPick, onClose }) {
  const t = useT();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/playlists", { token }).then(data => { setPlaylists(data); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const pick = async (pl) => {
    try {
      const full = await api(`/playlists/${pl.id}`, { token });
      if (full.tracks?.length) onPick(full.tracks);
    } catch {}
    onClose();
  };

  return (
    <div className="listen-playlist-picker pop-in">
      <div className="listen-settings-head">
        <span>{t("listen.playlist.title")}</span>
        <button onClick={onClose}><X size={15} /></button>
      </div>
      {loading ? (
        <div style={{ padding: "12px", color: "var(--ink-soft)", fontSize: 13 }}>{t("common.loading")}</div>
      ) : playlists.length === 0 ? (
        <div style={{ padding: "12px", color: "var(--ink-soft)", fontSize: 13 }}>{t("listen.playlist.empty")}</div>
      ) : (
        <div className="listen-playlist-list">
          {playlists.map(pl => (
            <button key={pl.id} className="listen-playlist-item" onClick={() => pick(pl)}>
              <ListMusic size={14} />
              <span className="listen-playlist-name">{pl.title}</span>
              <span className="listen-playlist-count">{pl.track_count || 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public Room Browser ────────────────────────────────────────
function RoomBrowser({ token, onJoin }) {
  const t = useT();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/listen/rooms", { token }).then(data => { setRooms(data); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="listen-browser-empty">{t("common.loading")}</div>;
  if (rooms.length === 0) return <div className="listen-browser-empty">{t("listen.browser.empty")}</div>;

  return (
    <div className="listen-browser-list">
      {rooms.map(r => (
        <div key={r._code} className="listen-browser-item">
          <div className="listen-browser-track">
            {r.track?.coverUrl
              ? <img src={assetUrl(r.track.coverUrl)} className="listen-browser-cover" alt="" />
              : <div className="listen-browser-cover listen-browser-cover-empty"><Music size={12} /></div>
            }
            <div className="listen-browser-info">
              <div className="listen-browser-title">{r.track?.title || t("listen.noTrack")}</div>
              {r.track?.artist && <div className="listen-browser-artist">{r.track.artist}</div>}
            </div>
          </div>
          <div className="listen-browser-meta">
            <div className="listen-browser-members">
              {r.members.slice(0, 3).map((m, i) => (
                m.avatar
                  ? <img key={i} src={assetUrl(m.avatar)} className="lmini-av" alt={m.name} title={m.name} />
                  : <div key={i} className="lmini-av lmini-av-letter" title={m.name}>{(m.name||"?")[0]}</div>
              ))}
              {r.memberCount > 3 && <div className="lmini-av lmini-av-extra">+{r.memberCount - 3}</div>}
            </div>
            <button className="listen-browser-join-btn" onClick={() => onJoin(r._code)}>
              {t("listen.browser.join")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lobby (no active room) ─────────────────────────────────────
function ListenLobby({ token, onCreateRoom, onJoinRoom, onClose }) {
  const t = useT();
  const [joinInput, setJoinInput] = useState("");
  const [tab, setTab] = useState("join");

  return (
    <div className="listen-modal pop-in">
      <div className="listen-head">
        <div className="listen-head-title">
          <Users size={16} /> {t("listen.title")}
        </div>
        <button className="listen-close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="listen-lobby">
        <div className="listen-lobby-icon"><Radio size={36} /></div>
        <h3>{t("listen.lobby.title")}</h3>
        <p>{t("listen.lobby.subtitle")}</p>
        <button className="btn accent listen-create-btn" onClick={onCreateRoom}>
          <Music size={15} /> {t("listen.lobby.create")}
        </button>
        <div className="listen-lobby-tabs">
          <button className={`listen-lobby-tab ${tab === "join" ? "active" : ""}`} onClick={() => setTab("join")}>{t("listen.lobby.tab.join")}</button>
          <button className={`listen-lobby-tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>{t("listen.lobby.tab.browse")}</button>
        </div>
        {tab === "join" && (
          <div className="listen-join-row" style={{ marginTop: 8 }}>
            <input
              className="listen-join-input"
              placeholder={t("listen.lobby.codePlaceholder")}
              value={joinInput}
              onChange={e => setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && joinInput.length >= 4 && onJoinRoom(joinInput)}
              maxLength={6}
              autoFocus
            />
            <button className="btn accent" onClick={() => onJoinRoom(joinInput)} disabled={joinInput.length < 4}>
              {t("listen.lobby.join")}
            </button>
          </div>
        )}
        {tab === "browse" && <RoomBrowser token={token} onJoin={onJoinRoom} />}
      </div>
    </div>
  );
}

// ── Full room modal ────────────────────────────────────────────
function ListenModal({ listenRoom, isHost, playerState, token, me, selfHideCode, onToggleSelfHide, onMinimize, onLeave, onSendChat, onKick, onBan }) {
  const t = useT();
  const [chatText, setChatText] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const chatEndRef = useRef(null);

  const { code, room, chat } = listenRoom;
  const track = room?.track;
  const settings = room?.settings || {};
  const progress = playerState && track?.duration ? (playerState.currentTime / track.duration) : 0;

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chat?.length]);

  const sendChat = () => {
    if (!chatText.trim()) return;
    onSendChat(chatText.trim());
    setChatText("");
  };

  const handleSeek = (e) => {
    if (!isHost || !track?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    Player.seek(frac);
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:seek", position: frac * (track.duration || 0) } }));
  };

  const handlePlaylistPick = (tracks) => {
    const formatted = tracks.map(tr => ({ id: tr.id, title: tr.title, artist: tr.artist, src: tr.src, coverUrl: tr.coverUrl, duration: tr.duration }));
    if (formatted.length === 0) return;
    Player.play(formatted, 0);
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:track", track: formatted[0], queue: formatted.slice(1) } }));
    setShowPlaylist(false);
  };

  const updateSettings = (newSettings) => {
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:settings", settings: newSettings } }));
  };

  const canShowShare = settings.canInvite === "all" || isHost;

  return (
    <div className="listen-modal pop-in">
      <div className="listen-head">
        <div className="listen-head-title">
          <Users size={16} /> {t("listen.title")}
          {code && (
            <span className={`listen-code-badge${(settings.hideCode || selfHideCode) ? " listen-code-blur" : ""}`}>{code}</span>
          )}
          {code && (
            <button
              className="listen-code-eye"
              onClick={onToggleSelfHide}
              title={selfHideCode ? t("listen.code.show") : t("listen.code.hide")}
            >
              {selfHideCode ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {isHost && (
            <button className="listen-close" onClick={() => setShowSettings(v => !v)} title={t("listen.settings.btn")}>
              <Settings size={16} />
            </button>
          )}
          <button className="listen-close" onClick={onMinimize} title={t("listen.minimize")}>
            <ChevronUp size={18} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button className="listen-close" onClick={onLeave} title={t("listen.leave.btn")} style={{ color: "#e05a72" }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {showSettings && isHost && (
        <SettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setShowSettings(false)} />
      )}

      <div className="listen-room">
        {/* Track info */}
        <div className="listen-track">
          {track ? (
            <>
              <div className="listen-cover">
                {track.coverUrl
                  ? <img src={assetUrl(track.coverUrl)} alt={track.title} />
                  : <div className="listen-cover-empty"><Music size={28} /></div>
                }
                {room.playing && <div className="listen-playing-ring" />}
              </div>
              <div className="listen-track-info">
                <div className="listen-track-title">{track.title}</div>
                {track.artist && <div className="listen-track-artist">{track.artist}</div>}
              </div>
              <div className="listen-progress-row">
                <span className="listen-time">{fmt(playerState?.currentTime || 0)}</span>
                <div
                  className={`listen-progress ${isHost ? "listen-progress-host" : ""}`}
                  onClick={handleSeek}
                >
                  <div className="listen-progress-fill" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="listen-time">{fmt(track.duration)}</span>
              </div>
            </>
          ) : (
            <div className="listen-no-track">
              <Music size={32} style={{ opacity: 0.3 }} />
              <span>{isHost ? t("listen.noTrack.host") : t("listen.noTrack")}</span>
            </div>
          )}
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="listen-controls">
            <button className="listen-ctrl-btn" onClick={() => Player.prev()}>
              <SkipBack size={16} />
            </button>
            <button className="listen-ctrl-btn listen-ctrl-main" onClick={() => Player.toggle()}>
              {playerState?.playing ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <button className="listen-ctrl-btn" onClick={() => Player.next()}>
              <SkipForward size={16} />
            </button>
            <button className="listen-ctrl-btn" onClick={() => setShowPlaylist(v => !v)} title={t("listen.playlist.btn")}>
              <ListMusic size={16} />
            </button>
          </div>
        )}
        {!isHost && (
          <div className="listen-guest-hint">{t("listen.guest.hint")}</div>
        )}

        {showPlaylist && isHost && (
          <PlaylistPicker token={token} onPick={handlePlaylistPick} onClose={() => setShowPlaylist(false)} />
        )}

        {/* Members */}
        <div className="listen-members">
          {(room?.members || []).map(m => (
            <div key={m.id} className="listen-member-wrap">
              <div className="listen-member">
                <RoomAvatar name={m.name} avatar={m.avatar} size={32} />
                {m.id === room.hostId && (
                  <div className="listen-host-crown">♛</div>
                )}
              </div>
              {isHost && m.id !== me?.id && (
                <div className="listen-member-actions">
                  <div className="listen-member-action-name">@{m.handle}</div>
                  <button className="listen-member-action-btn" onClick={() => onKick(m.id)}>
                    <UserX size={13} /> {t("listen.kick.btn")}
                  </button>
                  <button className="listen-member-action-btn listen-member-action-ban" onClick={() => onBan(m.id)}>
                    <Shield size={13} /> {t("listen.ban.btn")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="listen-chat">
          <div className="listen-chat-msgs">
            {(!chat || chat.length === 0) && <div className="listen-chat-empty">{t("listen.chat.empty")}</div>}
            {(chat || []).map((c, i) => (
              <div key={i} className={`listen-chat-msg ${c.userId === me?.id ? "mine" : ""}`}>
                {c.userId !== me?.id && <RoomAvatar name={c.name} avatar={c.avatar} size={22} />}
                <div className="listen-chat-bubble">
                  {c.userId !== me?.id && <span className="listen-chat-name">{c.name}</span>}
                  <span className="listen-chat-text">{c.text}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="listen-chat-input">
            <input
              placeholder={t("listen.chat.placeholder")}
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChat()}
              maxLength={300}
            />
            <button onClick={sendChat} disabled={!chatText.trim()}><Send size={15} /></button>
          </div>
        </div>

        {canShowShare && (
          <div className="listen-footer">
            <button className="listen-footer-btn" onClick={() => setShowShare(true)}>
              <QrCode size={14} /> {t("listen.invite.btn")}
            </button>
          </div>
        )}
      </div>

      {showShare && code && createPortal(
        <ShareModal code={code} token={token} settings={settings} onClose={() => setShowShare(false)} />,
        document.body
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────
export default function ListenRoom({ listenRoom, showModal, onOpenModal, onCloseModal, onLeave, onCreateRoom, onJoinRoom, onSendChat, onKick, onBan, token, me, playerState }) {
  const isHost = listenRoom?.room?.hostId === me?.id;
  const [selfHideCode, setSelfHideCode] = useState(() => {
    try { return localStorage.getItem("xalle.listen.hideCode") === "1"; } catch { return false; }
  });

  const toggleSelfHide = () => {
    setSelfHideCode(v => {
      const next = !v;
      try { localStorage.setItem("xalle.listen.hideCode", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <>
      {listenRoom && !showModal && (
        <ListenMini listenRoom={listenRoom} isHost={isHost} playerState={playerState} selfHideCode={selfHideCode} onExpand={onOpenModal} onLeave={onLeave} />
      )}
      {showModal && createPortal(
        <div className="listen-overlay" onClick={e => { if (e.target === e.currentTarget) onCloseModal(); }}>
          {listenRoom ? (
            <ListenModal
              listenRoom={listenRoom} isHost={isHost} playerState={playerState}
              token={token} me={me} selfHideCode={selfHideCode} onToggleSelfHide={toggleSelfHide}
              onMinimize={onCloseModal} onLeave={onLeave} onSendChat={onSendChat}
              onKick={onKick} onBan={onBan}
            />
          ) : (
            <ListenLobby token={token} onCreateRoom={onCreateRoom} onJoinRoom={onJoinRoom} onClose={onCloseModal} />
          )}
        </div>,
        document.body
      )}
    </>
  );
}
