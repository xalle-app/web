import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api, uploadImages, isVideoUrl } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { Name, Av } from "../shared/icons.jsx";
import VideoPlayer from "../shared/VideoPlayer.jsx";
import Md from "../shared/Markdown.jsx";
import PostBody from "../shared/PostBody.jsx";
import EmojiPicker from "../composer/EmojiPicker.jsx";
import VoiceMessage from "../shared/VoiceMessage.jsx";
import ForwardModal from "../shared/ForwardModal.jsx";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder.js";
import { Send, X, ImagePlus, ArrowLeft, Plus, Users, Settings, UserMinus, Check, ChevronRight, Trash2, Copy, Share2, Search, Smile, PenSquare, Mic, Square } from "lucide-react";
import { useT } from "../../contexts/I18nContext.jsx";
import ReplyQuote from "../shared/ReplyQuote.jsx";

// ─── Helpers ──────────────────────────────────────────────────
function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(dt, t) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("common.today");
  if (d.toDateString() === yest.toDateString()) return t("common.yesterday");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}
function timeAgo(dt, t) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return t("common.now");
  if (diff < 3600000) return t("grp.minAgo", { n: Math.floor(diff / 60000) });
  const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return fmtTime(dt);
  if (d.toDateString() === yest.toDateString()) return t("common.yesterday");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const GroupAvatar = ({ group, size = 36 }) => <Av name={group.name} avatar={group.avatar_url} size={size} isGroup />;
const UserAv = ({ name, avatar, size = 30, tier }) => <Av name={name} avatar={avatar} size={size} tier={tier} />;

const GRP_QUICK_EMOJIS = ["👍","❤️","😂","😮","😢","🔥"];

// ─── DMTip ─────────────────────────────────────────────────────
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

// ─── Context menu ─────────────────────────────────────────────
function GrpCtxMenu({ x, y, items, onClose }) {
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
          {items.map((item, i) => item === null
            ? <div key={i} className="dm-ctx-sep" />
            : <button key={i}
                className={`dm-ctx-item ${item.danger ? "dm-ctx-danger" : ""} ${!item.icon && typeof item.label !== "string" ? "dm-ctx-react-row" : ""}`}
                onClick={() => { if (typeof item.label === "string") { item.action?.(); onClose(); } }}
                disabled={item.disabled}>
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </button>
          )}
        </div>
      </div>,
      document.body
    );
  }

  const menuWidth = 200; const menuHeight = items.length * 40;
  const cx = Math.min(x, window.innerWidth - menuWidth - 8);
  const cy = Math.min(y, window.innerHeight - menuHeight - 8);
  return createPortal(
    <div className="dm-ctx" style={{ left: cx, top: cy }} ref={ref}>
      {items.map((item, i) => item === null
        ? <div key={i} className="dm-ctx-sep" />
        : <button key={i}
            className={`dm-ctx-item ${item.danger ? "dm-ctx-danger" : ""} ${!item.icon && typeof item.label !== "string" ? "dm-ctx-react-row" : ""}`}
            onClick={() => { if (typeof item.label === "string") { item.action?.(); onClose(); } }}
            disabled={item.disabled}>
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </button>
      )}
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
    const start = el.selectionStart, end = el.selectionEnd, val = el.value;
    const sel = val.slice(start, end);
    onChange(val.slice(0, start) + before + sel + after + val.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + before.length, end + before.length); });
    onClose();
  };
  return (
    <GrpCtxMenu x={x} y={y} onClose={onClose} items={[
      { icon: "𝐁", label: t("grp.fmt.bold"),   action: () => wrap("**", "**") },
      { icon: "𝑖", label: t("grp.fmt.italic"), action: () => wrap("*", "*") },
      { icon: "`", label: t("grp.fmt.code"),   action: () => wrap("`", "`") },
      { icon: "~~", label: t("grp.fmt.strike"), action: () => wrap("~~", "~~") },
      null,
      { icon: ">", label: t("grp.fmt.quote"),  action: () => wrap("> ", "") },
    ]} />
  );
}

// ─── Report Modal ─────────────────────────────────────────────
const GROUP_REPORT_REASONS = [
  "grp.report.reason.spam",
  "grp.report.reason.hate",
  "grp.report.reason.violence",
  "grp.report.reason.adult",
  "grp.report.reason.scam",
  "grp.report.reason.other",
];

