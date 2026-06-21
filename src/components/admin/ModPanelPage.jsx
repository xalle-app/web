import { useState, useCallback, useEffect, useRef } from "react";
import { Shield } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { timeAgo } from "../../lib/format.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { HeroHeader } from '../shared/HeroHeader.jsx';
import { useT } from "../../contexts/I18nContext.jsx";

const PTYPE_COLOR = {
  ban: "#d65f7a", warning: "#d99a2b", mute_posts: "#c8745a", mute_comments: "#c8745a",
  mute_collab: "#7a7ec8", mute_collab_join: "#7a7ec8", mute_whisper: "#5fa8d3",
  lock_name: "#b56db0", lock_avatar: "#b56db0",
};
const TIER_COLOR = { 0: "#888", 1: "#5fa8d3", 2: "#7a7ec8", 3: "#b56db0", 4: "#d99a2b" };
const ROLE_ICON = { moderator: "🛡", musician: "🎵", user: "👤" };

function makePTypeLabel(t) {
  return {
    warning: t("mod.ptype.warning"), ban: t("mod.ptype.ban"),
    mute_posts: t("mod.ptype.mute_posts"), mute_comments: t("mod.ptype.mute_comments"),
    mute_collab: t("mod.ptype.mute_collab"), mute_collab_join: t("mod.ptype.mute_collab_join"),
    mute_whisper: t("mod.ptype.mute_whisper"), lock_name: t("mod.ptype.lock_name"), lock_avatar: t("mod.ptype.lock_avatar"),
  };
}

function makeTierLabels(t) {
  return { 0: t("mod.tier.0"), 1: t("mod.tier.1"), 2: t("mod.tier.2"), 3: t("mod.tier.3"), 4: t("mod.tier.4") };
}

function trustColor(tf) {
  if (tf >= 80) return "#5b9e6e";
  if (tf >= 60) return "#d99a2b";
  if (tf >= 30) return "#c8745a";
  return "#d65f7a";
}
function trustLabel(tf, t) {
  if (tf >= 80) return t("mod.trust.high");
  if (tf >= 60) return t("mod.trust.medium");
  if (tf >= 30) return t("mod.trust.low");
  return t("mod.trust.critical");
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="mp-stat-card" style={accent ? { borderColor: accent + "55", background: accent + "08" } : {}}>
      <div className="mp-stat-icon" style={accent ? { color: accent } : {}}>{icon}</div>
      <div className="mp-stat-val">{value ?? "—"}</div>
      <div className="mp-stat-label">{label}</div>
      {sub && <div className="mp-stat-sub">{sub}</div>}
    </div>
  );
}

