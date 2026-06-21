import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { initials, fullDate, lastSeenText, timeAgo } from "../../lib/format.js";
import { Name, PresenceDot } from "../shared/icons.jsx";
import { useToast, useConfirm } from "../shared/ui.jsx";
import Tip from "../shared/Tip.jsx";
import Achievements from "./Achievements.jsx";
import Md from "../shared/Markdown.jsx";
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";

const PTYPE_COLOR = {
  ban: "#d65f7a", warning: "#d99a2b", mute_posts: "#c8745a", mute_comments: "#c8745a",
  mute_collab: "#7a7ec8", mute_collab_join: "#7a7ec8", mute_whisper: "#5fa8d3",
  lock_name: "#b56db0", lock_avatar: "#b56db0",
};

function ModPanel({ handle, token }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("punish");
  const [type, setType] = useState("warning");
  const [reason, setReason] = useState("");
  const [durVal, setDurVal] = useState("");
  const [durUnit, setDurUnit] = useState("hours");
  const [history, setHistory] = useState(null);
  const [details, setDetails] = useState(null);
  const [forceName, setForceName] = useState("");
  const [modSettings, setModSettings] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const PTYPE_LABEL = {
    warning: t("mod.punishType.warning"),
    ban: t("mod.punishType.ban"),
    mute_posts: t("mod.punishType.mutePosts"),
    mute_comments: t("mod.punishType.muteComments"),
    mute_collab: t("mod.punishType.muteCollab"),
    mute_collab_join: t("mod.punishType.muteCollabJoin"),
    mute_whisper: t("mod.punishType.muteWhisper"),
    lock_name: t("mod.punishType.lockName"),
    lock_avatar: t("mod.punishType.lockAvatar"),
  };

  const MOD_SETTINGS_LABELS = [
    ["allowReactions", t("settings.feed.reactions.label")],
    ["allowComments", t("settings.feed.comments.label")],
    ["showViews", t("settings.feed.views.label")],
    ["showReadTime", t("settings.feed.readTime.label")],
    ["showWhispers", t("settings.feed.whispers.label")],
    ["liveTime", t("settings.feed.liveTime.label")],
    ["animations", t("settings.feed.animations.label")],
    ["compactMode", t("settings.feed.compact.label")],
  ];

  const TIER_LABELS = [t("mod.tier.0"), t("mod.tier.1"), t("mod.tier.2"), t("mod.tier.3"), t("mod.tier.4")];

  const loadHistory = useCallback(() => { api(`/mod/history/${handle}`, { token }).then(setHistory).catch(() => {}); }, [handle, token]);
  const loadDetails = useCallback(() => {
    api(`/mod/user/${handle}`, { token }).then(d => {
      setDetails(d);
      setModSettings(d.settings || {});
    }).catch(() => {});
  }, [handle, token]);
  useEffect(() => { if (open && tab === "punish") loadHistory(); if (open && tab === "details") loadDetails(); }, [open, tab, loadHistory, loadDetails]);

  const computeMinutes = () => {
    if (durUnit === "forever" || !durVal) return null;
    const n = Number(durVal);
    if (durUnit === "minutes") return n;
    if (durUnit === "hours") return n * 60;
    if (durUnit === "days") return n * 1440;
    if (durUnit === "weeks") return n * 10080;
    if (durUnit === "months") return n * 43200;
    return n;
  };

  const punish = async () => {
    if (!(await confirm({ title: t("mod.punish.confirm.title"), message: t("mod.punish.confirm.msg", { type: PTYPE_LABEL[type], handle }), danger: true, okText: t("mod.punish.confirm.ok") }))) return;
    try {
      await api("/mod/punish", { method: "POST", token, body: { handle, type, reason, minutes: computeMinutes() } });
      toast(t("mod.punish.success"), { type: "success" }); setReason(""); setDurVal(""); loadHistory();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const saveModSettings = async (newSettings) => {
    try {
      await api(`/mod/user/${handle}/settings`, { method: "PATCH", token, body: newSettings });
      setModSettings(newSettings);
      toast(t("mod.settings.updated"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const lift = async (id) => { await api(`/mod/lift/${id}`, { method: "POST", token }); toast(t("mod.lift.success"), { type: "info" }); loadHistory(); };
  const doForceName = async () => {
    if (!forceName.trim()) return;
    try { await api(`/mod/user/${handle}/name`, { method: "PATCH", token, body: { name: forceName } }); toast(t("mod.details.nameChanged.toast"), { type: "success" }); setForceName(""); loadDetails(); } catch (e) { toast(e.message, { type: "error" }); }
  };
  const doDeleteAvatar = async () => {
    if (!(await confirm({ title: t("mod.details.deleteAvatar.confirm"), danger: true, okText: t("common.delete") }))) return;
    try { await api(`/mod/user/${handle}/avatar`, { method: "DELETE", token }); toast(t("mod.details.deleteAvatar.toast"), { type: "info" }); loadDetails(); } catch (e) { toast(e.message, { type: "error" }); }
  };

  return (
    <div className="mod2-panel">
      <button className="mod2-toggle" onClick={() => setOpen(v => !v)}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2l7 3v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V5l7-3z"/></svg>
        {t("mod.panel")}
        <span className="mod2-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mod2-body">
          <div className="seg mod2-tabs">
            <button className={tab === "punish" ? "on" : ""} onClick={() => setTab("punish")}>{t("mod.tab.punish")}</button>
            <button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>{t("mod.tab.details")}</button>
          </div>

          {tab === "punish" && (
            <div className="mod2-punish">
              <div className="mod2-type-grid">
                {Object.entries(PTYPE_LABEL).map(([v, l]) => (
                  <button key={v} className={`mod2-type-chip ${type === v ? "on" : ""}`} style={type === v ? { background: PTYPE_COLOR[v] + "22", borderColor: PTYPE_COLOR[v], color: PTYPE_COLOR[v] } : {}} onClick={() => setType(v)}>{l}</button>
                ))}
              </div>
              <div className="mod2-form-row">
                <input className="mod2-input" placeholder={t("mod.reason")} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              {type !== "warning" && (
                <div className="mod2-duration-row">
                  <input className="mod2-input" type="number" min="1" placeholder={t("mod.amount")} value={durVal} onChange={e => setDurVal(e.target.value)} disabled={durUnit === "forever"} />
                  <select className="mod2-input" value={durUnit} onChange={e => setDurUnit(e.target.value)}>
                    <option value="minutes">{t("mod.dur.minutes")}</option>
                    <option value="hours">{t("mod.dur.hours")}</option>
                    <option value="days">{t("mod.dur.days")}</option>
                    <option value="weeks">{t("mod.dur.weeks")}</option>
                    <option value="months">{t("mod.dur.months")}</option>
                    <option value="forever">{t("mod.dur.forever")}</option>
                  </select>
                </div>
              )}
              <button className="btn danger-solid" style={{ width: "100%" }} onClick={punish}>{t("mod.punishBtn")}</button>

              <div className="mod2-history">
                <div className="mod2-h-title">{t("mod.history.title")}</div>
                {history === null ? <div className="empty sm">{t("mod.history.loading")}</div> : history.length === 0 ? <div className="empty sm">{t("mod.history.empty")}</div> : history.map(h => (
                  <div key={h.id} className={`mod2-h-item ${!h.active || h.expired ? "dim" : ""}`}>
                    <span className="mod2-h-badge" style={{ background: (PTYPE_COLOR[h.type] || "#888") + "22", color: PTYPE_COLOR[h.type] || "#888", borderColor: (PTYPE_COLOR[h.type] || "#888") + "55" }}>{PTYPE_LABEL[h.type] || h.type}</span>
                    {h.reason && <span className="mod2-h-reason">«{h.reason}»</span>}
                    <span className="mod2-h-meta">{t("mod.history.by", { handle: h.mod_handle })} · {timeAgo(h.created_at)}{!h.active ? ` · ${t("mod.history.lifted")}` : h.expired ? ` · ${t("mod.history.expired")}` : ""}</span>
                    {h.active && !h.expired && h.type !== "warning" && <button className="mod2-lift" onClick={() => lift(h.id)}>{t("mod.liftBtn")}</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "details" && (
            <div className="mod2-details">
              {!details ? <div className="empty sm">{t("mod.details.loading")}</div> : (
                <>
                  <div className="mod2-info-chips mod2-info-chips-wide">
                    <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.role")}</div><div className="mod2-chip-val">{details.role}</div></div>
                    <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.posts")}</div><div className="mod2-chip-val">{details.postCount}</div></div>
                    <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.subscription")}</div><div className="mod2-chip-val mod2-chip-tier" data-tier={details.subscription_tier || 0}>{TIER_LABELS[details.subscription_tier || 0]}</div></div>
                    <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.name")}</div><div className="mod2-chip-val">{details.name_locked ? t("mod.details.locked") : t("mod.details.free")}</div></div>
                    <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.avatar")}</div><div className="mod2-chip-val">{details.avatar_locked ? t("mod.details.locked") : t("mod.details.free")}</div></div>
                    {details.name_changed_at && <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.nameChanged")}</div><div className="mod2-chip-val">{timeAgo(details.name_changed_at)}</div></div>}
                    {details.created_at && <div className="mod2-chip"><div className="mod2-chip-label">{t("mod.details.registered")}</div><div className="mod2-chip-val">{new Date(details.created_at).toLocaleDateString(localeStr)}</div></div>}
                  </div>

                  <div className="mod2-section">
                    <div className="mod2-sec-title">{t("mod.details.actions")}</div>
                    <div className="mod2-actions-row">
                      <input className="mod2-input" placeholder={t("mod.details.newName")} value={forceName} onChange={e => setForceName(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn accent" onClick={doForceName} disabled={!forceName.trim()}>{t("mod.details.setName")}</button>
                    </div>
                    {details.avatar_url && (
                      <button className="btn ghost" style={{ marginTop: 6, width: "100%" }} onClick={doDeleteAvatar}>{t("mod.details.deleteAvatar")}</button>
                    )}
                  </div>

                  {modSettings !== null && (
                    <div className="mod2-section">
                      <div className="mod2-sec-title">{t("mod.details.userSettings")}</div>
                      <div className="mod2-toggle-list">
                        {MOD_SETTINGS_LABELS.map(([k, label]) => (
                          <div key={k} className="mod2-toggle-row">
                            <span className="mod2-toggle-label">{label}</span>
                            <div className={`toggle ${modSettings[k] !== false ? "on" : ""}`} onClick={() => {
                              const next = { ...modSettings, [k]: modSettings[k] === false };
                              saveModSettings(next);
                            }} role="switch" aria-checked={modSettings[k] !== false} />
                          </div>
                        ))}
                      </div>
                      {modSettings.accent && (
                        <div className="mod2-theme-info">
                          <span className="mod2-theme-dot" style={{ background: modSettings.accent }} />
                          <span className="mod2-theme-label">{t("mod.details.accent")} {modSettings.accent}</span>
                          <span className="mod2-theme-mode">{modSettings.dark ? t("mod.details.dark") : t("mod.details.light")}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mod2-section">
                    <div className="mod2-sec-title">{t("mod.details.sessions", { n: details.sessions?.length || 0 })}</div>
                    {!details.sessions?.length ? <div className="empty sm">{t("mod.details.noSessions")}</div> : details.sessions.map(s => (
                      <div key={s.id} className="mod2-session">
                        <div className="mod2-session-top">
                          <span className="mod2-session-dev">{s.device || t("mod.details.device")}</span>
                          <span className="mod2-session-browser">{s.browser}{s.os ? ` · ${s.os}` : ""}</span>
                        </div>
                        <div className="mod2-session-meta">
                          {s.ip && <span className="mod2-ip">IP: {s.ip}</span>}
                          {s.last_seen && <span>{timeAgo(s.last_seen)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserProfile({ handle, token, me, onClose, onOpenUser, onTag, onMention, onOpenFullProfile, onOpenModPanel, onOpenPost }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState(null);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pinnedPost, setPinnedPost] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const toast = useToast();

  const load = useCallback(() => { api(`/profile/${handle}`, { token }).then(setProfile).catch(() => setProfile(false)); }, [handle, token]);
  useEffect(() => { load(); setTab(null); setPinnedPost(null); setPlaylists(null); }, [load]);
  useEffect(() => {
    if (tab === "followers" || tab === "following") {
      api(`/profile/${handle}/${tab}`, { token }).then(setList).catch(() => setList([]));
    }
    if (tab === "music") {
      api(`/playlists/user/${handle}`, { token }).then(setPlaylists).catch(() => setPlaylists([]));
    }
  }, [tab, handle, token]);
  useEffect(() => {
    if (!profile) return;
    api(`/profile/${handle}/pinned`, { token }).then(p => setPinnedPost(p || null)).catch(() => {});
  }, [profile, handle, token]);

  const toggleFollow = async () => {
    setBusy(true);
    try {
      const p = profile.isFollowing
        ? await api(`/follow/${handle}`, { method: "DELETE", token })
        : await api(`/follow/${handle}`, { method: "POST", token });
      setProfile(p);
      toast(p.isFollowing ? t("profile.followedToast", { name: p.name }) : t("profile.unfollowedToast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(false); }
  };

  const pinPost = async (postId) => {
    try {
      await api(`/profile/pin/${postId}`, { method: "POST", token });
      toast(t("profile.pinnedToast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const unpinPost = async () => {
    try {
      await api("/profile/pin", { method: "DELETE", token });
      setPinnedPost(null);
      toast(t("profile.unpinnedToast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal profile-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("settings.profile")}</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <Tip content={t("profile.openFull")} pos="bottom">
              <button className="btn ghost" onClick={() => { onOpenFullProfile?.(handle); onClose(); }}>⊞</button>
            </Tip>
            {me?.role === "moderator" && <Tip content={t("mod.openPanel")} pos="bottom"><button className="btn ghost" onClick={() => { onOpenModPanel?.(handle); onClose(); }}>🛡</button></Tip>}
            <button className="btn ghost" onClick={onClose}>✕</button>
          </div>
        </div>
        {profile === false ? (
          <div className="empty">{t("profile.notFound")}</div>
        ) : !profile ? (
          <div className="empty">{t("profile.loading")}</div>
        ) : (
          <>
            <div className="up-head">
              <div className="up-head-ava">
                <div className="avatar-wrap">
                  {profile.avatar_url
                    ? <img src={assetUrl(profile.avatar_url)} className="avatar big av-img" alt={profile.name} />
                    : <div className="avatar big">{initials(profile.name)}</div>
                  }
                  <PresenceDot online={profile.online} lastSeen={profile.last_seen} />
                </div>
              </div>
              <div className="up-head-info">
                <div className="profile-userName"><Name name={profile.name} verified={profile.verified} role={profile.role} nameColor={profile.name_color} nameGradient={profile.name_gradient} subTier={profile.sub_tier} /></div>
                <div className="phandle">@{profile.handle}</div>
                <div className="up-status">{profile.online ? t("profile.onlineNow") : lastSeenText(profile.last_seen)}</div>
                {profile.created_at && <div className="joined">{t("profile.joinedAt", { date: fullDate(profile.created_at) })}</div>}
                <div className="up-stats">
                  <button className="up-stat" onClick={() => setTab(tab === "followers" ? null : "followers")}>
                    <b>{profile.followers}</b><span>{t("profile.followers")}</span>
                  </button>
                  <button className="up-stat" onClick={() => setTab(tab === "following" ? null : "following")}>
                    <b>{profile.following}</b><span>{t("profile.following")}</span>
                  </button>
                  <button className="up-stat" onClick={() => setTab(tab === "posts" ? null : "posts")}>
                    <b>{profile.posts}</b><span>{t("profile.posts")}</span>
                  </button>
                  <button className={`up-stat ${tab === "music" ? "active" : ""}`} onClick={() => setTab(tab === "music" ? null : "music")}>
                    <b>🎵</b><span>{t("profile.music")}</span>
                  </button>
                </div>
                {!profile.isSelf && (
                  <button className={`btn ${profile.isFollowing ? "ghost" : "accent"} up-follow`} onClick={toggleFollow} disabled={busy}>
                    {profile.isFollowing ? t("profile.unfollow") : t("profile.follow")}
                  </button>
                )}
              </div>
            </div>

            <Achievements handle={handle} token={token} />

            {pinnedPost && (
              <div className="up-pinned">
                <div className="up-pinned-header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                  <span>{t("profile.pinnedPost")}</span>
                </div>
                <div className="up-pinned-body">
                  <Md>{pinnedPost.body?.slice(0, 200) + (pinnedPost.body?.length > 200 ? "…" : "")}</Md>
                  {pinnedPost.poll && (() => { try { const p = JSON.parse(pinnedPost.poll); return <div className="up-pinned-poll">{t("profile.votingLabel")} {p.question}</div>; } catch { return null; } })()}
                </div>
                <div className="up-pinned-footer">
                  <button className="up-pinned-open" onClick={() => onOpenPost?.(pinnedPost)}>{t("profile.openPost")}</button>
                  {profile.isSelf && <button className="up-pinned-unpin" onClick={unpinPost}>{t("profile.unpin")}</button>}
                </div>
              </div>
            )}

            {(tab === "followers" || tab === "following") && (
              <div className="up-list">
                <div className="up-list-title">{tab === "followers" ? t("profile.followers") : t("profile.following")}</div>
                {list.length === 0 ? <div className="empty sm">{t("common.empty")}</div> : list.map(u => (
                  <button key={u.handle} className="up-list-item" onClick={() => onOpenUser(u.handle)}>
                    {u.avatar_url ? <img src={assetUrl(u.avatar_url)} className="avatar sm av-img" alt={u.name} /> : <div className="avatar sm">{initials(u.name)}</div>}
                    <div className="uli-info"><Name className="uli-name" name={u.name} verified={u.verified} role={u.role} /><span className="uli-handle">@{u.handle}</span></div>
                  </button>
                ))}
              </div>
            )}

            {tab === "music" && (
              <div className="up-music-section">
                <div className="up-list-title">🎵 {t("profile.music")}</div>
                {playlists === null ? (
                  <div className="empty sm">{t("common.loading")}</div>
                ) : playlists.length === 0 ? (
                  <div className="empty sm">{t("profile.music.empty")}</div>
                ) : (
                  <div className="up-playlists-grid">
                    {playlists.map(p => (
                      <div key={p.id} className="up-playlist-card">
                        <div className="up-playlist-cover">
                          {p.cover_url
                            ? <img src={assetUrl(p.cover_url)} alt={p.title} />
                            : <div className="up-playlist-cover-empty">🎵</div>
                          }
                        </div>
                        <div className="up-playlist-title">{p.title}</div>
                        <div className="up-playlist-meta">{p.track_count} {t("profile.music.tracks")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {me?.role === "moderator" && !profile.isSelf && (
              <ModPanel handle={handle} token={token} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