function ReportModal({ targetType, targetId, token, onClose, onSent }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await api("/report", { method: "POST", token, body: { targetType, targetId, reason: t(reason) } });
      onSent?.();
      onClose();
    } catch (e) {
      setSending(false);
    }
  };

  return createPortal(
    <div className="grp-report-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-report-modal" ref={ref}>
        <div className="grp-report-header">
          <span>⚑ {targetType === "group" ? t("grp.report.group") : t("grp.report.message")}</span>
          <button className="grp-report-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grp-report-subtitle">{t("grp.report.chooseReason")}</div>
        <div className="grp-report-reasons">
          {GROUP_REPORT_REASONS.map(key => (
            <button
              key={key}
              className={`grp-report-reason-btn ${reason === key ? "selected" : ""}`}
              onClick={() => setReason(key)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <button
          className="btn accent"
          style={{ width: "100%", marginTop: 12, opacity: reason ? 1 : 0.4 }}
          disabled={!reason || sending}
          onClick={submit}
        >
          {sending ? "…" : t("grp.report.send")}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Group message bubble ──────────────────────────────────────
function GrpBubble({ msg, myId, prevMsg, isNew, amAdmin, onDelete, onReact, token, onReply, onPin, onReport, onJumpToMsg, onEdit, onForward }) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const pickerTimer = useRef(null);
  const longPressTimer = useRef(null);
  const isMine = !msg.as_group && msg.sender_id === myId;
  const imgs = Array.isArray(msg.images) ? msg.images : [];

  const saveEdit = async () => {
    const body = editText.trim();
    if (!body || body === msg.body) { setEditing(false); return; }
    await onEdit?.(msg.id, body);
    setEditing(false);
  };

  // Show name/avatar only when sender changes or after system messages
  const showHeader = !isMine && (!prevMsg || prevMsg.type === "system" || prevMsg.sender_id !== msg.sender_id || Boolean(prevMsg.as_group) !== Boolean(msg.as_group));

  if (msg.type === "system") {
    return (
      <div className="grp-event-pill">
        <span className="grp-event-text">{msg.body}</span>
      </div>
    );
  }

  const openCtxMenu = (cx, cy) => {
    const items = [];
    items.push({
      icon: null,
      label: (
        <span style={{ display: "flex", gap: 6 }}>
          {GRP_QUICK_EMOJIS.map(em => (
            <button key={em} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 3px", borderRadius: 6 }}
              onClick={() => { onReact?.(msg.id, em); setCtxMenu(null); }}>
              {em}
            </button>
          ))}
        </span>
      ),
      action: () => {},
    });
    items.push(null);
    items.push({ icon: "↩", label: t("grp.msg.reply"), action: () => onReply?.(msg) });
    items.push({ icon: "↪", label: t("forward.title"), action: () => onForward?.(msg) });
    items.push({ icon: <Copy size={13} />, label: t("common.copy"), action: () => navigator.clipboard?.writeText(msg.body || "") });
    if (amAdmin) {
      items.push({ icon: "📌", label: t("grp.msg.pin"), action: () => onPin?.(msg.id) });
    }
    if (!isMine) {
      items.push({ icon: "⚑", label: t("common.report"), action: () => onReport?.(msg.id) });
    }
    if (isMine && !msg.deleted) {
      items.push({ icon: <PenSquare size={13} />, label: t("messages.edit"), action: () => { setEditText(msg.body || ""); setEditing(true); } });
    }
    if (isMine || amAdmin) {
      items.push(null);
      items.push({ icon: <Trash2 size={13} />, label: t("common.delete"), danger: true, action: () => onDelete?.(msg.id) });
    }
    setCtxMenu({ x: cx, y: cy, items });
  };

  const handleCtxMenu = (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      openCtxMenu(touch.clientX, touch.clientY);
    }, 500);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };


  if (editing) {
    return (
      <div className="dm-msg dm-msg-mine" data-msg-id={msg.id}>
        <div className="dm-msg-inner">
          <div className="dm-edit-wrap">
            <textarea className="dm-textarea dm-edit-textarea" value={editText}
              onChange={e => setEditText(e.target.value)} autoFocus rows={2} maxLength={2000}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(false); }} />
            <div className="dm-edit-actions">
              <button className="btn ghost dm-edit-cancel" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
              <button className="btn accent dm-edit-save" onClick={saveEdit}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`dm-msg ${isMine ? "dm-msg-mine" : "dm-msg-theirs"} ${isNew ? "dm-msg-new" : ""} ${!showHeader && !isMine ? "dm-msg-grouped" : ""}`}
        data-msg-id={msg.id}
        onContextMenu={handleCtxMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); clearTimeout(pickerTimer.current); setShowPicker(false); }}>
        {!isMine && (
          showHeader
            ? <UserAv name={msg.sender_name} avatar={msg.sender_avatar} size={30} />
            : <div style={{ width: 30, flexShrink: 0 }} />
        )}
        <div className="dm-msg-inner">
          <div className="dm-bubble-wrap">
            <div className={`dm-bubble ${msg.deleted ? "dm-bubble-deleted" : ""}`}>
              {msg.deleted ? (
                <span style={{ color: "var(--ink-faint)", fontStyle: "italic", fontSize: 13 }}>{t("grp.msg.deleted")}</span>
              ) : (
                <>
                  {!isMine && showHeader && (
                    <div className="dm-sender-name dm-sender-name-inside">
                      <Name name={msg.sender_name} handle={msg.sender_handle} tier={msg.sender_tier} size={12} />
                    </div>
                  )}
                  {(msg.reply_body != null || msg.reply_images) && (
                    <ReplyQuote msg={msg} onClick={() => onJumpToMsg?.(msg.reply_to_id)} />
                  )}
                  {imgs.length > 0 && (
                    <div className="dm-bubble-imgs">
                      {imgs.map((im, i) => {
                        const url = assetUrl(typeof im === "string" ? im : im?.url);
                        const isVid = im?.type === "video" || isVideoUrl(url);
                        return isVid
                          ? <VideoPlayer key={i} src={url} className="dm-video-player" />
                          : <img key={i} src={url} className="dm-bubble-img" alt="" onClick={() => window.open(url, "_blank")} />;
                      })}
                    </div>
                  )}
                  {msg.forwarded_from && (
                    <div className="fwd-badge">↪ {t("forward.from")} <span className="fwd-badge-name">{msg.forwarded_from}</span></div>
                  )}
                  {msg.voice_url && <VoiceMessage src={assetUrl(msg.voice_url)} mine={isMine} />}
                  {msg.body && <div className="dm-bubble-text"><PostBody token={token} className="md">{msg.body}</PostBody></div>}
                  <div className="dm-bubble-foot">
                    <span className="dm-time">{fmtTime(msg.created_at)}</span>
                    {msg.edited_at && <span className="dm-edited">{t("messages.edited")}</span>}
                  </div>
                </>
              )}
            </div>
            {hovered && !msg.deleted && onReact && (
              <div className={`dm-heart-wrap ${isMine ? "dm-heart-wrap-mine" : ""}`}>
                <button
                  className="dm-heart-btn"
                  onMouseEnter={() => { pickerTimer.current = setTimeout(() => setShowPicker(true), 400); }}
                  onMouseLeave={() => clearTimeout(pickerTimer.current)}
                  onClick={() => onReact?.(msg.id, "❤️")}
                >
                  ❤️
                </button>
                {showPicker && (
                  <div
                    className={`dm-heart-popup ${isMine ? "dm-heart-popup-mine" : ""}`}
                    onMouseEnter={() => clearTimeout(pickerTimer.current)}
                    onMouseLeave={() => setShowPicker(false)}
                  >
                    {GRP_QUICK_EMOJIS.map(em => (
                      <button key={em} className="dm-qr-btn" onClick={() => { onReact?.(msg.id, em); setShowPicker(false); }}>{em}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {msg.reactions?.length > 0 && (
            <div className={`dm-reactions ${isMine ? "dm-reactions-mine" : ""}`}>
              {msg.reactions.map(r => (
                <button key={r.emoji} className={`dm-reaction ${r.mine ? "dm-reaction-mine" : ""}`} onClick={() => onReact?.(msg.id, r.emoji)}>
                  {r.emoji} {r.count > 1 && <span className="dm-reaction-count">{r.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {ctxMenu && <GrpCtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
    </>
  );
}

// ─── Members modal ────────────────────────────────────────────
function MembersModal({ group, myId, amAdmin, token, onClose, onKick }) {
  const t = useT();
  return (
    <div className="grp-share-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-members-modal pop-in">
        <div className="share-modal-head">
          <span className="share-modal-title">{t("grp.members.title", { n: group.members?.length || 0 })}</span>
          <button className="share-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grp-members-modal-list">
          {(group.members || []).map(m => (
            <div key={m.user_id} className="grp-member-row" style={{ padding: "10px 18px" }}>
              <UserAv name={m.name} avatar={m.avatar_url} size={32} />
              <div className="grp-member-info">
                <Name name={m.name} handle={m.handle} tier={m.subscription_tier} size={13} />
                {m.role === "admin" && <span className="grp-role-badge">{t("grp.role.admin")}</span>}
              </div>
              {amAdmin && m.user_id !== myId && (
                <button className="grp-kick-btn" onClick={() => { onKick(m.user_id, m.handle); onClose(); }} title={t("grp.kick")}>
                  <UserMinus size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Group chat view ───────────────────────────────────────────
function GroupChatView({ group, token, myId, onBack, onGroupUpdate, safeMode, chatEnterSend }) {
  const t = useT();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [newIds, setNewIds] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [fmtMenu, setFmtMenu] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMsg, setPinnedMsg] = useState(group.pinnedMsg || null);
  const [asGroup, setAsGroup] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [typingNames, setTypingNames] = useState([]);
  const [forwardMsg, setForwardMsg] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const searchTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef(new Map());
  const toast = useToast();
  const confirm = useConfirm();
  const voiceRec = useVoiceRecorder();

  const scrollBottom = (behavior = "smooth") =>
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));

  const jumpToMsg = (msgId) => {
    if (!msgId) return;
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("dm-msg-highlight");
    setTimeout(() => el.classList.remove("dm-msg-highlight"), 1800);
  };

  const load = useCallback(async () => {
    try {
      const list = await api(`/groups/${group.id}/messages`, { token });
      setMsgs(list);
      scrollBottom("instant");
    } catch (e) { toast(e.message, { type: "error" }); }
  }, [group.id, token]);

  useEffect(() => { load(); inputRef.current?.focus(); }, [load]);

  useEffect(() => {
    const h = e => {
      const { msg } = e.detail;
      if (msg.group_id !== group.id) return;
      setMsgs(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setNewIds(prev => new Set([...prev, msg.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; }), 700);
      scrollBottom();
    };
    const hDel = e => {
      if (e.detail.groupId !== group.id) return;
      setMsgs(prev => prev.map(m => m.id === e.detail.msgId ? { ...m, deleted: 1 } : m));
    };
    window.addEventListener("ws:group:message", h);
    window.addEventListener("ws:group:message_deleted", hDel);
    return () => {
      window.removeEventListener("ws:group:message", h);
      window.removeEventListener("ws:group:message_deleted", hDel);
    };
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id) return;
      onGroupUpdate({ ...group, members: e.detail.members });
    };
    window.addEventListener("ws:group:members_updated", h);
    return () => window.removeEventListener("ws:group:members_updated", h);
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id) return;
      onGroupUpdate({ ...group, name: e.detail.name, avatar_url: e.detail.avatar_url, channel_mode: e.detail.channel_mode, events_enabled: e.detail.events_enabled });
    };
    window.addEventListener("ws:group:updated", h);
    return () => window.removeEventListener("ws:group:updated", h);
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id) return;
      setPinnedMsg(e.detail.pinnedMsg || null);
    };
    window.addEventListener("ws:group:pin_updated", h);
    return () => window.removeEventListener("ws:group:pin_updated", h);
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id) return;
      setMsgs(prev => prev.map(m => m.id === e.detail.msgId ? { ...m, reactions: e.detail.reactions } : m));
    };
    window.addEventListener("ws:group:reaction", h);
    return () => window.removeEventListener("ws:group:reaction", h);
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id) return;
      setMsgs(prev => prev.map(m => m.id === e.detail.msgId ? { ...m, body: e.detail.body, edited_at: e.detail.editedAt } : m));
    };
    window.addEventListener("ws:group:message_edited", h);
    return () => window.removeEventListener("ws:group:message_edited", h);
  }, [group.id]);

  useEffect(() => {
    const h = e => {
      if (e.detail.groupId !== group.id || e.detail.userId === myId) return;
      const { userId, name } = e.detail;
      setTypingNames(prev => prev.includes(name) ? prev : [...prev, name]);
      const prev = typingTimers.current.get(userId);
      if (prev) clearTimeout(prev);
      typingTimers.current.set(userId, setTimeout(() => {
        setTypingNames(p => p.filter(n => n !== name));
        typingTimers.current.delete(userId);
      }, 3000));
    };
    window.addEventListener("ws:group:typing", h);
    return () => { window.removeEventListener("ws:group:typing", h); typingTimers.current.forEach(t => clearTimeout(t)); };
  }, [group.id, myId]);

  const sendGroupTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "group:typing", groupId: group.id } }));
  }, [group.id]);

  const handleDelete = async (msgId) => {
    if (safeMode !== false) {
      if (!(await confirm({ title: t("grp.del.title"), danger: true, okText: t("common.delete") }))) return;
    }
    try {
      await api(`/groups/${group.id}/messages/${msgId}`, { method: "DELETE", token });
      setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, deleted: 1 } : m));
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleKick = async (userId, handle) => {
    if (!(await confirm({ title: t("grp.kick.title", { handle }), danger: true, okText: t("grp.kick") }))) return;
    try {
      await api(`/groups/${group.id}/members/${userId}`, { method: "DELETE", token });
      onGroupUpdate({ ...group, members: group.members?.filter(m => m.user_id !== userId) });
      toast(t("grp.kick.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleReact = async (msgId, emoji) => {
    // Optimistic update
    setMsgs(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = m.reactions || [];
      const existing = reactions.find(r => r.emoji === emoji);
      if (existing?.mine) return { ...m, reactions: reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0) };
      if (existing) return { ...m, reactions: reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r) };
      return { ...m, reactions: [...reactions, { emoji, count: 1, mine: true }] };
    }));
    try {
      const { reactions } = await api(`/groups/${group.id}/messages/${msgId}/react`, { method: "POST", token, body: { emoji } });
      setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    } catch {}
  };

  const handleEditMsg = async (msgId, newBody) => {
    try {
      await api(`/groups/${group.id}/messages/${msgId}`, { method: "PATCH", token, body: { body: newBody } });
      setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, body: newBody, edited_at: new Date().toISOString() } : m));
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleReport = (msgId) => {
    setReportTarget({ type: "group_message", id: msgId });
  };

  const handlePin = async (msgId) => {
    try {
      const r = await api(`/groups/${group.id}/pin`, { method: "PATCH", token, body: { message_id: msgId } });
      setPinnedMsg(r.pinnedMsg || null);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handleUnpin = async () => {
    try {
      await api(`/groups/${group.id}/pin`, { method: "PATCH", token, body: { message_id: null } });
      setPinnedMsg(null);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const sendVoice = async () => {
    const blob = await voiceRec.stop();
    if (!blob) return;
    const fd = new FormData();
    fd.append("audio", blob, "voice.webm");
    try {
      const res = await fetch(`/api/groups/${group.id}/messages/voice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const msg = await res.json();
      setMsgs(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      scrollBottom();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const doSearch = async (q) => {
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api(`/groups/${group.id}/messages/search?q=${encodeURIComponent(q)}`, { token });
        setSearchResults(res);
      } catch {}
    }, 300);
  };

  const addFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(Array.from(files), token);
      setAttachments(prev => [...prev, ...urls].slice(0, 4));
    } catch (e) { toast(e.message || t("grp.errorUpload"), { type: "error" }); }
    finally { setUploading(false); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body && attachments.length === 0) return;
    if (sending || uploading) return;
    setSending(true);
    const sentBody = body;
    const sentAttachments = [...attachments];
    const sentReplyTo = replyTo;
    setText(""); setAttachments([]);
    setReplyTo(null);
    try {
      const msg = await api(`/groups/${group.id}/messages`, { method: "POST", token, body: { body: sentBody, images: sentAttachments, reply_to_id: sentReplyTo?.id || null, as_group: asGroup } });
      setMsgs(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setNewIds(prev => new Set([...prev, msg.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; }), 700);
      scrollBottom();
    } catch (e) {
      setText(sentBody); setAttachments(sentAttachments);
      toast(e.message, { type: "error" });
    } finally { setSending(false); }
  };

  const grouped = [];
  let currentDate = null;
  for (const m of msgs) {
    const d = fmtDate(m.created_at, t);
    if (d !== currentDate) { currentDate = d; grouped.push({ date: d, msgs: [] }); }
    grouped[grouped.length - 1].msgs.push(m);
  }

  const myRole = group.members?.find(m => m.user_id === myId)?.role;
  const amAdmin = myRole === "admin";

  return (
    <div className="dm-chat-area">
      <div className="dm-chat-head" style={{ flexDirection: "column", alignItems: "stretch", padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
          <div onClick={() => setShowMembers(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <GroupAvatar group={group} size={38} />
            <div className="dm-chat-info" style={{ alignItems: "flex-start" }}>
              <span className="dm-chat-name">{group.name}</span>
              {typingNames.length > 0
                ? <span className="dm-chat-sub dm-sub-typing">{typingNames.join(", ")} {t("grp.typing")}<span className="dm-typing-dots"><span/><span/><span/></span></span>
                : <button className="grp-members-btn dm-chat-sub" style={{ textAlign: "left" }} onClick={e => { e.stopPropagation(); setShowMembers(true); }}>
                    {t("grp.members.count", { n: group.members?.length || 0 })}
                  </button>
              }
            </div>
          </div>
          <div className="dm-chat-actions">
            <DMTip text={t("search.messages")} pos="bottom">
              <button className={`dm-dots ${searchOpen ? "dm-attach-btn-on" : ""}`} onClick={() => { setSearchOpen(v => !v); setSearchQ(""); setSearchResults([]); }}><Search size={16} /></button>
            </DMTip>
            <DMTip text={t("grp.settings.title")} pos="bottom">
              <button className="dm-dots" onClick={() => setShowSettings(true)}><Settings size={16} /></button>
            </DMTip>
            <DMTip text={t("grp.back")} pos="bottom">
              <button className="dm-dots grp-close-btn" onClick={onBack} style={{ fontSize: 18 }}>←</button>
            </DMTip>
          </div>
        </div>
        {searchOpen && (
          <div className="grp-search-bar">
            <Search size={14} className="grp-search-bar-ico" />
            <input className="grp-search-bar-input" autoFocus placeholder={t("search.placeholder")}
              value={searchQ} onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }} />
            {searchQ && <button className="grp-search-bar-x" onClick={() => { setSearchQ(""); setSearchResults([]); }}><X size={13} /></button>}
          </div>
        )}
        {searchOpen && searchQ && (
          <div className="grp-search-results">
            {searchResults.length === 0
              ? <div className="grp-search-empty">{t("search.noResults")}</div>
              : searchResults.map(m => (
                <button key={m.id} className="grp-search-result-row" onClick={() => { setSearchOpen(false); setSearchQ(""); setSearchResults([]); setTimeout(() => jumpToMsg(m.id), 100); }}>
                  <span className="grp-search-result-name">{m.sender_name}</span>
                  <span className="grp-search-result-text">{m.body?.slice(0, 80)}</span>
                  <span className="grp-search-result-time">{fmtTime(m.created_at)}</span>
                </button>
              ))
            }
          </div>
        )}
        {pinnedMsg && (
          <div className="grp-pin-bar" onClick={() => {}}>
            <span className="grp-pin-icon">📌</span>
            <div className="grp-pin-body">
              <span className="grp-pin-name">{pinnedMsg.sender_name || t("grp.msg.message")}</span>
              <span className="grp-pin-text">{(pinnedMsg.body || "").slice(0, 60)}</span>
            </div>
            {amAdmin && (
              <button className="grp-pin-close" onClick={e => { e.stopPropagation(); handleUnpin(); }} title={t("grp.unpin")}><X size={13} /></button>
            )}
          </div>
        )}
      </div>

      <div className="dm-msgs-area">
        {grouped.map(g => (
          <div key={g.date}>
            <div className="dm-datesep"><span>{g.date}</span></div>
            {g.msgs.map((m, idx) => (
              <GrpBubble key={m.id} msg={m} myId={myId} isNew={newIds.has(m.id)}
                prevMsg={idx > 0 ? g.msgs[idx - 1] : null}
                amAdmin={amAdmin} onDelete={handleDelete} onReact={handleReact} token={token}
                onReply={m => { setReplyTo(m); inputRef.current?.focus(); }}
                onPin={handlePin} onReport={handleReport} onJumpToMsg={jumpToMsg} onEdit={handleEditMsg}
                onForward={setForwardMsg} />
            ))}
          </div>
        ))}
        {typingNames.length > 0 && (
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

      {attachments.length > 0 && (
        <div className="dm-attach-strip">
          {attachments.map((a, i) => {
            const url = assetUrl(typeof a === "string" ? a : a?.url);
            return (
              <div key={i} className="dm-attach-thumb">
                {isVideoUrl(url) ? <video src={url} className="dm-attach-img" /> : <img src={url} className="dm-attach-img" alt="" />}
                <button className="dm-attach-rm" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><X size={12} /></button>
              </div>
            );
          })}
        </div>
      )}

      {group.channel_mode && !amAdmin ? (
        <div className="grp-announce-locked">
          <span className="grp-announce-locked-icon">📢</span>
          <span className="grp-announce-locked-text">{t("grp.channelMode.locked")}</span>
        </div>
      ) : (
        <>
          {replyTo && (
            <div className="dm-reply-bar">
              <div className="dm-reply-bar-line" />
              <div className="dm-reply-bar-body">
                <span className="dm-reply-bar-name">{replyTo.sender_name || t("grp.msg.message")}</span>
                <span className="dm-reply-bar-text">{(replyTo.body || "📎").slice(0, 60)}</span>
              </div>
              <button className="dm-reply-bar-close" onClick={() => setReplyTo(null)}><X size={14} /></button>
            </div>
          )}
          <div className="dm-input-wrap">
            <div className="dm-input-area">
              <DMTip text={t("grp.attach")} pos="top">
                <button className="dm-attach-btn" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= 4}>
                  {uploading ? <span className="dm-attach-spin" /> : <ImagePlus size={18} />}
                </button>
              </DMTip>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={e => addFiles(e.target.files)} />
              <textarea
                ref={inputRef}
                className="dm-textarea"
                placeholder={t("grp.placeholder.normal")}
                value={text}
                rows={1}
                maxLength={2000}
                onChange={e => { setText(e.target.value); sendGroupTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && chatEnterSend !== false) { e.preventDefault(); send(); } }}
                onContextMenu={e => { if (!text.trim()) return; e.preventDefault(); setFmtMenu({ x: e.clientX, y: e.clientY }); }}
              />
              <DMTip text={t("composer.emoji")} pos="top">
                <button ref={emojiBtnRef} className={`dm-attach-btn ${showEmoji ? "dm-attach-btn-on" : ""}`} onClick={() => setShowEmoji(v => !v)}>
                  <Smile size={18} />
                </button>
              </DMTip>
              {!text.trim() && attachments.length === 0 && (
                <DMTip text={voiceRec.recording ? t("voice.send") : t("voice.record")} pos="top">
                  <button
                    className={`dm-attach-btn${voiceRec.recording ? " dm-attach-btn-recording" : ""}`}
                    onClick={voiceRec.recording ? sendVoice : voiceRec.start}
                  >
                    {voiceRec.recording
                      ? <><Square size={14} /><span className="dm-rec-timer">{Math.floor(voiceRec.duration / 60)}:{String(voiceRec.duration % 60).padStart(2, "0")}</span></>
                      : <Mic size={18} />}
                  </button>
                </DMTip>
              )}
              <DMTip text={t("grp.send")} pos="top">
                <button className={`dm-send ${(text.trim() || attachments.length > 0) ? "dm-send-on" : ""}`} onClick={send}
                  disabled={(!text.trim() && attachments.length === 0) || sending || uploading}>
                  <Send size={18} />
                </button>
              </DMTip>
            </div>
            {amAdmin && (
              <div className="grp-as-group-bar">
                <button
                  className={`grp-as-group-btn ${asGroup ? "grp-as-group-btn-on" : ""}`}
                  onClick={() => setAsGroup(v => !v)}
                >
                  {asGroup
                    ? <><GroupAvatar group={group} size={14} /> {t("grp.asGroup.on", { name: group.name })}</>
                    : <><PenSquare size={13} /> {t("grp.asGroup.off")}</>
                  }
                </button>
                <div className="dm-input-tip" style={{ padding: 0 }}>{t("grp.inputTip")}</div>
              </div>
            )}
            {!amAdmin && <div className="dm-input-tip">{t("grp.inputTip")}</div>}
          </div>
        </>
      )}

      {showEmoji && <EmojiPicker anchorRef={emojiBtnRef} onPick={emoji => { setText(prev => prev + emoji); inputRef.current?.focus(); }} onClose={() => setShowEmoji(false)} />}
      {fmtMenu && <FormatMenu x={fmtMenu.x} y={fmtMenu.y} textareaRef={inputRef} onChange={setText} onClose={() => setFmtMenu(null)} />}

      {showSettings && (
        <GroupSettingsModal group={group} token={token} myId={myId} amAdmin={amAdmin}
          onClose={() => setShowSettings(false)} onGroupUpdate={onGroupUpdate} />
      )}
      {showMembers && (
        <MembersModal group={group} myId={myId} amAdmin={amAdmin} token={token}
          onClose={() => setShowMembers(false)} onKick={handleKick} />
      )}
      {forwardMsg && <ForwardModal token={token} msg={forwardMsg} onClose={() => setForwardMsg(null)} />}
    </div>
  );
}

// ─── Group share modal ─────────────────────────────────────────
function ShareGroupModal({ group, token, onClose }) {
  const t = useT();
  const [tab, setTab] = useState("link");
  const [handle, setHandle] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [linkToken, setLinkToken] = useState(null);
  const [groupHandle, setGroupHandle] = useState(group.handle || null);
  const [regenerating, setRegenerating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const searchTimer = useRef(null);
  const toast = useToast();

  useEffect(() => {
    api(`/groups/${group.id}/invite-link`, { method: "POST", token })
      .then(r => { setLinkToken(r.token); if (r.handle) setGroupHandle(r.handle); }).catch(() => {});
  }, [group.id, token]);

  const randomLink = linkToken ? `${window.location.origin}?group=${linkToken}` : t("grp.invite.generating");
  const permanentLink = groupHandle ? `${window.location.origin}?group=@${groupHandle}` : t("grp.invite.generating");
  const qrUrl = linkToken ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(randomLink)}&size=180x180&margin=10` : null;

  const copyLink = (url) => { navigator.clipboard?.writeText(url); toast(t("grp.invite.copied"), { type: "success" }); };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const r = await api(`/groups/${group.id}/invite-link`, { method: "POST", token, body: { regenerate: true } });
      setLinkToken(r.token);
      toast(t("grp.invite.regenerated"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setRegenerating(false); }
  };

  const sendInvite = async () => {
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setSending(true);
    try {
      await api(`/groups/${group.id}/invite`, { method: "POST", token, body: { handle: h } });
      setSent(true);
      toast(t("grp.invite.sentToast", { h }), { type: "success" });
    } catch (e) { toast(e.message || t("grp.invite.notFound"), { type: "error" }); }
    finally { setSending(false); }
  };

  return (
    <div className="grp-share-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-share-modal pop-in">
        <div className="share-modal-head">
          <span className="share-modal-title">{t("grp.invite.title")}</span>
          <button className="share-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="share-modal-tabs">
          <button className={`share-modal-tab ${tab === "link" ? "active" : ""}`} onClick={() => setTab("link")}>{t("grp.invite.tab.link")}</button>
          <button className={`share-modal-tab ${tab === "username" ? "active" : ""}`} onClick={() => setTab("username")}>{t("grp.invite.tab.username")}</button>
          <button className={`share-modal-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>{t("grp.invite.tab.qr")}</button>
        </div>
        {tab === "link" && (
          <div className="share-modal-body">
            <div className="grp-invite-link-section">
              <div className="grp-invite-link-label">{t("grp.invite.randomLink")}</div>
              <div className="share-modal-link-row">
                <span className="share-modal-link-text">{randomLink}</span>
                <button className="btn accent" onClick={() => copyLink(randomLink)} disabled={!linkToken}><Copy size={13} /> {t("common.copy")}</button>
              </div>
              <button className="btn ghost grp-invite-regen-btn" onClick={regenerate} disabled={regenerating || !linkToken}>
                {regenerating ? t("common.loading") : t("grp.invite.regenerate")}
              </button>
            </div>
            <div className="grp-invite-link-sep" />
            <div className="grp-invite-link-section">
              <div className="grp-invite-link-label">{t("grp.invite.permanentLink")} {groupHandle && <span className="grp-invite-handle-badge">@{groupHandle}</span>}</div>
              <div className="share-modal-link-row">
                <span className="share-modal-link-text">{permanentLink}</span>
                <button className="btn accent" onClick={() => copyLink(permanentLink)} disabled={!groupHandle}><Copy size={13} /> {t("common.copy")}</button>
              </div>
            </div>
          </div>
        )}
        {tab === "username" && (
          <div className="share-modal-body">
            {sent ? (
              <div className="share-modal-sent">{t("grp.invite.sentConfirm", { handle })}</div>
            ) : (
              <>
                <div className="grp-invite-ac-wrap">
                  <input className="grp-panel-input" placeholder="@username" value={handle} autoFocus
                    onChange={e => {
                      const val = e.target.value;
                      setHandle(val);
                      clearTimeout(searchTimer.current);
                      const q = val.replace(/^@/, "").trim();
                      if (q.length < 1) { setSuggestions([]); setShowSugg(false); return; }
                      searchTimer.current = setTimeout(async () => {
                        try {
                          const res = await api(`/users/search?q=${encodeURIComponent(q)}`, { token });
                          setSuggestions(res.slice(0, 5));
                          setShowSugg(res.length > 0);
                        } catch { setSuggestions([]); }
                      }, 250);
                    }}
                    onKeyDown={e => e.key === "Enter" && sendInvite()}
                    onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  />
                  {showSugg && (
                    <div className="grp-invite-ac-list">
                      {suggestions.map(u => (
                        <button key={u.handle} className="grp-invite-ac-item"
                          onMouseDown={e => { e.preventDefault(); setHandle(`@${u.handle}`); setShowSugg(false); }}>
                          <UserAv name={u.name} avatar={u.avatar_url} size={24} />
                          <span className="grp-invite-ac-name">{u.name}</span>
                          <span className="grp-invite-ac-handle">@{u.handle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn accent" style={{ marginTop: 10, width: "100%" }} onClick={sendInvite} disabled={sending || !handle.trim()}>
                  {sending ? t("grp.invite.sending") : t("grp.invite.sendBtn")}
                </button>
              </>
            )}
          </div>
        )}
        {tab === "qr" && (
          <div className="share-modal-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {qrUrl
              ? <img src={qrUrl} alt="QR" width={160} height={160} style={{ borderRadius: 8 }} />
              : <div style={{ width: 160, height: 160, display: "grid", placeItems: "center", color: "var(--ink-faint)" }}>{t("common.loading")}</div>
            }
            <p style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>{t("grp.invite.qrHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group settings modal ─────────────────────────────────────
function GroupSettingsModal({ group, token, myId, amAdmin, onClose, onGroupUpdate }) {
  const t = useT();
  const [editName, setEditName] = useState(group.name);
  const [editType, setEditType] = useState(group.type);
  const [channelMode, setChannelMode] = useState(!!group.channel_mode);
  const [eventsEnabled, setEventsEnabled] = useState(group.events_enabled !== 0);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (amAdmin && group.type === "request") {
      api(`/groups/${group.id}/requests`, { token }).then(setRequests).catch(() => {});
    }
  }, [group.id, group.type, amAdmin, token]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updated = await api(`/groups/${group.id}`, { method: "PATCH", token, body: { name: editName, type: editType, channel_mode: channelMode, events_enabled: eventsEnabled } });
      onGroupUpdate(updated);
      toast(t("grp.settings.saved"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };

  const uploadAvatar = async (file) => {
    setAvatarUploading(true);
    try {
      const [{ url }] = await uploadImages([file], token);
      const updated = await api(`/groups/${group.id}`, { method: "PATCH", token, body: { avatar_url: url } });
      onGroupUpdate(updated);
      toast(t("grp.settings.avatarUpdated"), { type: "success" });
    } catch (e) { toast(e.message || t("grp.errorUpload"), { type: "error" }); }
    finally { setAvatarUploading(false); }
  };

  const approveReq = async (userId) => {
    try {
      await api(`/groups/${group.id}/requests/${userId}/approve`, { method: "POST", token });
      setRequests(prev => prev.filter(r => r.user_id !== userId));
      toast(t("grp.req.approved"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const rejectReq = async (userId) => {
    try {
      await api(`/groups/${group.id}/requests/${userId}/reject`, { method: "POST", token });
      setRequests(prev => prev.filter(r => r.user_id !== userId));
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const TYPE_OPTS = [
    { value: "open",    label: t("grp.type.open"),    desc: t("grp.type.open.desc") },
    { value: "request", label: t("grp.type.request"), desc: t("grp.type.request.desc") },
    { value: "closed",  label: t("grp.type.closed"),  desc: t("grp.type.closed.desc") },
  ];

  return (
    <div className="grp-share-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-settings-modal pop-in">
        <div className="share-modal-head">
          <span className="share-modal-title">{t("grp.settings.title")}</span>
          <button className="share-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grp-settings-modal-body">
          <div className="grp-settings-identity">
            <div className="grp-av-upload-wrap" onClick={() => amAdmin && avatarRef.current?.click()}>
              {avatarUploading
                ? <div className="grp-av-letter" style={{ width: 64, height: 64, fontSize: 28 }}>…</div>
                : <GroupAvatar group={group} size={64} />
              }
              {amAdmin && <div className="grp-av-upload-overlay">📷</div>}
            </div>
            {amAdmin && <input ref={avatarRef} type="file" accept="image/*" hidden onChange={e => e.target.files[0] && uploadAvatar(e.target.files[0])} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{group.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{t("grp.members.count", { n: group.members?.length || 0 })}</div>
            </div>
          </div>

          {amAdmin && (
            <div className="grp-settings-section">
              <div className="grp-settings-label">{t("grp.settings.name")}</div>
              <input className="grp-panel-input" value={editName} onChange={e => setEditName(e.target.value)} maxLength={100} />
              <div className="grp-settings-label" style={{ marginTop: 12 }}>{t("grp.settings.typeLabel")}</div>
              <div className="grp-type-options" style={{ marginTop: 6 }}>
                {TYPE_OPTS.map(opt => (
                  <label key={opt.value} className={`grp-type-opt ${editType === opt.value ? "grp-type-opt-active" : ""}`}>
                    <input type="radio" name="grp-type-s" value={opt.value} checked={editType === opt.value} onChange={() => setEditType(opt.value)} hidden />
                    <div className="grp-type-opt-title">{opt.label}</div>
                    <div className="grp-type-opt-desc">{opt.desc}</div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="grp-toggle-row">
                  <span className="grp-toggle-label">
                    <span>📢 {t("grp.settings.channelMode")}</span>
                    <span className="grp-toggle-sub">{t("grp.channelMode.sub")}</span>
                  </span>
                  <button className={`grp-toggle ${channelMode ? "on" : ""}`} onClick={() => setChannelMode(v => !v)} />
                </label>
                <label className="grp-toggle-row">
                  <span className="grp-toggle-label">
                    <span>📋 {t("grp.settings.events")}</span>
                    <span className="grp-toggle-sub">{t("grp.settings.events.sub")}</span>
                  </span>
                  <button className={`grp-toggle ${eventsEnabled ? "on" : ""}`} onClick={() => setEventsEnabled(v => !v)} />
                </label>
              </div>
              <button className="btn accent" style={{ marginTop: 12, width: "100%" }} onClick={saveSettings} disabled={saving}>
                {saving ? t("grp.settings.saving") : t("common.save")}
              </button>
            </div>
          )}

          <div className="grp-settings-section">
            <button className="btn ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowShare(true)}>
              <Share2 size={14} /> {t("grp.invite.btn")}
            </button>
          </div>

          {!amAdmin && (
            <div className="grp-settings-section">
              <button className="btn ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--danger, #e05a72)" }}
                onClick={() => setShowReport(true)}>
                ⚑ {t("grp.report.group")}
              </button>
            </div>
          )}

          {showReport && (
            <ReportModal
              targetType="group"
              targetId={group.id}
              token={token}
              onClose={() => setShowReport(false)}
              onSent={() => { toast(t("common.reportSent"), { type: "success" }); onClose(); }}
            />
          )}

          {amAdmin && requests.length > 0 && (
            <div className="grp-settings-section">
              <div className="grp-settings-label">{t("grp.req.title", { n: requests.length })}</div>
              {requests.map(r => (
                <div key={r.user_id} className="grp-req-row">
                  <UserAv name={r.name} avatar={r.avatar_url} size={26} />
                  <span className="grp-req-name">{r.name} <span className="grp-req-handle">@{r.handle}</span></span>
                  <button className="grp-req-btn grp-req-ok" onClick={() => approveReq(r.user_id)}><Check size={13} /></button>
                  <button className="grp-req-btn grp-req-no" onClick={() => rejectReq(r.user_id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showShare && <ShareGroupModal group={group} token={token} onClose={() => setShowShare(false)} />}
    </div>
  );
}

// ─── Create group modal ────────────────────────────────────────
function CreateGroupModal({ token, onCreate, onClose }) {
  const t = useT();
  const [name, setName] = useState("");
  const [type, setType] = useState("open");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const g = await api("/groups", { method: "POST", token, body: { name: name.trim(), type } });
      onCreate(g);
      onClose();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setCreating(false); }
  };

  const TYPE_OPTS = [
    { value: "open",    label: t("grp.type.open"),    desc: t("grp.type.open.desc") },
    { value: "request", label: t("grp.type.request"), desc: t("grp.type.request.desc2") },
    { value: "closed",  label: t("grp.type.closed"),  desc: t("grp.type.closed.desc") },
  ];

  return (
    <div className="grp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-modal">
        <div className="grp-modal-head">
          <span>{t("grp.create.title")}</span>
          <button className="grp-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grp-modal-body">
          <label className="grp-modal-label">{t("grp.settings.name")}</label>
          <input className="grp-panel-input" value={name} onChange={e => setName(e.target.value)}
            placeholder={t("grp.create.namePlaceholder")} maxLength={100} autoFocus
            onKeyDown={e => { if (e.key === "Enter") create(); }} />
          <label className="grp-modal-label" style={{ marginTop: 14 }}>{t("grp.settings.typeShort")}</label>
          <div className="grp-type-options">
            {TYPE_OPTS.map(opt => (
              <label key={opt.value} className={`grp-type-opt ${type === opt.value ? "grp-type-opt-active" : ""}`}>
                <input type="radio" name="grp-type" value={opt.value} checked={type === opt.value} onChange={() => setType(opt.value)} hidden />
                <div className="grp-type-opt-title">{opt.label}</div>
                <div className="grp-type-opt-desc">{opt.desc}</div>
              </label>
            ))}
          </div>
        </div>
        <div className="grp-modal-foot">
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn accent" onClick={create} disabled={creating || !name.trim()}>
            {creating ? t("grp.create.creating") : t("grp.create.btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invites list ──────────────────────────────────────────────
function InvitesList({ token, onAccept }) {
  const t = useT();
  const [invites, setInvites] = useState([]);
  const toast = useToast();

  useEffect(() => {
    api("/groups/invites/my", { token }).then(setInvites).catch(() => {});
  }, [token]);

  if (invites.length === 0) return null;

  const accept = async (inv) => {
    try {
      const g = await api(`/groups/invites/${inv.id}/accept`, { method: "POST", token });
      setInvites(prev => prev.filter(i => i.id !== inv.id));
      onAccept(g);
      toast(t("grp.joined", { name: inv.group_name }), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const reject = async (inv) => {
    try {
      await api(`/groups/invites/${inv.id}/reject`, { method: "POST", token });
      setInvites(prev => prev.filter(i => i.id !== inv.id));
    } catch {}
  };

  return (
    <div className="grp-invites">
      <div className="grp-invites-title">{t("grp.invitesList.title", { n: invites.length })}</div>
      {invites.map(inv => (
        <div key={inv.id} className="grp-invite-row">
          <div className="grp-invite-av">
            {inv.group_avatar
              ? <img src={assetUrl(inv.group_avatar)} style={{ width: 34, height: 34, borderRadius: "50%" }} alt="" />
              : <div className="grp-av-letter" style={{ width: 34, height: 34, fontSize: 15 }}>{inv.group_name[0]}</div>
            }
          </div>
          <div className="grp-invite-info">
            <div className="grp-invite-name">{inv.group_name}</div>
            <div className="grp-invite-from">{t("grp.invitesList.from", { name: inv.inviter_name })}</div>
          </div>
          <button className="grp-req-btn grp-req-ok" onClick={() => accept(inv)}><Check size={13} /></button>
          <button className="grp-req-btn grp-req-no" onClick={() => reject(inv)}><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Open groups discovery ────────────────────────────────────
function GroupDiscovery({ token, myId, onJoin }) {
  const t = useT();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    api("/groups/open", { token }).then(setGroups).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const join = async (g) => {
    try {
      const result = await api(`/groups/${g.id}/join`, { method: "POST", token });
      if (result.status === "pending") {
        toast(t("grp.req.pendingToast"), { type: "info" });
        setGroups(prev => prev.map(x => x.id === g.id ? { ...x, _pending: true } : x));
      } else {
        toast(t("grp.joined", { name: g.name }), { type: "success" });
        onJoin(result);
      }
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const filtered = groups.filter(g => !g.is_member && g.name.toLowerCase().includes(search.toLowerCase()));

  const TYPE_LABELS = {
    open:    t("grp.type.open"),
    request: t("grp.type.request"),
    closed:  t("grp.type.closed"),
  };

  const GRAD = ["#FF6B6B,#FF8E53", "#4ECDC4,#45B7D1", "#96CEB4,#88D8B0", "#FECA57,#FF9FF3", "#A29BFE,#6C5CE7", "#FD79A8,#E84393"];
  const gradFor = (name) => GRAD[(name.charCodeAt(0) || 0) % GRAD.length];

  if (loading) return (
    <div className="disc-wrap">
      <div className="disc-loading">{t("grp.discovery.loading")}</div>
    </div>
  );

  return (
    <div className="disc-wrap">
      <div className="disc-head">
        <div className="disc-title">{t("grp.discovery.title")}</div>
        <div className="disc-search-wrap">
          <Search size={13} className="disc-search-ico" />
          <input className="disc-search" placeholder={t("common.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="disc-empty">{search ? t("common.noResults") : t("grp.discovery.allJoined")}</div>
      )}
      <div className="disc-grid">
        {filtered.map(g => {
          const grad = gradFor(g.name);
          const letter = (g.name || "G")[0].toUpperCase();
          return (
            <div key={g.id} className="disc-card">
              <div className="disc-card-av" style={{ background: `linear-gradient(135deg, ${grad})` }}>
                {g.avatar_url
                  ? <img src={assetUrl(g.avatar_url)} className="disc-card-av-img" alt="" />
                  : <span className="disc-card-av-letter">{letter}</span>
                }
              </div>
              <div className="disc-card-body">
                <div className="disc-card-name">{g.name}</div>
                <div className="disc-card-meta">
                  <span className={`disc-type-badge disc-type-${g.type}`}>{TYPE_LABELS[g.type] || g.type}</span>
                  <span className="disc-card-count">👥 {g.member_count}</span>
                </div>
              </div>
              <button
                className={`disc-join-btn ${g._pending ? "disc-join-pending" : ""}`}
                onClick={() => !g._pending && join(g)}
                disabled={!!g._pending}
              >
                {g._pending ? t("grp.req.pending") : g.type === "request" ? t("grp.req.submit") : t("grp.join")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sidebar list ──────────────────────────────────────────────
function GroupSidebar({ groups, activeId, myId, onSelect, onNew, onLeave, width, onResizeStart, onBack, token, hiddenOnMobile }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [ctxMenu, setCtxMenu] = useState(null);
  const confirm = useConfirm();
  const toast = useToast();

  const doLeave = async (g) => {
    const members = g.members || [];
    const myRole = members.find(m => m.user_id === myId)?.role;
    const isAdminRole = myRole === "admin";
    const adminCount = members.filter(m => m.role === "admin").length;
    const isLastAdmin = isAdminRole && adminCount <= 1;
    const title = isLastAdmin
      ? t("grp.leave.adminWarning", { name: g.name })
      : t("grp.leave.title", { name: g.name });
    if (!(await confirm({ title, danger: true, okText: t("grp.leave.btn") }))) return;
    try {
      await api(`/groups/${g.id}/leave`, { method: "POST", token });
      onLeave(g.id);
      toast(t("grp.leave.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const leave = async (e, g) => { e.stopPropagation(); doLeave(g); };

  const openCtxMenu = (e, g) => {
    e.preventDefault();
    e.stopPropagation();
    const items = [
      { icon: "👤", label: t("grp.ctx.open"), action: () => onSelect(g) },
      { icon: <Copy size={13} />, label: t("grp.ctx.copyName"), action: () => { navigator.clipboard?.writeText(g.name); toast(t("grp.ctx.copied"), { type: "success" }); } },
      null,
      { icon: <X size={13} />, label: t("grp.leave.btn"), danger: true, action: () => doLeave(g) },
    ];
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };

  const filtered = search.trim()
    ? groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <aside className={`dm-side${hiddenOnMobile ? " dm-side-hidden" : ""}`} style={{ width }}>
      <div className="dm-side-top">
        <div className="dm-side-brand">
          <DMTip text={t("grp.sidebar.backTip")} pos="right">
            <button className="dm-back-desktop" onClick={onBack} aria-label={t("grp.sidebar.feedLabel")}>
              <ArrowLeft size={16} />
            </button>
          </DMTip>
          <span className="dm-side-title">{t("grp.sidebar.title")}</span>
          <DMTip text={t("grp.create.title")} pos="bottom">
            <button className="dm-side-new" onClick={onNew}>
              <Plus size={16} />
            </button>
          </DMTip>
        </div>
        <div className="dm-search-wrap">
          <Search className="dm-search-ico" size={14} />
          <input className="dm-search" placeholder={t("grp.sidebar.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="dm-search-x" onClick={() => setSearch("")}><X size={13} /></button>}
        </div>
      </div>

      <div className="dm-convs">
        {filtered.length === 0 && (
          <div className="dm-convs-empty">
            {search ? t("common.noResults") : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div>{t("grp.sidebar.emptyHint")}</div>
                <button className="dm-btn-pri" style={{ marginTop: 12, fontSize: 13 }} onClick={onNew}>{t("grp.create.title")}</button>
              </>
            )}
          </div>
        )}
        {filtered.map(g => {
          const active = activeId === g.id;
          return (
            <button key={g.id}
              className={`dm-ci ${active ? "dm-ci-on" : ""}`}
              onClick={() => onSelect(g)}
              onContextMenu={e => openCtxMenu(e, g)}>
              <GroupAvatar group={g} size={46} />
              <div className="dm-ci-body">
                <div className="dm-ci-row1">
                  <span className="dm-ci-name">{g.name}</span>
                  <span className="dm-ci-ts">{timeAgo(g.last_at, t)}</span>
                </div>
                <div className="dm-ci-row2">
                  <span className="dm-ci-preview">
                    {g.last_msg
                      ? <>{g.last_sender_name && <span className="grp-sidebar-sender">{g.last_sender_name.split(" ")[0]}: </span>}{g.last_msg.slice(0, 35)}</>
                      : <span style={{ color: "var(--ink-faint)" }}>{t("grp.members.count", { n: g.member_count || 0 })}</span>
                    }
                  </span>
                </div>
              </div>
              {g.unread > 0 && <span className="dm-badge">{g.unread > 9 ? "9+" : g.unread}</span>}
              <button className="grp-leave-btn" onClick={e => leave(e, g)} title={t("grp.leave.btn")}><X size={13} /></button>
            </button>
          );
        })}
      </div>
      {ctxMenu && <GrpCtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      <div className="dm-resize-handle" onMouseDown={onResizeStart}>
        <DMTip text={t("grp.sidebar.resizeTip")} pos="right">
          <div className="dm-resize-handle-inner" />
        </DMTip>
      </div>
    </aside>
  );
}

// ─── Root GroupView ────────────────────────────────────────────
export default function GroupView({ token, myId, width, onBack, inviteToken, onClearInviteToken, safeMode, chatEnterSend }) {
  const t = useT();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [inviteJoinGroup, setInviteJoinGroup] = useState(null);
  const [sideWidth, setSideWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("xalle.dm.sideWidth") || "300");
    return (saved >= 180 && saved <= 480) ? saved : 300;
  });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, w: 300 });

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
      setSideWidth(Math.max(180, Math.min(480, resizeStart.current.w + delta)));
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

  const loadGroups = useCallback(async () => {
    try { const list = await api("/groups", { token }); setGroups(list); return list; } catch { return []; }
  }, [token]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (!inviteToken) return;
    api(`/groups/by-token/${inviteToken}`, { token })
      .then(g => {
        onClearInviteToken?.();
        if (g.is_member) {
          selectGroup(g);
        } else {
          setInviteJoinGroup(g);
        }
      })
      .catch(() => { onClearInviteToken?.(); });
  }, [inviteToken]);

  const selectGroup = useCallback(async (g) => {
    setActiveGroup(g);
    try {
      const full = await api(`/groups/${g.id}`, { token });
      setActiveGroup(full);
    } catch {}
  }, [token]);

  const handleGroupUpdate = useCallback((updated) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
    setActiveGroup(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }, []);

  useEffect(() => {
    const h = e => {
      const { groupId, name, avatar_url } = e.detail;
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name, avatar_url } : g));
      setActiveGroup(prev => prev?.id === groupId ? { ...prev, name, avatar_url } : prev);
    };
    window.addEventListener("ws:group:updated", h);
    return () => window.removeEventListener("ws:group:updated", h);
  }, []);

  const handleCreate = (g) => {
    setGroups(prev => [g, ...prev]);
    setActiveGroup(g);
  };

  const handleJoin = (g) => {
    setGroups(prev => {
      if (prev.find(x => x.id === g.id)) return prev;
      return [g, ...prev];
    });
    setActiveGroup(g);
    setShowDiscovery(false);
  };

  const handleLeave = (groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeGroup?.id === groupId) setActiveGroup(null);
  };

  useEffect(() => {
    const h = e => {
      const { msg } = e.detail;
      if (msg.type === "system") return;
      setGroups(prev => prev.map(g =>
        g.id === msg.group_id
          ? { ...g, last_msg: msg.body || (msg.voice_url ? "🎤 Голосовое" : ""), last_at: msg.created_at, last_sender_name: msg.sender_name }
          : g
      ));
    };
    window.addEventListener("ws:group:message", h);
    return () => window.removeEventListener("ws:group:message", h);
  }, []);

  return (
    <div className={`grp-root${activeGroup ? " grp-has-chat" : ""}`}>
      <GroupSidebar
        groups={groups}
        activeId={activeGroup?.id}
        myId={myId}
        onSelect={selectGroup}
        onNew={() => setShowCreate(true)}
        onLeave={handleLeave}
        width={sideWidth}
        onResizeStart={onResizeStart}
        onBack={onBack}
        token={token}
        hiddenOnMobile={!!activeGroup}
      />

      <div className={`grp-main${!activeGroup ? " grp-main-hidden-mobile" : ""}`}>
        {activeGroup ? (
          <GroupChatView
            key={activeGroup.id}
            group={activeGroup}
            token={token}
            myId={myId}
            onBack={() => setActiveGroup(null)}
            onGroupUpdate={handleGroupUpdate}
            safeMode={safeMode}
            chatEnterSend={chatEnterSend}
          />
        ) : (
          <div className="grp-empty">
            <div className="grp-empty-icon"><Users size={40} /></div>
            <h3 className="grp-empty-title">{t("grp.sidebar.title")}</h3>
            <p className="grp-empty-sub">{t("grp.empty.sub")}</p>
            <div className="grp-empty-btns">
              <button className="btn accent" onClick={() => setShowCreate(true)}>{t("grp.create.title")}</button>
              <button className="btn ghost" onClick={() => setShowDiscovery(v => !v)}>
                {showDiscovery ? t("grp.discovery.hide") : t("grp.discovery.find")}
              </button>
            </div>
            <InvitesList token={token} onAccept={handleJoin} />
            {showDiscovery && <GroupDiscovery token={token} myId={myId} onJoin={handleJoin} />}
          </div>
        )}
      </div>

      {showCreate && <CreateGroupModal token={token} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
      {inviteJoinGroup && (
        <InviteLinkJoinModal
          group={inviteJoinGroup}
          token={token}
          onJoin={g => { setInviteJoinGroup(null); handleJoin(g); }}
          onClose={() => setInviteJoinGroup(null)}
        />
      )}
    </div>
  );
}

// ─── Invite link join modal ────────────────────────────────────
function InviteLinkJoinModal({ group, token, onJoin, onClose }) {
  const t = useT();
  const [joining, setJoining] = useState(false);
  const toast = useToast();

  const join = async () => {
    setJoining(true);
    try {
      const result = await api(`/groups/${group.id}/join`, { method: "POST", token });
      if (result.status === "pending") {
        toast(t("grp.req.pendingToast"), { type: "info" });
        onClose();
      } else {
        toast(t("grp.joined", { name: group.name }), { type: "success" });
        onJoin(result);
      }
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setJoining(false); }
  };

  return (
    <div className="grp-share-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-modal pop-in" style={{ maxWidth: 360 }}>
        <div className="grp-modal-head">
          <span>{t("grp.inviteLink.title")}</span>
          <button className="grp-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grp-modal-body" style={{ textAlign: "center", padding: "20px 24px" }}>
          <GroupAvatar group={group} size={64} />
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 12 }}>{group.name}</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 4 }}>{t("grp.members.count", { n: group.member_count || 0 })}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 10 }}>
            {group.type === "closed" ? t("grp.inviteLink.closed") :
             group.type === "request" ? t("grp.inviteLink.request") :
             t("grp.inviteLink.open")}
          </div>
        </div>
        <div className="grp-modal-foot">
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn accent" onClick={join} disabled={joining || group.type === "closed"}>
            {joining ? t("grp.joining") : group.type === "request" ? t("grp.req.submit") : t("grp.join")}
          </button>
        </div>
      </div>
    </div>
  );
}
