import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api, uploadImages, isVideoUrl } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import VideoPlayer from "../shared/VideoPlayer.jsx";
import { useToast, useConfirm } from "../shared/ui.jsx";
import Md from "../shared/Markdown.jsx";
import PostBody from "../shared/PostBody.jsx";
import { Name, Av } from "../shared/icons.jsx";
import { ImagePlus, Send, X, ArrowLeft, PenSquare, Search, Star, BellOff, Pencil, EyeOff, Trash2, Copy, Lock, ChevronRight, Flag, VolumeX, Volume2, ShieldBan, User, Users, Smile, Timer, Share2, Mic, Square, Phone } from "lucide-react";
import VoiceMessage from "../shared/VoiceMessage.jsx";
import ForwardModal from "../shared/ForwardModal.jsx";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder.js";
import EmojiPicker from "../composer/EmojiPicker.jsx";
import GroupView from "./GroupView.jsx";
import ReplyQuote from "../shared/ReplyQuote.jsx";
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";

// ─── Strip markdown for preview ───────────────────────────────
function stripMd(text) {
  if (!text) return "";
  return text
    .replace(/\|\|.+?\|\|/g, "[…]")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .trim();
}

function previewMsg(text, t) {
  if (!text) return "";
  if (/[?&]listen=[A-Za-z0-9_-]{4,}/.test(text)) return t("messages.preview.listen");
  if (/[?&]playlist=[A-Za-z0-9_-]{4,}/.test(text)) return t("messages.preview.playlist");
  if (/[?&]track=[A-Za-z0-9_-]{4,}/.test(text)) return t("messages.preview.track");
  if (/https?:\/\/[^\s]+#track-\d+/.test(text)) return t("messages.preview.track");
  return stripMd(text);
}

// ─── Helpers (locale-aware) ────────────────────────────────────
function fmtTime(dt, locale) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
function fmtFull(dt, locale) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(dt, locale, t) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("common.today");
  if (d.toDateString() === yest.toDateString()) return t("common.yesterday");
  return d.toLocaleDateString(locale, { day: "numeric", month: "long" });
}
function fmtOnline(dt, showOnline, locale, t) {
  if (!showOnline) return null;
  if (!dt) return null;
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  if (diff < 300000) return t("messages.online");
  if (diff < 3600000) return t("messages.wasOnline.minutes", { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t("messages.wasOnline.hours", { n: Math.floor(diff / 3600000) });
  return t("messages.wasOnline.date", { date: d.toLocaleDateString(locale, { day: "numeric", month: "short" }) });
}
function timeAgo(dt, locale, t) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return t("common.now");
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return fmtTime(dt, locale);
  if (d.toDateString() === yest.toDateString()) return t("messages.yesterday");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

// ─── DMTip – custom tooltip (portal, not clipped by overflow) ──
function DMTip({ children, text, pos = "top" }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef(null);

  const updateCoords = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const GAP = 8;
    let x = 0, y = 0;
    if (pos === "top")    { x = r.left + r.width / 2; y = r.top - GAP; }
    if (pos === "bottom") { x = r.left + r.width / 2; y = r.bottom + GAP; }
    if (pos === "left")   { x = r.left - GAP; y = r.top + r.height / 2; }
    if (pos === "right")  { x = r.right + GAP; y = r.top + r.height / 2; }
    setCoords({ x, y });
  };

  if (!text) return children;

  const tipStyle = {
    position: "fixed", zIndex: 9900, pointerEvents: "none",
    ...(pos === "top"    ? { left: coords.x, bottom: `calc(100vh - ${coords.y}px)`, transform: "translateX(-50%)" } : {}),
    ...(pos === "bottom" ? { left: coords.x, top: coords.y, transform: "translateX(-50%)" } : {}),
    ...(pos === "left"   ? { right: `calc(100vw - ${coords.x}px)`, top: coords.y, transform: "translateY(-50%)" } : {}),
    ...(pos === "right"  ? { left: coords.x, top: coords.y, transform: "translateY(-50%)" } : {}),
  };

  return (
    <span ref={wrapRef} className="dmtip-wrap"
      onMouseEnter={() => { updateCoords(); setShow(true); }}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && createPortal(<span className="dmtip" style={tipStyle}>{text}</span>, document.body)}
    </span>
  );
}