function UserSearchInput({ token, value, onChange, onSelect, loading, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const debounce = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!value.trim() || value.length < 1) { setSuggestions([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await api(`/mod/search-users?q=${encodeURIComponent(value.trim())}`, { token });
        setSuggestions(res || []);
        setShowDrop(true);
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [value, token]);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (u) => { onChange(u.handle); onSelect(u.handle); setShowDrop(false); setSuggestions([]); };

  return (
    <div className="mp-search-wrap" ref={wrapRef}>
      <div className="mp-search-field">
        <span className="mp-search-ico">⌕</span>
        <input
          className="mp-search-input"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setShowDrop(true); }}
          onKeyDown={e => { if (e.key === "Enter") { setShowDrop(false); onSelect(value.trim()); } if (e.key === "Escape") setShowDrop(false); }}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          autoComplete="off"
        />
        {loading && <span className="mp-search-spin">…</span>}
      </div>
      {showDrop && suggestions.length > 0 && (
        <div className="mp-search-drop pop-in">
          {suggestions.map(u => (
            <button key={u.id} className="mp-search-item" onClick={() => pick(u)}>
              <div className="mp-search-avatar">{u.name?.[0]?.toUpperCase() || "?"}</div>
              <div className="mp-search-info">
                <span className="mp-search-name">{u.name}</span>
                <span className="mp-search-handle">@{u.handle}</span>
              </div>
              <div className="mp-search-badges">
                <span className="mp-search-role">{ROLE_ICON[u.role] || "👤"}</span>
                {u.subscription_tier > 0 && (
                  <span className="mp-search-tier" style={{ color: TIER_COLOR[u.subscription_tier] }}>✦</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModPanelPage({ token }) {
  const t = useT();
  const PTYPE_LABEL = makePTypeLabel(t);
  const TIER_LABELS = makeTierLabels(t);

  const [handle, setHandle] = useState("");
  const [searchHandle, setSearchHandle] = useState("");
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState(null);
  const [userTracks, setUserTracks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("punish");
  const [type, setType] = useState("warning");
  const [reason, setReason] = useState("");
  const [durVal, setDurVal] = useState("");
  const [durUnit, setDurUnit] = useState("hours");
  const [forceName, setForceName] = useState("");
  const [modSettings, setModSettings] = useState(null);
  const [subTier, setSubTier] = useState(1);
  const [subDays, setSubDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [trustInput, setTrustInput] = useState("");
  const [pendingTracks, setPendingTracks] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    api("/mod/stats", { token }).then(setStats).catch(() => {});
    setPendingLoading(true);
    api("/v2/mod/tracks/pending", { token })
      .then(setPendingTracks)
      .catch(() => setPendingTracks([]))
      .finally(() => setPendingLoading(false));
  }, [token]);

  const searchFor = async (h) => {
    const q = (h || handle).trim().replace(/^@/, "");
    if (!q) return;
    setHandle(q);
    setLoading(true);
    setSearchHandle(q);
    setDetails(null);
    try {
      const [det, hist] = await Promise.all([
        api(`/mod/user/${q}`, { token }),
        api(`/mod/history/${q}`, { token }),
      ]);
      setDetails(det);
      setHistory(hist);
      setModSettings(det.settings || {});
      setTrustInput(String(det.trust_factor ?? 100));
      setUserTracks(null);
      setTab("punish");
    } catch (e) { toast(e.message, { type: "error" }); setDetails(null); setHistory(null); setUserTracks(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const handler = (e) => { if (e.detail) searchFor(e.detail); };
    window.addEventListener("modpanel:open", handler);
    return () => window.removeEventListener("modpanel:open", handler);
  }, [token]);

  const computeMinutes = () => {
    if (durUnit === "forever" || !durVal) return null;
    const n = Number(durVal);
    return { minutes: n, hours: n * 60, days: n * 1440, weeks: n * 10080, months: n * 43200 }[durUnit] ?? n;
  };

  const punish = async () => {
    if (!(await confirm({ title: t("mod.punish.confirm.title"), message: `${PTYPE_LABEL[type]} @${searchHandle}`, danger: true, okText: t("mod.punish.btn") }))) return;
    try {
      const r = await api("/mod/punish", { method: "POST", token, body: { handle: searchHandle, type, reason, minutes: computeMinutes() } });
      toast(t("mod.punish.toast"), { type: "success" });
      setReason(""); setDurVal("");
      setHistory(r.history);
      api("/mod/stats", { token }).then(setStats).catch(() => {});
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const saveModSettings = async (next) => {
    try {
      await api(`/mod/user/${searchHandle}/settings`, { method: "PATCH", token, body: next });
      setModSettings(next);
      toast(t("mod.saved"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const lift = async (id) => {
    await api(`/mod/lift/${id}`, { method: "POST", token });
    toast(t("mod.punish.toast"), { type: "info" });
    const hist = await api(`/mod/history/${searchHandle}`, { token });
    setHistory(hist);
    api("/mod/stats", { token }).then(setStats).catch(() => {});
  };

  const doForceName = async () => {
    if (!forceName.trim()) return;
    try {
      await api(`/mod/user/${searchHandle}/name`, { method: "PATCH", token, body: { name: forceName } });
      toast(t("mod.detail.nameSaved.toast"), { type: "success" });
      setForceName("");
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const doDeleteAvatar = async () => {
    if (!(await confirm({ title: t("mod.detail.deleteAvatar.confirm"), danger: true, okText: t("common.delete") }))) return;
    try {
      await api(`/mod/user/${searchHandle}/avatar`, { method: "DELETE", token });
      toast(t("mod.detail.avatarDeleted.toast"), { type: "info" });
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const grantSub = async () => {
    if (!(await confirm({ title: t("mod.sub.confirm.title"), message: `${TIER_LABELS[subTier]} — ${subDays || "∞"} @${searchHandle}`, okText: t("mod.sub.grant.btn") }))) return;
    try {
      await api("/mod/subscription", { method: "POST", token, body: { handle: searchHandle, tier: subTier, days: subDays } });
      toast(t("mod.sub.granted.toast"), { type: "success" });
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const revokeSub = async () => {
    if (!(await confirm({ title: t("mod.sub.revoke.confirm.title"), danger: true, okText: t("mod.sub.revoke.btn") }))) return;
    try {
      await api(`/mod/subscription/${searchHandle}`, { method: "DELETE", token });
      toast(t("mod.sub.revoked.toast"), { type: "info" });
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const changeRole = async (newRole) => {
    const action = newRole === "moderator" ? t("mod.role.promote.btn") : t("mod.role.demote.btn");
    if (!(await confirm({ title: t("mod.role.confirm.title"), message: `${action} @${searchHandle}`, okText: t("common.confirm") }))) return;
    try {
      await api(`/mod/user/${searchHandle}/role`, { method: "PATCH", token, body: { role: newRole } });
      toast(t("mod.role.toast"), { type: "success" });
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const sendBroadcast = async (critical) => {
    const label = critical ? t("mod.broadcast.critical.label") : t("mod.broadcast.normal.label");
    if (!(await confirm({ title: t("mod.broadcast.confirm.title", { label }), message: t("mod.broadcast.confirm.msg"), okText: t("mod.broadcast.confirm.btn"), danger: critical }))) return;
    try {
      await api("/mod/broadcast-update", { method: "POST", token, body: { critical, message: broadcastMsg || null } });
      toast(t("mod.broadcast.toast"), { type: "success" });
      setBroadcastMsg("");
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const loadTracks = async () => {
    if (!searchHandle) return;
    try {
      const tracks = await api(`/mod/user/${searchHandle}/tracks`, { token });
      setUserTracks(tracks);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const deleteTrack = async (trackId) => {
    if (!(await confirm({ title: t("mod.track.delete.title"), message: t("mod.track.delete.msg"), danger: true, okText: t("common.delete") }))) return;
    try {
      await api(`/mod/track/${trackId}`, { method: "DELETE", token });
      toast(t("mod.track.deleted.toast"), { type: "info" });
      setUserTracks(prev => prev?.filter(x => x.id !== trackId));
      const det = await api(`/mod/user/${searchHandle}`, { token });
      setDetails(det);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const setTrustFactor = async () => {
    const v = parseInt(trustInput, 10);
    if (isNaN(v)) return;
    try {
      const r = await api(`/mod/trust/${searchHandle}`, { method: "PATCH", token, body: { value: v } });
      setDetails(d => ({ ...d, trust_factor: r.trust_factor }));
      setTrustInput(String(r.trust_factor));
      toast(t("mod.trust.set.toast", { v: r.trust_factor }), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const activePunishments = history?.filter(h => h.active && !h.expired) || [];

  const SETTING_LABELS = {
    allowReactions: t("mod.detail.setting.allowReactions"),
    allowComments: t("mod.detail.setting.allowComments"),
    showViews: t("mod.detail.setting.showViews"),
    showReadTime: t("mod.detail.setting.showReadTime"),
    animations: t("mod.detail.setting.animations"),
    compactMode: t("mod.detail.setting.compactMode"),
  };

  return (
    <div className="screen mp-screen">

      <HeroHeader
        icon={<Shield size={32} />}
        title={t("mod.title")}
        subtitle={t("mod.subtitle")}
      />

      {stats && (
        <div className="mp-stats-row">
          <StatCard icon="👥" label={t("mod.stats.users")} value={stats.totalUsers} sub={stats.newUsersToday > 0 ? t("mod.stats.today", { n: stats.newUsersToday }) : null} accent="#5fa8d3" />
          <StatCard icon="📝" label={t("mod.stats.posts")} value={stats.totalPosts} sub={stats.newPostsToday > 0 ? t("mod.stats.today", { n: stats.newPostsToday }) : null} accent="#7a7ec8" />
          <StatCard icon="💬" label={t("mod.stats.comments")} value={stats.totalComments} accent="#5fa8a8" />
          <StatCard icon="⚡" label={t("mod.stats.activeBans")} value={stats.activeBans} accent={stats.activeBans > 0 ? "#d65f7a" : null} />
          <StatCard icon="🚨" label={t("mod.stats.reports")} value={stats.pendingReports} accent={stats.pendingReports > 0 ? "#d99a2b" : null} />
          <StatCard icon="🛡" label={t("mod.stats.mods")} value={stats.totalMods} accent="#b56db0" />
        </div>
      )}

      {stats?.recentPunishments?.length > 0 && (
        <div className="mp-section">
          <div className="mp-section-title">{t("mod.recent.title")}</div>
          <div className="mp-activity-list">
            {stats.recentPunishments.map(p => (
              <div key={p.id} className="mp-activity-row">
                <span className="mp-act-badge" style={{ background: (PTYPE_COLOR[p.type] || "#888") + "22", color: PTYPE_COLOR[p.type] || "#888" }}>{PTYPE_LABEL[p.type] || p.type}</span>
                <button className="mp-act-target btn ghost" onClick={() => { setHandle(p.target_handle); searchFor(p.target_handle); }}>@{p.target_handle}</button>
                {p.reason && <span className="mp-act-reason">«{p.reason}»</span>}
                <span className="mp-act-meta">· {timeAgo(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(pendingLoading || (pendingTracks && pendingTracks.length > 0)) && (
        <div className="mp-section">
          <div className="mp-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            🎵 Треки на модерации
            {pendingTracks && pendingTracks.length > 0 && (
              <span style={{ background: "#d99a2b22", color: "#d99a2b", border: "1px solid #d99a2b44", borderRadius: 8, fontSize: 11, padding: "1px 7px" }}>{pendingTracks.length}</span>
            )}
          </div>
          {pendingLoading ? (
            <div className="mp-empty">Загрузка...</div>
          ) : (
            <div className="mp-pending-tracks">
              {pendingTracks.map(trk => (
                <div key={trk.id} className="mp-pending-track-row">
                  {trk.coverUrl
                    ? <img src={assetUrl(trk.coverUrl)} className="mp-pending-cover" alt="" />
                    : <div className="mp-pending-cover mp-pending-cover-empty">♪</div>
                  }
                  <div className="mp-pending-info">
                    <div className="mp-pending-title">{trk.title}</div>
                    <div className="mp-pending-meta">
                      {trk.artist && <span>{trk.artist}</span>}
                      <button className="btn ghost" style={{ fontSize: 11, padding: "1px 6px" }}
                        onClick={() => { setHandle(trk.uploaderHandle || ""); searchFor(trk.uploaderHandle || ""); }}>
                        @{trk.uploaderHandle || "?"} {trk.uploaderName ? `(${trk.uploaderName})` : ""}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn accent" style={{ fontSize: 12, padding: "5px 12px" }}
                      onClick={async () => {
                        try {
                          await api(`/v2/mod/tracks/${trk.id}/approve`, { method: "POST", token });
                          setPendingTracks(l => l.filter(x => x.id !== trk.id));
                          toast("Трек одобрен", { type: "success" });
                        } catch (e) { toast(e.message, { type: "error" }); }
                      }}>
                      Одобрить
                    </button>
                    <button className="btn danger-solid" style={{ fontSize: 12, padding: "5px 12px" }}
                      onClick={async () => {
                        if (!(await confirm({ title: "Удалить трек?", message: `«${trk.title}»`, danger: true, okText: "Удалить" }))) return;
                        try {
                          await api(`/v2/mod/tracks/${trk.id}/reject`, { method: "POST", token });
                          setPendingTracks(l => l.filter(x => x.id !== trk.id));
                          toast("Трек отклонён", { type: "info" });
                        } catch (e) { toast(e.message, { type: "error" }); }
                      }}>
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mp-section">
        <div className="mp-section-title">{t("mod.search.title")}</div>
        <div className="mp-search-row">
          <UserSearchInput token={token} value={handle} onChange={setHandle} onSelect={searchFor} loading={loading} placeholder={t("mod.search.placeholder")} />
          <button className="btn accent mp-search-btn" onClick={() => searchFor(handle)} disabled={loading || !handle.trim()}>
            {loading ? "…" : t("mod.search.btn")}
          </button>
        </div>
      </div>

      {details && (
        <div className="mp-user-card">
          <div className="mp-user-top">
            {details.avatar_url
              ? <img className="mp-user-ava" src={assetUrl(details.avatar_url)} alt="" style={{ objectFit: "cover", fontSize: 0 }} />
              : <div className="mp-user-ava" style={{ background: details.name_color || "var(--accent)" }}>{details.name?.[0]?.toUpperCase() || "?"}</div>
            }
            <div className="mp-user-info">
              <div className="mp-user-name">{details.name} <span className="mp-user-role-ico">{ROLE_ICON[details.role] || "👤"}</span></div>
              <div className="mp-user-handle">@{details.handle}</div>
              <div className="mp-user-pills">
                <span className="mp-pill" style={{ background: details.role === "moderator" ? "var(--accent)" : details.role === "musician" ? "#7a7ec822" : "var(--surface)", color: details.role === "moderator" ? "#fff" : details.role === "musician" ? "#7a7ec8" : "var(--ink-soft)" }}>
                  {details.role === "moderator" ? t("mod.role.moderator") : details.role === "musician" ? "🎵 Музыкант" : t("mod.role.user")}
                </span>
                {details.subscription_tier > 0 && (
                  <span className="mp-pill mp-pill-tier" style={{ color: TIER_COLOR[details.subscription_tier] }}>
                    ✦ {TIER_LABELS[details.subscription_tier]}
                  </span>
                )}
                {activePunishments.length > 0 && (
                  <span className="mp-pill mp-pill-warn">⚡ {t("mod.punish.active", { n: activePunishments.length })}</span>
                )}
              </div>
            </div>
            <div className="mp-user-counts">
              <div className="mp-user-count"><b>{details.postCount || 0}</b><span>{t("mod.user.posts")}</span></div>
              <div className="mp-user-count"><b>{details.trackCount || 0}</b><span>{t("mod.user.tracks")}</span></div>
              <div className="mp-trust-badge" style={{ color: trustColor(details.trust_factor ?? 100), borderColor: trustColor(details.trust_factor ?? 100) + "44", background: trustColor(details.trust_factor ?? 100) + "12" }}>
                <span className="mp-trust-val">{details.trust_factor ?? 100}</span>
                <span className="mp-trust-lbl">{trustLabel(details.trust_factor ?? 100, t)}</span>
              </div>
            </div>
          </div>

          <div className="mp-tabs">
            {[
              ["punish","⚖",t("mod.tab.punish")],
              ["tracks","🎵",t("mod.tab.tracks")],
              ["trust","🛡",t("mod.tab.trust")],
              ["sub","✦",t("mod.tab.sub")],
              ["role","👤",t("mod.tab.role")],
              ["details","⚙",t("mod.tab.details")],
            ].map(([k,ico,label]) => (
              <button key={k} className={`mp-tab ${tab === k ? "on" : ""}`}
                onClick={() => { setTab(k); if (k === "tracks" && userTracks === null) loadTracks(); }}>
                <span className="mp-tab-ico">{ico}</span>
                <span className="mp-tab-label">{label}</span>
              </button>
            ))}
          </div>

          {tab === "punish" && (
            <div className="mp-tab-body">
              <div className="mp-type-grid">
                {Object.entries(PTYPE_LABEL).map(([v, l]) => (
                  <button key={v} className={`mp-type-chip ${type === v ? "on" : ""}`}
                    style={type === v ? { background: PTYPE_COLOR[v] + "20", borderColor: PTYPE_COLOR[v], color: PTYPE_COLOR[v] } : {}}
                    onClick={() => setType(v)}>{l}</button>
                ))}
              </div>
              <input className="mp-input" placeholder={t("mod.punish.reason.placeholder")} value={reason} onChange={e => setReason(e.target.value)} />
              {type !== "warning" && (
                <div className="mp-dur-row">
                  <input className="mp-input" type="number" min="1" placeholder={t("mod.dur.amount")} value={durVal} onChange={e => setDurVal(e.target.value)} disabled={durUnit === "forever"} style={{ maxWidth: 90 }} />
                  <select className="mp-input" value={durUnit} onChange={e => setDurUnit(e.target.value)}>
                    <option value="minutes">{t("mod.dur.minutes")}</option>
                    <option value="hours">{t("mod.dur.hours")}</option>
                    <option value="days">{t("mod.dur.days")}</option>
                    <option value="weeks">{t("mod.dur.weeks")}</option>
                    <option value="months">{t("mod.dur.months")}</option>
                    <option value="forever">{t("mod.dur.forever")}</option>
                  </select>
                </div>
              )}
              <button className="btn danger-solid mp-punish-btn" onClick={punish}>{t("mod.punish.confirm.title")}</button>

              <div className="mp-history">
                <div className="mp-history-title">{t("mod.history.title")}</div>
                {!history ? <div className="mp-empty">{t("common.loading")}</div>
                  : history.length === 0 ? <div className="mp-empty">{t("mod.history.empty")}</div>
                  : history.map(h => (
                  <div key={h.id} className={`mp-history-item ${!h.active || h.expired ? "dim" : ""}`}>
                    <span className="mp-h-badge" style={{ background: (PTYPE_COLOR[h.type] || "#888") + "18", color: PTYPE_COLOR[h.type] || "#888", borderColor: (PTYPE_COLOR[h.type] || "#888") + "44" }}>{PTYPE_LABEL[h.type] || h.type}</span>
                    {h.reason && <span className="mp-h-reason">«{h.reason}»</span>}
                    <span className="mp-h-meta">@{h.mod_handle} · {timeAgo(h.created_at)}{!h.active ? ` · ${t("mod.punish.lifted")}` : h.expired ? ` · ${t("mod.punish.expired")}` : ""}</span>
                    {h.active && !h.expired && h.type !== "warning" && <button className="mp-lift-btn" onClick={() => lift(h.id)}>{t("mod.lift.btn")}</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "tracks" && (
            <div className="mp-tab-body">
              {userTracks === null ? (
                <div className="mp-empty">{t("common.loading")}</div>
              ) : userTracks.length === 0 ? (
                <div className="mp-empty">{t("mod.tracks.empty")}</div>
              ) : userTracks.map(trk => (
                <div key={trk.id} className="mp-track-row">
                  <div className="mp-track-info">
                    <div className="mp-track-title">{trk.title}</div>
                    <div className="mp-track-meta">
                      {trk.artist && <span>{trk.artist}</span>}
                      <span>{trk.public ? t("mod.track.public") : t("mod.track.private")}</span>
                      {trk.play_count > 0 && <span>▶ {trk.play_count}</span>}
                      {trk.like_count > 0 && <span>♥ {trk.like_count}</span>}
                    </div>
                  </div>
                  <button className="btn danger-solid" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => deleteTrack(trk.id)}>{t("common.delete")}</button>
                </div>
              ))}
            </div>
          )}

          {tab === "trust" && (
            <div className="mp-tab-body">
              <div className="mp-trust-display" style={{ borderColor: trustColor(details.trust_factor ?? 100) + "44" }}>
                <div className="mp-trust-big" style={{ color: trustColor(details.trust_factor ?? 100) }}>{details.trust_factor ?? 100}</div>
                <div className="mp-trust-status" style={{ color: trustColor(details.trust_factor ?? 100) }}>{trustLabel(details.trust_factor ?? 100, t)}</div>
                <div className="mp-trust-bar">
                  <div className="mp-trust-fill" style={{ width: `${details.trust_factor ?? 100}%`, background: trustColor(details.trust_factor ?? 100) }} />
                </div>
                <div className="mp-trust-hint">{t("mod.trust.hint")}</div>
              </div>
              <div className="mp-subsect-title" style={{ marginTop: 14 }}>{t("mod.trust.manual.title")}</div>
              <div className="mp-dur-row">
                <input className="mp-input" type="number" min="0" max="100" value={trustInput} onChange={e => setTrustInput(e.target.value)} style={{ maxWidth: 80 }} />
                <button className="btn accent" onClick={setTrustFactor}>{t("mod.trust.set.btn")}</button>
                <button className="btn ghost" onClick={async () => {
                  try {
                    const r = await api(`/mod/trust/${searchHandle}`, { method: "PATCH", token, body: { delta: 10 } });
                    setDetails(d => ({ ...d, trust_factor: r.trust_factor }));
                    setTrustInput(String(r.trust_factor));
                    toast(t("mod.trust.set.toast", { v: r.trust_factor }), { type: "success" });
                  } catch(e) { toast(e.message, { type: "error" }); }
                }}>+10</button>
                <button className="btn ghost danger" onClick={async () => {
                  try {
                    const r = await api(`/mod/trust/${searchHandle}`, { method: "PATCH", token, body: { delta: -10 } });
                    setDetails(d => ({ ...d, trust_factor: r.trust_factor }));
                    setTrustInput(String(r.trust_factor));
                    toast(t("mod.trust.set.toast", { v: r.trust_factor }), { type: "info" });
                  } catch(e) { toast(e.message, { type: "error" }); }
                }}>-10</button>
              </div>
              <div className="mp-trust-scale">
                {[[100, t("mod.trust.scale.100")], [80, t("mod.trust.scale.80")], [60, t("mod.trust.scale.60")], [30, t("mod.trust.scale.30")], [0, t("mod.trust.scale.0")]].map(([v, lbl]) => (
                  <button key={v} className="btn ghost" style={{ fontSize: 12 }} onClick={() => setTrustInput(String(v))}>{lbl}</button>
                ))}
              </div>
            </div>
          )}

          {tab === "role" && (
            <div className="mp-tab-body">
              <div className="mp-role-current">
                <div className="mp-role-big-icon">{details.role === "moderator" ? "🛡" : details.role === "musician" ? "🎵" : "👤"}</div>
                <div>
                  <div className="mp-role-name">{details.role === "moderator" ? t("mod.role.moderator") : details.role === "musician" ? "Музыкант" : t("mod.role.user")}</div>
                  {details.id === 1 && <div className="mp-role-lock">{t("mod.role.superlock")}</div>}
                </div>
              </div>
              {details.role !== "moderator" ? (
                <button className="btn accent" style={{ width: "100%", marginTop: 12 }} onClick={() => changeRole("moderator")}>{t("mod.role.promote.btn")}</button>
              ) : details.id !== 1 ? (
                <button className="btn ghost danger" style={{ width: "100%", marginTop: 12 }} onClick={() => changeRole("user")}>{t("mod.role.demote.btn")}</button>
              ) : null}
              {details.role !== "moderator" && (
                <button
                  className={`btn ${details.role === "musician" ? "ghost danger" : "ghost"}`}
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const grant = details.role !== "musician";
                      await api(`/v2/mod/users/${searchHandle}/musician`, { method: "POST", token, body: { grant } });
                      const det = await api(`/mod/user/${searchHandle}`, { token });
                      setDetails(det);
                      toast(grant ? "Роль Музыкант выдана" : "Роль Музыкант снята", { type: "success" });
                    } catch (e) { toast(e.message, { type: "error" }); }
                  }}
                >
                  {details.role === "musician" ? "🎵 Снять роль Музыкант" : "🎵 Выдать роль Музыкант"}
                </button>
              )}
              <p className="mp-role-hint">{t("mod.role.hint")}</p>
              <p className="mp-role-hint" style={{ marginTop: 4 }}>Музыкант: треки загружаются без проверки модератора.</p>
            </div>
          )}

          {tab === "sub" && (
            <div className="mp-tab-body">
              <div className="mp-sub-info">
                <div className="mp-sub-level" style={{ color: TIER_COLOR[details.subscription_tier || 0] }}>
                  {details.subscription_tier > 0 ? `✦ ${TIER_LABELS[details.subscription_tier]}` : t("mod.sub.none")}
                </div>
                {details.subscription_expires && <div className="mp-sub-exp">{t("mod.sub.expires")} {details.subscription_expires}</div>}
              </div>
              <div className="mp-sub-grant">
                <div className="mp-dur-row">
                  <select className="mp-input" value={subTier} onChange={e => setSubTier(Number(e.target.value))}>
                    {Object.entries(TIER_LABELS).filter(([k]) => k > 0).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input className="mp-input" type="number" placeholder={t("mod.sub.days.placeholder")} value={subDays} onChange={e => setSubDays(e.target.value)} style={{ maxWidth: 120 }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn accent" style={{ flex: 1 }} onClick={grantSub}>{t("mod.sub.grant.btn")}</button>
                  {details.subscription_tier > 0 && <button className="btn ghost danger" onClick={revokeSub}>{t("mod.sub.revoke.btn")}</button>}
                </div>
              </div>
            </div>
          )}

          {tab === "details" && (
            <div className="mp-tab-body">
              <div className="mp-detail-grid">
                {[
                  [t("mod.detail.posts"), details.postCount || 0],
                  [t("mod.detail.created"), details.created_at ? new Date(details.created_at).toLocaleDateString() : "—"],
                  [t("mod.detail.name"), details.name_locked ? t("mod.detail.locked") : t("mod.detail.free")],
                  [t("mod.detail.avatar"), details.avatar_locked ? t("mod.detail.locked") : t("mod.detail.free")],
                  details.name_changed_at && [t("mod.detail.nameChanged"), timeAgo(details.name_changed_at)],
                ].filter(Boolean).map(([l, v]) => (
                  <div key={l} className="mp-detail-chip"><div className="mp-detail-label">{l}</div><div className="mp-detail-val">{v}</div></div>
                ))}
              </div>

              <div className="mp-subsect">
                <div className="mp-subsect-title">{t("mod.detail.changeName.title")}</div>
                <div className="mp-dur-row">
                  <input className="mp-input" placeholder={t("mod.detail.name.placeholder")} value={forceName} onChange={e => setForceName(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn accent" onClick={doForceName} disabled={!forceName.trim()}>{t("mod.detail.setName.btn")}</button>
                </div>
                {details.avatar_url && <button className="btn ghost" style={{ marginTop: 6, width: "100%" }} onClick={doDeleteAvatar}>{t("mod.detail.deleteAvatar.btn")}</button>}
              </div>

              {modSettings !== null && (
                <div className="mp-subsect">
                  <div className="mp-subsect-title">{t("mod.detail.settings.title")}</div>
                  <div className="mp-toggle-grid">
                    {Object.entries(SETTING_LABELS).map(([k, label]) => (
                      <div key={k} className="mp-toggle-item">
                        <span>{label}</span>
                        <div className={`toggle ${modSettings[k] !== false ? "on" : ""}`} onClick={() => saveModSettings({ ...modSettings, [k]: modSettings[k] === false })} role="switch" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mp-subsect">
                <div className="mp-subsect-title">{t("mod.detail.sessions", { n: details.sessions?.length || 0 })}</div>
                {!details.sessions?.length ? <div className="mp-empty">{t("mod.detail.sessions.empty")}</div> : details.sessions.map(s => (
                  <div key={s.id} className="mp-session">
                    <div className="mp-session-dev">{s.device || t("sec.session.device")} {s.browser && `· ${s.browser}`}</div>
                    <div className="mp-session-meta">{s.ip && <span>IP: {s.ip}</span>} {s.last_seen && <span>{timeAgo(s.last_seen)}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mp-section mp-broadcast">
        <div className="mp-section-title">{t("mod.broadcast.title")}</div>
        <input className="mp-input" placeholder={t("mod.broadcast.placeholder")} value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => sendBroadcast(false)}>
            {t("mod.broadcast.normal")} <span style={{ opacity: 0.6, fontSize: 11 }}>{t("mod.broadcast.normal.hint")}</span>
          </button>
          <button className="btn danger-solid" style={{ flex: 1 }} onClick={() => sendBroadcast(true)}>
            {t("mod.broadcast.critical")} <span style={{ fontSize: 11 }}>{t("mod.broadcast.critical.hint")}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