// ─── GradientName ──────────────────────────────────────────────
function GName({ name, nameColor, tier, className = "" }) {
  if (!nameColor) return <span className={className}>{name}</span>;
  const isGrad = nameColor.includes("gradient");
  if (isGrad) return (
    <span className={className} style={{ background: nameColor, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{name}</span>
  );
  return <span className={className} style={{ color: nameColor }}>{name}</span>;
}

// ─── Avatar ────────────────────────────────────────────────────

function Badge({ verified, role }) {
  if (role === "moderator") return <span className="ub mod" title="Модератор">🛡</span>;
  if (verified) return <span className="ub ver" title="Верифицирован">✦</span>;
  return null;
}

// ─── Context menu portal ───────────────────────────────────────
function CtxMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const isMobileSheet = window.innerWidth <= 640;

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) onClose(); };
    const k = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h, { passive: true });
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
      document.removeEventListener("keydown", k);
    };
  }, [onClose]);

  if (isMobileSheet) {
    return createPortal(
      <div className="dm-ctx-sheet-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} onTouchStart={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="dm-ctx dm-ctx-sheet" ref={ref}>
          <div className="dm-ctx-sheet-handle" />
          {items.map((item, i) => item === null ? (
            <div key={i} className="dm-ctx-sep" />
          ) : (
            <button key={i} className={`dm-ctx-item ${item.danger ? "dm-ctx-danger" : ""} ${!item.icon && typeof item.label !== "string" ? "dm-ctx-react-row" : ""}`}
              onClick={() => { if (typeof item.label === "string") { item.action(); onClose(); } }} disabled={item.disabled}>
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  }

  // Keep menu in viewport
  const menuWidth = 200; const menuHeight = items.length * 40;
  const cx = (x + menuWidth > window.innerWidth) ? x - menuWidth : x;
  const cy = (y + menuHeight > window.innerHeight) ? y - menuHeight : y;

  return createPortal(
    <div className="dm-ctx" style={{ left: cx, top: cy }} ref={ref}>
      {items.map((item, i) => item === null ? (
        <div key={i} className="dm-ctx-sep" />
      ) : (
        <button key={i} className={`dm-ctx-item ${item.danger ? "dm-ctx-danger" : ""} ${!item.icon && typeof item.label !== "string" ? "dm-ctx-react-row" : ""}`}
          onClick={() => { if (typeof item.label === "string") { item.action(); onClose(); } }} disabled={item.disabled}>
          {item.icon && <span>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ─── Format context menu ───────────────────────────────────────
function FormatMenu({ x, y, textareaRef, onChange, onClose }) {
  const t = useT();
  const wrap = (before, after) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const sel = val.slice(start, end);
    const newVal = val.slice(0, start) + before + sel + after + val.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
    onClose();
  };
  return (
    <CtxMenu x={x} y={y} onClose={onClose} items={[
      { icon: "𝐁", label: t("messages.fmt.bold"), action: () => wrap("**", "**") },
      { icon: "𝑖", label: t("messages.fmt.italic"), action: () => wrap("*", "*") },
      { icon: "`", label: t("messages.fmt.code"), action: () => wrap("`", "`") },
      { icon: "~~", label: t("messages.fmt.strike"), action: () => wrap("~~", "~~") },
      null,
      { icon: ">", label: t("messages.fmt.quote"), action: () => wrap("> ", "") },
    ]} />
  );
}

// ─── New conversation modal ────────────────────────────────────
function NewConvModal({ token, onOpen, onClose }) {
  const t = useT();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setBusy(true);
    try { const r = await api(`/messages/open/${h}`, { method: "POST", token }); onOpen(r.convId); }
    catch (e) { toast(e.message || t("messages.userNotFound"), { type: "error" }); }
    finally { setBusy(false); }
  };
  return (
    <div className="dm-overlay" onClick={onClose}>
      <div className="dm-newmsg pop-in" onClick={e => e.stopPropagation()}>
        <div className="dm-newmsg-head">
          <span>{t("messages.newMsgTitle")}</span>
          <button className="dm-newmsg-x" onClick={onClose}><X size={16} /></button>
        </div>
        <input className="dm-newmsg-input" placeholder={t("messages.newMsgPlaceholder")} value={handle}
          onChange={e => setHandle(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
        <div className="dm-newmsg-foot">
          <button className="dm-btn-sec" onClick={onClose}>{t("common.cancel")}</button>
          <button className="dm-btn-pri" onClick={submit} disabled={busy || !handle.trim()}>{t("messages.openChat")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation sidebar ──────────────────────────────────────
function ConvSidebar({ convs, activeId, onSelect, onNew, search, setSearch, isCollapsed, hiddenOnMobile, width, onResizeStart, typingConvIds, onBack, onConvCtxMenu }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const filtered = search.trim()
    ? convs.filter(c => c.other_name?.toLowerCase().includes(search.toLowerCase()) || c.other_handle?.toLowerCase().includes(search.toLowerCase()))
    : convs;

  return (
    <aside className={`dm-side${hiddenOnMobile ? " dm-side-hidden" : ""}`} style={{ width }}>
      <div className="dm-side-top">
        <div className="dm-side-brand">
          <DMTip text={t("messages.backToFeed")} pos="right">
            <button className="dm-back-desktop" onClick={onBack} aria-label={t("messages.navBack")}>
              <ArrowLeft size={16} />
            </button>
          </DMTip>
          <span className="dm-side-title">{t("messages.title")}</span>
          <DMTip text={t("messages.newChat")} pos="bottom">
            <button className="dm-side-new" onClick={onNew}>
              <PenSquare size={16} />
            </button>
          </DMTip>
        </div>
        <div className="dm-search-wrap">
          <Search className="dm-search-ico" size={14} />
          <input className="dm-search" placeholder={t("messages.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="dm-search-x" onClick={() => setSearch("")}><X size={13} /></button>}
        </div>
      </div>

      <div className="dm-convs">
        {filtered.length === 0 && (
          <div className="dm-convs-empty">
            {search ? t("common.noResults") : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div>{t("messages.startChat")}</div>
                <button className="dm-btn-pri" style={{ marginTop: 12, fontSize: 13 }} onClick={onNew}>{t("messages.writeToSomeone")}</button>
              </>
            )}
          </div>
        )}
        {filtered.map(c => {
          const onlineStatus = !c.is_self && fmtOnline(c.other_last_seen, c.other_show_online, localeStr, t);
          const isOnline = onlineStatus === t("messages.online");
          const active = activeId === c.id;
          const isTyping = typingConvIds.has(c.id);
          let lpTimer = null;
          return (
            <button key={c.id}
              className={`dm-ci ${active ? "dm-ci-on" : ""} ${c._leaving ? "dm-ci-leaving" : ""}`}
              onClick={() => onSelect(c)}
              onContextMenu={e => { e.preventDefault(); onConvCtxMenu?.(e.clientX, e.clientY, c); }}
              onTouchStart={e => { const touch = e.touches[0]; lpTimer = setTimeout(() => { onConvCtxMenu?.(touch.clientX, touch.clientY, c); }, 600); }}
              onTouchEnd={() => clearTimeout(lpTimer)}
              onTouchMove={() => clearTimeout(lpTimer)}>
              {c.is_self
                ? <div className="dm-self-av" style={{ width: 46, height: 46 }}><Star size={22} fill="currentColor" /></div>
                : <Av name={c.other_name} avatar={c.other_avatar} size={46} tier={c.other_tier} isOnline={isOnline} />
              }
              <div className="dm-ci-body">
                <div className="dm-ci-row1">
                  <span className="dm-ci-name">
                    {c.is_self ? t("messages.favorites") : (
                      <Name name={c.other_name} verified={c.other_verified} role={c.other_role}
                        nameColor={c.other_name_color} nameGradient={c.other_name_gradient}
                        subTier={c.other_tier} />
                    )}
                    {c.iBlocked && <span className="dm-ci-blocked" title={t("messages.block")}><ShieldBan size={12} /></span>}
                  </span>
                  <span className="dm-ci-ts">{timeAgo(c.last_at, localeStr, t)}</span>
                </div>
                <div className="dm-ci-row2">
                  {c.muted && <span className="dm-ci-muted" title={t("messages.mutedTip")}><BellOff size={11} /></span>}
                  <span className={`dm-ci-preview ${isTyping ? "dm-ci-typing" : ""}`}>
                    {isTyping ? <>{t("messages.typing")}<span className="dm-typing-dots"><span/><span/><span/></span></> : (previewMsg(c.last_msg, t) || t("messages.noMessages"))}
                  </span>
                </div>
              </div>
              {c.unread > 0 && (
                <span className="dm-badge">{c.unread > 9 ? "9+" : c.unread}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="dm-resize-handle" onMouseDown={onResizeStart}>
        <DMTip text={t("messages.resizeHint")} pos="right">
          <div className="dm-resize-handle-inner" />
        </DMTip>
      </div>
    </aside>
  );
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const BURN_OPTION_KEYS = [
  { labelKey: "messages.burn.off", value: null },
  { labelKey: "messages.burn.viewOnce", value: "view_once" },
  { labelKey: "messages.burn.30s", value: 30 },
  { labelKey: "messages.burn.1m", value: 60 },
  { labelKey: "messages.burn.5m", value: 300 },
  { labelKey: "messages.burn.1h", value: 3600 },
  { labelKey: "messages.burn.24h", value: 86400 },
];

// ─── BurnCountdown — живой таймер на пузыре ────────────────────
function BurnCountdown({ createdAt, burnAfter }) {
  const t = useT();
  if (burnAfter === -1) {
    return (
      <span className="burn-timer burn-view-once" title={t("messages.burn.tooltipOnce")}>
        {t("messages.burn.viewOnceBadge")}
      </span>
    );
  }

  const getLeft = () => {
    const created = new Date(createdAt.replace(" ", "T") + (createdAt.includes("T") ? "" : "Z")).getTime();
    const expiresAt = created + burnAfter * 1000;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  };
  const [left, setLeft] = useState(getLeft);
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft(getLeft()), 1000);
    return () => clearInterval(id);
  }, [burnAfter, createdAt]);

  const fmt = s => s >= 3600 ? `${Math.floor(s/3600)}h` : s >= 60 ? `${Math.floor(s/60)}m` : `${s}s`;
  const pct = Math.max(0, left / burnAfter);
  const urgent = left <= 10;

  return (
    <span className={`burn-timer ${urgent ? "burn-urgent" : ""}`} title={t("messages.burn.tooltip")}>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 5.5}`}
          strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - pct)}`}
          strokeLinecap="round"
          transform="rotate(-90 7 7)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      {fmt(left)}
    </span>
  );
}

// ─── BurnPicker — выбор времени самоуничтожения ───────────────
function BurnPicker({ value, onChange, onClose }) {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div className="burn-picker pop-in" ref={ref}>
      <div className="burn-picker-title">{t("messages.burn.title")}</div>
      {BURN_OPTION_KEYS.map(opt => (
        <button key={String(opt.value)} className={`burn-picker-opt ${value === opt.value ? "burn-picker-on" : ""}`}
          onClick={() => { onChange(opt.value); onClose(); }}>
          {t(opt.labelKey)}
          {value === opt.value && <span>✓</span>}
        </button>
      ))}
    </div>
  );
}

// ─── View-Once fullscreen modal ────────────────────────────────
function ViewOnceModal({ msg, isMine, onDelete, onClose }) {
  const t = useT();
  let imgs = [];
  try { imgs = JSON.parse(msg.images || "[]"); } catch {}
  const hasVideo = imgs.some(a => a.type === "video");
  const showProgress = !isMine && !hasVideo;

  // For non-mine photos: auto-delete after 15s
  useEffect(() => {
    if (!showProgress) return;
    const id = setTimeout(onDelete, 15000);
    return () => clearTimeout(id);
  }, []);

  const handleClose = () => isMine ? onClose() : onDelete();
  const preventSave = e => e.preventDefault();

  return createPortal(
    <div className="view-once-overlay" onClick={handleClose}>
      <div className="view-once-modal" onClick={e => e.stopPropagation()}>
        {showProgress && (
          <div className="view-once-progress">
            <div className="view-once-progress-bar" />
          </div>
        )}
        <div className="view-once-header">
          <span className="view-once-title">
            {isMine ? t("messages.viewOnce.mine") : t("messages.viewOnce.title")}
          </span>
          {!isMine && !hasVideo && <span className="view-once-sec">{t("messages.viewOnce.sec15")}</span>}
          <button className="view-once-close" onClick={handleClose}><X size={16} /></button>
        </div>
        <div className="view-once-content" onContextMenu={preventSave}>
          {imgs.map((a, i) => a.type === "video"
            ? <video key={i} src={assetUrl(a.url)} className="view-once-video"
                autoPlay playsInline onEnded={isMine ? onClose : onDelete} />
            : <img key={i} src={assetUrl(a.url)} className="view-once-img" alt="" onContextMenu={preventSave} draggable={false} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Message bubble ────────────────────────────────────────────
function Bubble({ msg, mine, isSelf, onEdit, onDeleteForAll, onHideForMe, isNew, onCtxMenu, onReact, token, onViewOnceDelete, onJumpToMsg }) {
  const t = useT();
  const { locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.body);
  const [hovered, setHovered] = useState(false);
  const [showViewOnce, setShowViewOnce] = useState(false);

  if (msg.deleted) return null;

  let imgs = [];
  try { imgs = JSON.parse(msg.images || "[]"); } catch {}
  const hasMedia = imgs.length > 0;
  const isViewOnce = msg.burn_after === -1 && hasMedia;

  const saveEdit = () => {
    const t = editText.trim();
    if (t && t !== msg.body) onEdit(msg.id, t);
    setEditing(false);
  };

  const isMine = mine || isSelf;
  const reactions = msg.reactions || [];

  const longPressTimer = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    onCtxMenu(e.clientX, e.clientY, msg, isMine, () => { setEditing(true); setEditText(msg.body); });
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      onCtxMenu(touch.clientX, touch.clientY, msg, isMine, () => { setEditing(true); setEditText(msg.body); });
    }, 500);
  };

  const handleTouchEnd = () => clearTimeout(longPressTimer.current);

  const isBurnProtected = msg.burn_after && !msg.burned_at;

  return (
    <div className={`dm-msg ${isMine ? "dm-msg-mine" : "dm-msg-theirs"} ${isNew ? "dm-msg-new" : ""}`}
      data-msg-id={msg.id}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {!isMine && <Av name={msg.sender_name} avatar={msg.sender_avatar} size={30} tier={msg.sender_tier} />}
      <div className="dm-msg-inner">
        {editing ? (
          <div className="dm-edit">
            <textarea className="dm-edit-ta" value={editText} rows={2}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(false); }}
              autoFocus />
            <div className="dm-edit-row">
              <button className="dm-btn-sec" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setEditing(false)}>{t("common.cancel")}</button>
              <button className="dm-btn-pri" style={{ fontSize: 12, padding: "4px 12px" }} onClick={saveEdit}>{t("common.save")}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="dm-bubble-wrap">
              <DMTip text={fmtFull(msg.created_at)} pos={isMine ? "left" : "right"}>
                <div className={`dm-bubble${isBurnProtected ? " burn-protected" : ""}`}>
                  {!isMine && (
                    <div className="dm-sender-name dm-sender-name-inside">
                      <Name
                        name={msg.sender_name}
                        verified={msg.sender_verified}
                        role={msg.sender_role}
                        nameColor={msg.sender_name_color}
                        nameGradient={msg.sender_name_gradient}
                        subTier={msg.sender_tier}
                      />
                    </div>
                  )}
                  {(msg.reply_body != null || msg.reply_images) && (
                    <ReplyQuote msg={msg} onClick={() => onJumpToMsg?.(msg.reply_to_id)} />
                  )}
                  {hasMedia && (isViewOnce ? (
                    <div className="dm-bubble-imgs view-once-blurred" onClick={() => setShowViewOnce(true)}>
                      {imgs.map((a, i) => (
                        <div key={i} className="view-once-thumb-wrap">
                          {a.type === "video"
                            ? <div className="view-once-video-ph">▶</div>
                            : <img src={assetUrl(a.url)} className="view-once-thumb-img" alt="" draggable={false} />
                          }
                        </div>
                      ))}
                      <div className="view-once-blur-overlay">
                        <span className="view-once-eye">👁</span>
                        <span className="view-once-label">{t("messages.clickToView")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="dm-bubble-imgs">
                      {imgs.map((a, i) => a.type === "video"
                        ? <VideoPlayer key={i} src={assetUrl(a.url)} className="dm-video-player" />
                        : <img key={i} src={assetUrl(a.url)} className="dm-bubble-img" alt="" onClick={() => window.open(assetUrl(a.url), "_blank")} />
                      )}
                    </div>
                  ))}
                  {msg.forwarded_from && (
                    <div className="fwd-badge">↪ {t("forward.from")} <span className="fwd-badge-name">{msg.forwarded_from}</span></div>
                  )}
                  {msg.voice_url && <VoiceMessage src={assetUrl(msg.voice_url)} mine={isMine} />}
                  {msg.body && <div className="dm-bubble-text"><PostBody token={token} className="md">{msg.body}</PostBody></div>}
                  <div className="dm-bubble-foot">
                    {msg.burn_after && !msg.burned_at && (
                      <BurnCountdown createdAt={msg.created_at} burnAfter={msg.burn_after} />
                    )}
                    {msg.edited_at && (
                      <DMTip text={`${t("messages.editedAt")} ${fmtFull(msg.edited_at, DATE_LOCALES[locale])}`} pos={isMine ? "left" : "right"}>
                        <span className="dm-edited">{t("messages.edited")}</span>
                      </DMTip>
                    )}
                    <span className="dm-time">{fmtTime(msg.created_at, DATE_LOCALES[locale])}</span>
                    {isMine && (
                      <DMTip text={msg.read_at ? `${t("messages.readAt")} ${fmtFull(msg.read_at, DATE_LOCALES[locale])}` : t("messages.sent")} pos="left">
                        <span className="dm-tick">{msg.read_at ? "✓✓" : "✓"}</span>
                      </DMTip>
                    )}
                  </div>
                </div>
              </DMTip>
              {hovered && onReact && (
                <div className={`dm-quick-react ${isMine ? "dm-quick-react-mine" : ""}`}>
                  {QUICK_EMOJIS.map(e => (
                    <button key={e} className="dm-qr-btn" onClick={() => onReact(msg.id, e)} title={e}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {reactions.length > 0 && (
              <div className={`dm-reactions ${isMine ? "dm-reactions-mine" : ""}`}>
                {reactions.map(r => (
                  <button
                    key={r.emoji}
                    className={`dm-reaction ${r.mine ? "dm-reaction-mine" : ""}`}
                    onClick={() => onReact?.(msg.id, r.emoji)}
                    title={`${r.count}`}
                  >
                    {r.emoji} {r.count > 1 && <span className="dm-reaction-count">{r.count}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {showViewOnce && (
        <ViewOnceModal
          msg={msg}
          isMine={isMine}
          onDelete={() => { setShowViewOnce(false); onViewOnceDelete?.(msg.id); }}
          onClose={() => setShowViewOnce(false)}
        />
      )}
    </div>
  );
}

// ─── Chat header menu ──────────────────────────────────────────
function HeadMenu({ conv, isMuted, iBlockedThem, onMute, onBlock, onDelete, onReport, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div className="dm-hmenu" ref={ref}>
      <button onClick={() => { onMute(); onClose(); }}>
        {isMuted ? <BellOff size={14} /> : <BellOff size={14} />}
        {isMuted ? "Включить уведомления" : "Отключить уведомления"}
      </button>
      {!conv.is_self && (
        <button onClick={() => { onBlock(); onClose(); }}>
          <Lock size={14} />
          {iBlockedThem ? "Разблокировать" : "Заблокировать"}
        </button>
      )}
      {!conv.is_self && (
        <button onClick={() => { onReport(); onClose(); }}>
          <ChevronRight size={14} />
          Пожаловаться
        </button>
      )}
      <button className="danger" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 size={14} />
        Удалить чат
      </button>
    </div>
  );
}

// ─── Chat view ─────────────────────────────────────────────────
function ChatView({ conv, token, myId, me, onConvUpdate, onConvDelete, onClose, setTypingConvIds, onBackMobile, chatEnterSend, voiceCall }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [theyBlockedMe, setTheyBlockedMe] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [newIds, setNewIds] = useState(new Set());
  const [fraudDismissed, setFraudDismissed] = useState(() => localStorage.getItem("xalle.dm.fd") === "1");
  const [ctxMenu, setCtxMenu] = useState(null);
  const [fmtMenu, setFmtMenu] = useState(null);
  const [typingVisible, setTypingVisible] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSelfShare, setShowSelfShare] = useState(false);
  const [selfShareTab, setSelfShareTab] = useState("link");
  const [burnAfter, setBurnAfter] = useState(null);
  const [showBurnPicker, setShowBurnPicker] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  // Clear burn setting when all attachments are removed
  useEffect(() => { if (attachments.length === 0) setBurnAfter(null); }, [attachments.length]);

  const burnBtnRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const typingTimer = useRef(null);
  const typingHideTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const searchTimer = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();
  const voiceRec = useVoiceRecorder();
  const [dmSearchOpen, setDmSearchOpen] = useState(false);
  const [dmSearchQ, setDmSearchQ] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [forwardMsg, setForwardMsg] = useState(null);

  const addFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(Array.from(files), token);
      setAttachments(prev => [...prev, ...urls].slice(0, 4));
    } catch (e) { toast(e.message || t("messages.uploadError"), { type: "error" }); }
    finally { setUploading(false); }
  };

  const sendVoiceDm = async () => {
    const blob = await voiceRec.stop();
    if (!blob) return;
    const fd = new FormData();
    fd.append("audio", blob, "voice.webm");
    try {
      const res = await fetch(`/api/messages/${conv.id}/voice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const msg = await res.json();
      setMsgs(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      onConvUpdate(conv.id, { last_msg: "🎤 Голосовое", last_at: msg.created_at });
      scrollBottom();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const doDmSearch = async (q) => {
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setDmSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api(`/messages/${conv.id}/search?q=${encodeURIComponent(q)}`, { token });
        setDmSearchResults(res);
      } catch {}
    }, 300);
  };

  const scrollBottom = (behavior = "smooth") =>
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));

  const load = useCallback(async () => {
    try {
      const list = await api(`/messages/${conv.id}`, { token });
      setMsgs(list);
      scrollBottom("instant");
      await api(`/messages/${conv.id}/read`, { method: "POST", token });
      onConvUpdate(conv.id, { unread: 0 });
    } catch {}
  }, [conv.id, token]);

  // Load block status on open
  useEffect(() => {
    if (!conv.is_self && conv.other_handle) {
      api(`/messages/block-check/${conv.other_handle}`, { token })
        .then(d => { setIBlockedThem(d.iBlockedThem); setTheyBlockedMe(d.theyBlockedMe); })
        .catch(() => {});
    }
  }, [conv.id, conv.other_handle, token]);

  useEffect(() => { load(); inputRef.current?.focus(); }, [load]);

  // WS: read receipt — other user read our messages
  useEffect(() => {
    const h = e => {
      if (e.detail.convId !== conv.id) return;
      const readAt = e.detail.readAt;
      setMsgs(prev => prev.map(m => m.sender_id === myId && !m.read_at ? { ...m, read_at: readAt } : m));
    };
    window.addEventListener("ws:dm:read", h);
    return () => window.removeEventListener("ws:dm:read", h);
  }, [conv.id, myId]);

  // WS: incoming message
  useEffect(() => {
    const h = e => {
      const msg = e.detail;
      if (msg.conv_id !== conv.id) return;
      setMsgs(prev => [...prev, { ...msg, deleted: false }]);
      setNewIds(prev => new Set([...prev, msg.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; }), 700);
      setTypingVisible(false);
      setTypingConvIds(prev => { const n = new Set(prev); n.delete(conv.id); return n; });
      scrollBottom();
      api(`/messages/${conv.id}/read`, { method: "POST", token }).catch(() => {});
      onConvUpdate(conv.id, { last_msg: (msg.body || (msg.voice_url ? "🎤 Голосовое" : "")).slice(0, 80), last_at: msg.created_at, unread: 0 });
    };
    window.addEventListener("dm:new", h);
    return () => window.removeEventListener("dm:new", h);
  }, [conv.id, token]);

  // Auto-remove time-based burned messages on client when countdown hits 0
  useEffect(() => {
    const timers = [];
    msgs.forEach(m => {
      if (!m.burn_after || m.burned_at || m.burn_after === -1) return;
      const created = new Date(m.created_at.replace(" ", "T") + (m.created_at.includes("T") ? "" : "Z")).getTime();
      const expiresIn = created + m.burn_after * 1000 - Date.now();
      if (expiresIn <= 0) return;
      const id = setTimeout(() => {
        setMsgs(prev => prev.filter(x => x.id !== m.id));
      }, expiresIn);
      timers.push(id);
    });
    return () => timers.forEach(clearTimeout);
  }, [msgs.map(m => m.id).join(",")]);

  // WS: reaction update from other participant
  useEffect(() => {
    const h = e => {
      const { msgId, reactions, convId } = e.detail;
      if (convId !== conv.id) return;
      setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    };
    window.addEventListener("ws:dm:reaction", h);
    return () => window.removeEventListener("ws:dm:reaction", h);
  }, [conv.id]);

  // WS: typing indicator
  useEffect(() => {
    const h = e => {
      if (e.detail.convId !== conv.id) return;
      setTypingVisible(true);
      setTypingConvIds(prev => new Set([...prev, conv.id]));
      clearTimeout(typingHideTimer.current);
      typingHideTimer.current = setTimeout(() => {
        setTypingVisible(false);
        setTypingConvIds(prev => { const n = new Set(prev); n.delete(conv.id); return n; });
      }, 4000);
    };
    window.addEventListener("ws:dm:typing", h);
    return () => { window.removeEventListener("ws:dm:typing", h); clearTimeout(typingHideTimer.current); };
  }, [conv.id]);

  // WS: block/unblock in real-time
  useEffect(() => {
    const hBlock = e => {
      if (e.detail.byUserId === conv.other_id || e.detail.targetHandle === conv.other_handle) {
        setTheyBlockedMe(true);
      }
    };
    const hUnblock = e => {
      if (e.detail.byUserId === conv.other_id || e.detail.targetHandle === conv.other_handle) {
        setTheyBlockedMe(false);
      }
    };
    window.addEventListener("ws:dm:blocked", hBlock);
    window.addEventListener("ws:dm:unblocked", hUnblock);
    return () => {
      window.removeEventListener("ws:dm:blocked", hBlock);
      window.removeEventListener("ws:dm:unblocked", hUnblock);
    };
  }, [conv.other_id, conv.other_handle]);

  // WS: real-time online status update in chat header
  useEffect(() => {
    if (conv.is_self || !conv.other_id) return;
    const h = e => {
      const { userId, online, hidden } = e.detail;
      if (userId !== conv.other_id) return;
      const now = new Date().toISOString();
      onConvUpdate(conv.id, {
        other_last_seen: online ? now : now,
        other_show_online: !hidden,
      });
    };
    window.addEventListener("ws:user:presence", h);
    return () => window.removeEventListener("ws:user:presence", h);
  }, [conv.id, conv.other_id, conv.is_self]);

  const sendTyping = useCallback(() => {
    if (conv.is_self) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    // Send typing via WS — dispatch to the WS layer via App.jsx event
    window.dispatchEvent(new CustomEvent("dm:send-typing", { detail: { convId: conv.id } }));
  }, [conv.id, conv.is_self]);

  const send = async () => {
    const body = text.trim();
    if (!body && attachments.length === 0) return;
    if (sending || uploading) return;
    setSending(true);
    const sentBody = body;
    const sentAttachments = [...attachments];
    const sentReplyTo = replyTo;
    setText("");
    setAttachments([]);
    setReplyTo(null);
    try {
      const msg = await api(`/messages/${conv.id}/send`, { method: "POST", token, body: { body: sentBody, images: sentAttachments, burnAfter, replyToId: sentReplyTo?.id || null } });
      const m = { ...msg, deleted: false };
      setMsgs(prev => [...prev, m]);
      setNewIds(prev => new Set([...prev, msg.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; }), 700);
      scrollBottom();
      onConvUpdate(conv.id, { last_msg: (sentBody || t("messages.attachment")).slice(0, 80), last_at: new Date().toISOString() });
    } catch (e) {
      setText(sentBody);
      setAttachments(sentAttachments);
      if (e.message?.includes("заблокированы")) setTheyBlockedMe(true);
      toast(e.message, { type: "error" });
    } finally { setSending(false); }
  };

  const handleEdit = async (id, body) => {
    try {
      const u = await api(`/messages/msg/${id}`, { method: "PATCH", token, body: { body } });
      setMsgs(prev => prev.map(m => m.id === id ? { ...m, body: u.body, edited_at: u.edited_at } : m));
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleDel = async (id) => {
    if (safeMode !== false) {
      if (!(await confirm({ title: t("messages.msgDeleteConfirm"), danger: true, okText: t("common.delete") }))) return;
    }
    try {
      await api(`/messages/msg/${id}`, { method: "DELETE", token });
      setMsgs(prev => prev.filter(m => m.id !== id));
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleHide = async (id) => {
    try {
      await api(`/messages/msg/${id}/hide`, { method: "POST", token });
      setMsgs(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const handleViewOnceDelete = async (id) => {
    try {
      await api(`/messages/msg/${id}`, { method: "DELETE", token });
      setMsgs(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const jumpToMsg = (msgId) => {
    if (!msgId) return;
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("dm-msg-highlight");
    setTimeout(() => el.classList.remove("dm-msg-highlight"), 1800);
  };

  const handleReact = async (msgId, emoji) => {
    try {
      const { reactions } = await api(`/messages/msg/${msgId}/react`, { method: "POST", token, body: { emoji } });
      setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    } catch {}
  };

  const handleBlock = async () => {
    if (iBlockedThem) {
      await api(`/messages/block/${conv.other_handle}`, { method: "DELETE", token });
      setIBlockedThem(false);
      onConvUpdate(conv.id, { iBlocked: false });
      toast(t("messages.userUnblocked"), { type: "success" });
    } else {
      if (!(await confirm({ title: t("messages.blockConfirm", { handle: conv.other_handle }), danger: true, okText: t("messages.block") }))) return;
      await api(`/messages/block/${conv.other_handle}`, { method: "POST", token });
      setIBlockedThem(true);
      onConvUpdate(conv.id, { iBlocked: true });
      toast(t("messages.userBlocked"), { type: "info" });
    }
  };

  const handleMute = async () => {
    if (conv.muted) {
      await api(`/messages/${conv.id}/mute`, { method: "DELETE", token });
      onConvUpdate(conv.id, { muted: false });
      toast(t("messages.notifEnabled"), { type: "success" });
    } else {
      await api(`/messages/${conv.id}/mute`, { method: "POST", token, body: {} });
      onConvUpdate(conv.id, { muted: true });
      toast(t("messages.notifDisabled"), { type: "info" });
    }
  };

  const handleDeleteChat = async (forAll = false) => {
    const title = forAll ? t("messages.deleted.all") : t("messages.deleted.mine");
    const body = forAll ? t("messages.deleted.allMsg") : t("messages.deleted.mineMsg");
    if (!(await confirm({ title, body, danger: true, okText: t("common.delete") }))) return;
    onConvDelete(conv.id, forAll);
  };

  const handleReport = async () => {
    try {
      await api("/report", { method: "POST", token, body: {
        targetType: "user",
        targetId: conv.other_id,
        reason: `Жалоба на @${conv.other_handle} из личных сообщений`,
      }});
      toast(t("messages.reportSent"), { type: "success" });
    } catch (e) { toast(e.message || t("messages.reportError"), { type: "error" }); }
  };

  const handleCtxMenu = (x, y, msg, isMine, startEdit) => {
    const items = [];
    items.push({
      icon: null,
      label: (
        <span style={{ display: "flex", gap: 6 }}>
          {["👍","❤️","😂","😮","😢","🔥"].map(e => (
            <button key={e} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, padding:"2px 3px", borderRadius:6 }}
              onClick={() => { handleReact(msg.id, e); setCtxMenu(null); }}>
              {e}
            </button>
          ))}
        </span>
      ),
      action: () => {},
    });
    items.push(null);
    items.push({ icon: "↩", label: t("messages.ctx.reply"), action: () => { setReplyTo(msg); inputRef.current?.focus(); } });
    items.push({ icon: "↪", label: t("forward.title"), action: () => setForwardMsg(msg) });
    if (isMine) items.push({ icon: <Pencil size={13} />, label: t("messages.ctx.edit"), action: startEdit });
    items.push({ icon: <EyeOff size={13} />, label: t("messages.ctx.hideForMe"), action: () => handleHide(msg.id) });
    if (isMine) items.push({ icon: <Trash2 size={13} />, label: t("messages.ctx.deleteForAll"), danger: true, action: () => handleDel(msg.id) });
    items.push(null);
    items.push({ icon: <Copy size={13} />, label: t("messages.ctx.copyText"), action: () => navigator.clipboard?.writeText(msg.body).catch(() => {}) });
    setCtxMenu({ x, y, items });
  };

  const onlineStatus = conv.is_self ? null : fmtOnline(conv.other_last_seen, conv.other_show_online, localeStr, t);
  const isOnline = onlineStatus === t("messages.online");
  const canSend = !iBlockedThem && !theyBlockedMe;

  const grouped = msgs.reduce((acc, m) => {
    const dk = fmtDate(m.created_at, localeStr, t);
    if (!acc.length || acc[acc.length - 1].date !== dk) acc.push({ date: dk, msgs: [] });
    acc[acc.length - 1].msgs.push(m);
    return acc;
  }, []);

  return (
    <div className="dm-chat-area">
      {/* Header */}
      <div className="dm-chat-head">
        <button className="dm-back-mobile" onClick={onBackMobile} aria-label={t("common.back")}>
          <ArrowLeft size={18} />
        </button>
        {conv.is_self
          ? <div className="dm-self-av" style={{ width: 38, height: 38 }}><Star size={18} fill="currentColor" /></div>
          : <Av name={conv.other_name} avatar={conv.other_avatar} size={38} tier={conv.other_tier} isOnline={isOnline} />
        }
        <div className="dm-chat-info">
          {conv.is_self ? (
            <span className="dm-chat-name">{t("messages.favorites")}</span>
          ) : (
            <>
              <span className="dm-chat-name">
                <Name name={conv.other_name} nameColor={conv.other_name_color} verified={conv.other_verified} role={conv.other_role} subTier={conv.other_tier} />
              </span>
              {typingVisible
                ? <span className="dm-chat-sub dm-sub-typing">{t("messages.typing")}<span className="dm-typing-dots"><span/><span/><span/></span></span>
                : onlineStatus && <span className={`dm-chat-sub ${isOnline ? "dm-sub-online" : ""}`}>{onlineStatus}</span>
              }
            </>
          )}
        </div>
        <div className="dm-chat-actions">
          {conv.is_self && me?.handle && (
            <button className={`dm-self-share-btn ${showSelfShare ? "active" : ""}`} onClick={() => setShowSelfShare(v => !v)}>
              <Share2 size={14} /> {t("messages.share.btn")}
            </button>
          )}
          {!conv.is_self && voiceCall && !voiceCall.active && (
            <DMTip text={t("vcall.call.btn")} pos="bottom">
              <button className="dm-dots" onClick={() => voiceCall.startCall(conv.other_id)}><Phone size={16} /></button>
            </DMTip>
          )}
          <DMTip text={t("search.messages")} pos="bottom">
            <button className={`dm-dots ${dmSearchOpen ? "dm-attach-btn-on" : ""}`} onClick={() => { setDmSearchOpen(v => !v); setDmSearchQ(""); setDmSearchResults([]); }}><Search size={16} /></button>
          </DMTip>
          {conv.muted && <DMTip text={t("messages.mutedTip")} pos="bottom"><span className="dm-head-muted"><BellOff size={15} /></span></DMTip>}
          <DMTip text={t("messages.closeChat")} pos="bottom">
            <button className="dm-dots" onClick={onClose} style={{ fontSize: 18 }}>←</button>
          </DMTip>
          <DMTip text={t("messages.menuTip")} pos="bottom">
            <button className="dm-dots" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const items = [
                { icon: conv.muted ? <Volume2 size={14}/> : <VolumeX size={14}/>, label: conv.muted ? t("messages.enableNotif") : t("messages.disableNotif"), action: handleMute },
                ...(!conv.is_self ? [
                  { icon: <Lock size={14}/>, label: iBlockedThem ? t("messages.unblock") : t("messages.block"), action: handleBlock },
                  { icon: <Flag size={14}/>, label: t("common.report"), action: handleReport },
                ] : []),
                null,
                { icon: <Trash2 size={14}/>, label: t("messages.deleteMine"), danger: true, action: () => handleDeleteChat(false) },
                ...(!conv.is_self ? [{ icon: <Trash2 size={14}/>, label: t("messages.deleteAll"), danger: true, action: () => handleDeleteChat(true) }] : []),
              ];
              setCtxMenu({ x: r.left, y: r.bottom + 6, items });
            }}>⋯</button>
          </DMTip>
        </div>
      </div>

      {/* Message search */}
      {dmSearchOpen && (
        <div className="grp-search-bar">
          <Search size={14} className="grp-search-bar-ico" />
          <input className="grp-search-bar-input" autoFocus placeholder={t("search.placeholder")}
            value={dmSearchQ} onChange={e => { setDmSearchQ(e.target.value); doDmSearch(e.target.value); }} />
          {dmSearchQ && <button className="grp-search-bar-x" onClick={() => { setDmSearchQ(""); setDmSearchResults([]); }}><X size={13} /></button>}
        </div>
      )}
      {dmSearchOpen && dmSearchQ && (
        <div className="grp-search-results">
          {dmSearchResults.length === 0
            ? <div className="grp-search-empty">{t("search.noResults")}</div>
            : dmSearchResults.map(m => (
              <button key={m.id} className="grp-search-result-row" onClick={() => {
                setDmSearchOpen(false); setDmSearchQ(""); setDmSearchResults([]);
                setTimeout(() => {
                  const el = document.querySelector(`[data-msg-id="${m.id}"]`);
                  if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("dm-msg-highlight"); setTimeout(() => el.classList.remove("dm-msg-highlight"), 1800); }
                }, 100);
              }}>
                <span className="grp-search-result-name">{m.sender_name || t("messages.favorites")}</span>
                <span className="grp-search-result-text">{m.body?.slice(0, 80)}</span>
                <span className="grp-search-result-time">{fmtTime(m.created_at, localeStr)}</span>
              </button>
            ))
          }
        </div>
      )}

      {/* Self-share panel */}
      {conv.is_self && showSelfShare && me?.handle && (() => {
        const profileLink = `${window.location.origin}?profile=${me.handle}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileLink)}&size=160x160&margin=10`;
        return (
          <div className="dm-self-share-panel">
            <div className="share-modal-tabs" style={{ margin: "0 0 12px" }}>
              <button className={`share-modal-tab ${selfShareTab === "link" ? "active" : ""}`} onClick={() => setSelfShareTab("link")}>{t("messages.share.byLink")}</button>
              <button className={`share-modal-tab ${selfShareTab === "qr" ? "active" : ""}`} onClick={() => setSelfShareTab("qr")}>{t("messages.share.byQr")}</button>
            </div>
            {selfShareTab === "link" && (
              <div className="share-modal-link-row">
                <span className="share-modal-link-text">{profileLink}</span>
                <button className="btn accent" style={{ fontSize: 12, padding: "5px 10px", flexShrink: 0 }} onClick={() => {
                  navigator.clipboard?.writeText(profileLink);
                  toast(t("messages.share.copied"), { type: "success" });
                }}><Copy size={13} /> {t("messages.share.copy")}</button>
              </div>
            )}
            {selfShareTab === "qr" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <img src={qrUrl} alt="QR" width={140} height={140} style={{ borderRadius: 8 }} />
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{t("messages.share.profileHint")}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Banners */}
      {!fraudDismissed && (
        <div className="dm-fraud">
          <Lock size={14} style={{ flexShrink: 0 }} />
          <span dangerouslySetInnerHTML={{ __html: t("messages.fraudWarning") }} />
          <button onClick={() => { localStorage.setItem("xalle.dm.fd","1"); setFraudDismissed(true); }}><X size={14} /></button>
        </div>
      )}
      {iBlockedThem && (
        <div className="dm-blocked">{t("messages.blockedByYou")} <button className="dm-unblock-inline" onClick={handleBlock}>{t("messages.unblock")}</button></div>
      )}
      {theyBlockedMe && (
        <div className="dm-blocked">{t("messages.blockedByThem")}</div>
      )}

      {/* Messages */}
      <div className="dm-msgs-area">
        {grouped.map(g => (
          <div key={g.date}>
            <div className="dm-datesep"><span>{g.date}</span></div>
            {g.msgs.map(m => (
              <Bubble key={m.id} msg={m} mine={m.sender_id === myId} isSelf={conv.is_self}
                isNew={newIds.has(m.id)} token={token}
                onEdit={handleEdit} onDeleteForAll={handleDel} onHideForMe={handleHide}
                onCtxMenu={handleCtxMenu} onReact={handleReact}
                onViewOnceDelete={handleViewOnceDelete} onJumpToMsg={jumpToMsg} />
            ))}
          </div>
        ))}
        {typingVisible && (
          <div className="dm-msg dm-msg-theirs">
            <div className="dm-msg-inner">
              <div className="dm-bubble dm-typing-bubble">
                <span className="dm-typing-dots"><span/><span/><span/></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="dm-attach-strip">
          {attachments.map((a, i) => (
            <div key={i} className="dm-attach-thumb">
              {isVideoUrl(a.url) ? <video src={assetUrl(a.url)} className="dm-attach-img" /> : <img src={assetUrl(a.url)} className="dm-attach-img" alt="" />}
              <button className="dm-attach-rm" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="dm-reply-bar">
          <div className="dm-reply-bar-line" />
          <div className="dm-reply-bar-body">
            <span className="dm-reply-bar-name">{replyTo.sender_name || replyTo.sender_handle || t("messages.you").replace(": ", "")}</span>
            <span className="dm-reply-bar-text">{(replyTo.body || "📎").slice(0, 60)}</span>
          </div>
          <button className="dm-reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className="dm-input-wrap">
        <div className="dm-input-area">
          <DMTip text={t("messages.attachTooltip")} pos="top">
            <button className="dm-attach-btn" onClick={() => fileRef.current?.click()} disabled={!canSend || uploading || attachments.length >= 4}>
              {uploading ? <span className="dm-attach-spin" /> : <ImagePlus size={18} />}
            </button>
          </DMTip>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={e => addFiles(e.target.files)} />
          <textarea ref={inputRef} className="dm-textarea"
            placeholder={conv.is_self ? t("messages.selfPlaceholder") : canSend ? t("messages.typePlaceholder") : t("messages.cantSend")}
            value={text} rows={1} maxLength={2000}
            onChange={e => { setText(e.target.value); sendTyping(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && chatEnterSend !== false) { e.preventDefault(); send(); } }}
            onContextMenu={e => { if (!text.trim() && !e.target.selectionStart && !e.target.selectionEnd) return; e.preventDefault(); setFmtMenu({ x: e.clientX, y: e.clientY }); }}
            disabled={!canSend} />
          {attachments.length > 0 && (
            <DMTip text={burnAfter ? `${t("messages.burnTooltip")}: ${t(BURN_OPTION_KEYS.find(o => o.value === burnAfter)?.labelKey || "messages.burn.off")}` : t("messages.burnTooltip")} pos="top">
              <div style={{ position: "relative" }}>
                <button ref={burnBtnRef} className={`dm-attach-btn ${burnAfter ? "dm-attach-btn-on" : ""}`}
                  onClick={() => setShowBurnPicker(v => !v)} disabled={!canSend}
                  style={burnAfter ? { color: "var(--accent)" } : {}}>
                  <Timer size={18} />
                </button>
                {showBurnPicker && <BurnPicker value={burnAfter} onChange={setBurnAfter} onClose={() => setShowBurnPicker(false)} />}
              </div>
            </DMTip>
          )}
          <DMTip text={t("messages.emojiTooltip")} pos="top">
            <button ref={emojiBtnRef} className={`dm-attach-btn ${showEmoji ? "dm-attach-btn-on" : ""}`} onClick={() => setShowEmoji(v => !v)} disabled={!canSend}>
              <Smile size={18} />
            </button>
          </DMTip>
          {!text.trim() && attachments.length === 0 && canSend && (
            <DMTip text={voiceRec.recording ? t("voice.send") : t("voice.record")} pos="top">
              <button
                className={`dm-attach-btn${voiceRec.recording ? " dm-attach-btn-recording" : ""}`}
                onClick={voiceRec.recording ? sendVoiceDm : voiceRec.start}
              >
                {voiceRec.recording
                  ? <><Square size={14} /><span className="dm-rec-timer">{Math.floor(voiceRec.duration / 60)}:{String(voiceRec.duration % 60).padStart(2, "0")}</span></>
                  : <Mic size={18} />}
              </button>
            </DMTip>
          )}
          <DMTip text={t("messages.sendTooltip")} pos="top">
            <button className={`dm-send ${(text.trim() || attachments.length > 0) && canSend ? "dm-send-on" : ""}`} onClick={send}
              disabled={(!text.trim() && attachments.length === 0) || sending || uploading || !canSend}>
              <Send size={18} />
            </button>
          </DMTip>
        </div>
        <div className="dm-input-tip">{t("messages.inputHint")}</div>
      </div>
      {showEmoji && <EmojiPicker anchorRef={emojiBtnRef} onPick={emoji => { setText(prev => prev + emoji); inputRef.current?.focus(); }} onClose={() => setShowEmoji(false)} />}

      {/* Context menus */}
      {ctxMenu && <CtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
      {fmtMenu && <FormatMenu x={fmtMenu.x} y={fmtMenu.y} textareaRef={inputRef} onChange={setText} onClose={() => setFmtMenu(null)} />}
      {forwardMsg && <ForwardModal token={token} msg={forwardMsg} onClose={() => setForwardMsg(null)} />}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyChat({ onNew }) {
  const t = useT();
  return (
    <div className="dm-empty-chat">
      <div className="dm-empty-art">
        <div className="dm-eb dm-eb1">👋</div>
        <div className="dm-eb dm-eb2">✨</div>
        <div className="dm-eb dm-eb3">💬</div>
      </div>
      <h3 className="dm-empty-title">{t("messages.empty.title")}</h3>
      <p className="dm-empty-sub">{t("messages.empty.sub")}</p>
      <button className="dm-btn-pri" style={{ marginTop: 20, padding: "11px 28px", fontSize: 14 }} onClick={onNew}>
        {t("messages.writeToSomeone")}
      </button>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────
export default function Messages({ token, myId, onBack, notifUnread, me, initialHandle, safeMode, chatEnterSend, voiceCall }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [tab, setTab] = useState("dm"); // "dm" | "groups"
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [typingConvIds, setTypingConvIds] = useState(new Set());
  const [convCtxMenu, setConvCtxMenu] = useState(null);
  const [pendingGroupToken, setPendingGroupToken] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [sideWidth, setSideWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("xalle.dm.sideWidth") || "300");
    return (saved >= 180 && saved <= 480) ? saved : 300;
  });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, w: 300 });
  const wsRef = useRef(null);

  // Handle group invite link from URL
  useEffect(() => {
    const h = e => {
      const { token: groupToken } = e.detail;
      setTab("groups");
      setPendingGroupToken(groupToken);
    };
    window.addEventListener("messages:open-group-invite", h);
    return () => window.removeEventListener("messages:open-group-invite", h);
  }, []);

  const loadConvs = useCallback(async () => {
    try { const l = await api("/messages", { token }); setConvs(l); return l; } catch { return []; }
  }, [token]);

  useEffect(() => {
    if (initialHandle) {
      api(`/messages/open/${initialHandle.replace(/^@/, "")}`, { method: "POST", token })
        .then(({ convId }) => loadConvs().then(list => { const f = list.find(c => c.id === convId); if (f) setActiveConv(f); }))
        .catch(() => {});
    } else {
      // Just load conversations — don't auto-open Favorites
      loadConvs();
    }
  }, [token]);

  // WS events relay
  useEffect(() => {
    const h = e => {
      const { msg } = e.detail;
      window.dispatchEvent(new CustomEvent("dm:new", { detail: msg }));
      loadConvs();
    };
    const hTyping = e => {
      window.dispatchEvent(new CustomEvent("ws:dm:typing", { detail: e.detail }));
      setTypingConvIds(prev => new Set([...prev, e.detail.convId]));
      setTimeout(() => setTypingConvIds(prev => { const n = new Set(prev); n.delete(e.detail.convId); return n; }), 4000);
    };
    const hBlocked = e => window.dispatchEvent(new CustomEvent("ws:dm:blocked", { detail: e.detail }));
    const hUnblocked = e => window.dispatchEvent(new CustomEvent("ws:dm:unblocked", { detail: e.detail }));
    const hPresence = e => {
      window.dispatchEvent(new CustomEvent("ws:user:presence", { detail: e.detail }));
      // Also update the conversation list online dots
      const { userId, online, hidden } = e.detail;
      if (!hidden) {
        const now = new Date().toISOString();
        setConvs(prev => prev.map(c =>
          c.other_id === userId
            ? { ...c, other_last_seen: now, other_show_online: true }
            : c
        ));
      }
    };

    const hConvDeleted = e => {
      const { convId } = e.detail;
      setConvs(prev => prev.filter(c => c.id !== convId));
      setActiveConv(prev => prev?.id === convId ? null : prev);
    };

    const hReaction = e => {
      window.dispatchEvent(new CustomEvent("ws:dm:reaction", { detail: e.detail }));
    };

    window.addEventListener("ws:dm:new", h);
    window.addEventListener("ws:dm:typing:raw", hTyping);
    window.addEventListener("ws:dm:blocked:raw", hBlocked);
    window.addEventListener("ws:dm:unblocked:raw", hUnblocked);
    window.addEventListener("ws:presence:raw", hPresence);
    window.addEventListener("ws:dm:conv_deleted", hConvDeleted);
    window.addEventListener("ws:dm:reaction:raw", hReaction);
    return () => {
      window.removeEventListener("ws:dm:new", h);
      window.removeEventListener("ws:dm:typing:raw", hTyping);
      window.removeEventListener("ws:dm:blocked:raw", hBlocked);
      window.removeEventListener("ws:dm:unblocked:raw", hUnblocked);
      window.removeEventListener("ws:presence:raw", hPresence);
      window.removeEventListener("ws:dm:conv_deleted", hConvDeleted);
      window.removeEventListener("ws:dm:reaction:raw", hReaction);
    };
  }, [loadConvs]);

  // Relay typing events to WS (via App.jsx WS connection)
  useEffect(() => {
    const h = e => window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "dm:typing", convId: e.detail.convId } }));
    window.addEventListener("dm:send-typing", h);
    return () => window.removeEventListener("dm:send-typing", h);
  }, []);

  const openConv = id => {
    setShowNew(false);
    loadConvs().then(list => { const f = list.find(c => c.id === id); if (f) setActiveConv(f); });
  };

  const handleConvUpdate = (id, patch) => {
    setConvs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c)
      .sort((a, b) => a.is_self ? -1 : b.is_self ? 1 : new Date(b.last_at) - new Date(a.last_at)));
    setActiveConv(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };

  const undoTimers = useRef({});
  const handleConvDelete = (id, forAll = false) => {
    // Mark as leaving for animation
    setConvs(prev => prev.map(c => c.id === id ? { ...c, _leaving: true } : c));
    if (activeConv?.id === id) setActiveConv(null);

    // 5-second undo window
    toast(
      <span>
        {t("messages.deletedChatToast")}{" "}
        <button
          style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 700, padding: 0, fontSize: "inherit", fontFamily: "inherit" }}
          onClick={() => {
            clearTimeout(undoTimers.current[id]);
            delete undoTimers.current[id];
            setConvs(prev => prev.map(c => c.id === id ? { ...c, _leaving: false } : c));
          }}
        >{t("messages.undoBtn")}</button>
      </span>,
      { type: "info", duration: 5000 }
    );

    undoTimers.current[id] = setTimeout(async () => {
      delete undoTimers.current[id];
      try {
        const method = "DELETE";
        const url = forAll ? `/messages/${id}/all` : `/messages/${id}`;
        await api(url, { method, token });
      } catch {}
      setConvs(prev => prev.filter(c => c.id !== id));
    }, 5000);
  };

  // Sidebar resize
  const sideWidthRef = useRef(sideWidth);
  sideWidthRef.current = sideWidth;
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    resizing.current = true;
    resizeStart.current = { x: e.clientX, w: sideWidthRef.current };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizeStart.current.x;
      const newW = Math.max(180, Math.min(480, resizeStart.current.w + delta));
      setSideWidth(newW);
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setSideWidth(w => { localStorage.setItem("xalle.dm.sideWidth", String(w)); return w; });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleConvCtxMenu = (x, y, conv) => {
    const isMuted = !!conv.muted;
    const items = [];
    if (!conv.is_self) {
      items.push({
        icon: isMuted ? <Volume2 size={13} /> : <VolumeX size={13} />,
        label: isMuted ? t("messages.enableNotif") : t("messages.disableNotif"),
        action: async () => {
          if (isMuted) {
            await api(`/messages/${conv.id}/mute`, { method: "DELETE", token });
            handleConvUpdate(conv.id, { muted: 0 });
            toast(t("messages.notifEnabled"));
          } else {
            await api(`/messages/${conv.id}/mute`, { method: "POST", token, body: { minutes: null } });
            handleConvUpdate(conv.id, { muted: 1 });
            toast(t("messages.notifDisabled"));
          }
        },
      });
      items.push({
        icon: <ShieldBan size={13} />,
        label: t("messages.block"),
        action: async () => {
          if (!conv.other_handle) return;
          await api(`/messages/block/${conv.other_handle}`, { method: "POST", token });
          toast(t("messages.userBlocked"));
        },
      });
      items.push({
        icon: <Flag size={13} />,
        label: t("common.report"),
        action: async () => {
          if (!conv.other_id) return;
          try {
            await api("/report", { method: "POST", token, body: { targetType: "user", targetId: conv.other_id, reason: `Report @${conv.other_handle}` } });
            toast(t("messages.reportSent"), { type: "success" });
          } catch (e) { toast(e.message || t("common.error"), { type: "error" }); }
        },
      });
      items.push(null);
    }
    items.push({
      icon: <Trash2 size={13} />,
      label: t("messages.deleteMine"),
      danger: true,
      action: () => handleConvDelete(conv.id, false),
    });
    if (!conv.is_self) {
      items.push({
        icon: <Trash2 size={13} />,
        label: t("messages.deleteAll"),
        danger: true,
        action: () => handleConvDelete(conv.id, true),
      });
    }
    setConvCtxMenu({ x, y, items });
  };

  const dmUnread = convs.reduce((s, c) => s + (c.unread || 0), 0);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;

  return (
    <div className={`dm-root${activeConv ? " dm-has-chat" : ""}`}>
      {/* ── Top navbar (mobile only) ── */}
      <nav className="dm-nav">
        <button className="dm-nav-back" onClick={onBack} title={t("messages.backToFeed")}>
          <ArrowLeft size={18} />
          <span>{t("messages.navBack")}</span>
        </button>
        <div className="dm-nav-brand">Xalle <span className="dm-nav-dot">✦</span></div>
        <div className="dm-nav-right">
          {me && (
            <DMTip text={`@${me.handle}`} pos="bottom">
              <div className="dm-nav-av">
                <Av name={me.name} avatar={me.avatar_url} size={30} tier={me.subscription_tier} />
              </div>
            </DMTip>
          )}
        </div>
      </nav>

      {/* ── Tab content wrapper (column: tabs + body) ── */}
      <div className="dm-tab-wrapper">
        {/* Tab switcher */}
        <div className="dm-tabs">
          <button className={`dm-tab${tab === "dm" ? " dm-tab-active" : ""}`} onClick={() => setTab("dm")}>
            <User size={14} style={{ marginRight: 4 }} />
            {t("messages.tabDm")}
            {dmUnread > 0 && <span className="dm-tab-badge">{dmUnread > 99 ? "99+" : dmUnread}</span>}
          </button>
          <button className={`dm-tab${tab === "groups" ? " dm-tab-active" : ""}`} onClick={() => setTab("groups")}>
            <Users size={14} style={{ marginRight: 4 }} />
            {t("messages.tabGroups")}
          </button>
        </div>  

        {/* Main panel */}
        {tab === "groups" ? (
          <GroupView token={token} myId={myId} width={sideWidth} onBack={onBack}
            inviteToken={pendingGroupToken} onClearInviteToken={() => setPendingGroupToken(null)} safeMode={safeMode} chatEnterSend={chatEnterSend} />
        ) : (
          <div className="dm-body">
            {/* Sidebar: always full on desktop, hidden on mobile when chat is open */}
            <ConvSidebar
              convs={convs} activeId={activeConv?.id}
              onSelect={c => setActiveConv(c)} onNew={() => setShowNew(true)}
              search={search} setSearch={setSearch}
              isCollapsed={false}
              hiddenOnMobile={!!activeConv}
              width={sideWidth} onResizeStart={onResizeStart}
              typingConvIds={typingConvIds}
              onBack={onBack}
              onConvCtxMenu={handleConvCtxMenu} />

            <div className={`dm-main${!activeConv ? " dm-main-hidden-mobile" : ""}`}>
              {activeConv
                ? <ChatView key={activeConv.id} conv={activeConv} token={token} myId={myId}
                    onConvUpdate={handleConvUpdate} onConvDelete={handleConvDelete}
                    onClose={() => setActiveConv(null)}
                    onBackMobile={() => setActiveConv(null)}
                    setTypingConvIds={setTypingConvIds} chatEnterSend={chatEnterSend} voiceCall={voiceCall} />
                : <EmptyChat onNew={() => setShowNew(true)} />
              }
            </div>
          </div>
        )}
      </div>

      {showNew && tab === "dm" && <NewConvModal token={token} onOpen={openConv} onClose={() => setShowNew(false)} />}
      {convCtxMenu && <CtxMenu x={convCtxMenu.x} y={convCtxMenu.y} items={convCtxMenu.items} onClose={() => setConvCtxMenu(null)} />}
    </div>
  );
}
