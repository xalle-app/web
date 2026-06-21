import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { readTime, timeAgo } from "../../lib/format.js";
import { LiveTime, Avatar, Name, Bubble, Eye, Repost, PresenceDot, EditIcon, TrashIcon, ModTrashIcon, FlagIcon, Clock } from "../shared/icons.jsx";
import { Timer, Users, Trash2, Pin, Lock, LockOpen, Share2, Copy, MessageCircle, Check } from "lucide-react";
import ReportDialog from "./ReportDialog.jsx";
import Md from "../shared/Markdown.jsx";
import PostBody from "../shared/PostBody.jsx";
import Tip from "../shared/Tip.jsx";
import Gallery from "../shared/Lightbox.jsx";
import ReactionBar from "./ReactionBar.jsx";
import Comments from "./Comments.jsx";
import MentionField from "../composer/MentionField.jsx";
import { useFormatMenu } from "../composer/FormatMenu.jsx";
import { useConfirm, useToast } from "../shared/ui.jsx";
import BottomSheet from "../shared/BottomSheet.jsx";
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";


const COLLAPSE_LEN = 500;

function authorColor(userId) {
  const palette = ["#a78bfa","#60a5fa","#34d399","#fb923c","#f472b6","#38bdf8","#a3e635","#fbbf24","#e879f9","#4ade80"];
  return palette[(userId || 0) % palette.length];
}

function usePollCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => expiresAt ? Math.max(0, new Date(expiresAt) - Date.now()) : null);
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      const r = Math.max(0, new Date(expiresAt) - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return remaining;
}

function formatCountdown(ms, t) {
  if (ms <= 0) return t("post.poll.done");
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}д ${h % 24}ч`;
  if (h > 0) return `${h}ч ${m % 60}м`;
  if (m > 0) return `${m}м ${s % 60}с`;
  return `${s}с`;
}

function PollCard({ poll, pollVotes, postId, token, onVote, isMine, onClosePoll }) {
  const t = useT();
  const { locale } = useLocale();
  const [localVotes, setLocalVotes] = useState(pollVotes || { counts: {}, userVote: null, userVotes: [], total: 0 });
  const [voting, setVoting] = useState(false);
  const [voters, setVoters] = useState(null);
  const [votersOptionIdx, setVotersOptionIdx] = useState(null);
  const [flashIdx, setFlashIdx] = useState(null);
  const { counts, userVotes: uvArr, userVote, total } = localVotes;
  const userVotesArr = uvArr || (userVote !== null && userVote !== undefined ? [userVote] : []);
  const hasVoted = userVotesArr.length > 0;
  const remaining = usePollCountdown(poll.expiresAt || null);
  const isExpired = poll.expiresAt && remaining !== null && remaining <= 0;

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.postId !== postId) return;
      const prev = localVotes.counts || {};
      const next = e.detail.counts || {};
      const changed = poll.options.map((_, i) => (prev[i] || 0) !== (next[i] || 0));
      setLocalVotes(v => ({ ...v, counts: next, total: e.detail.total }));
      changed.forEach((c, i) => {
        if (c) {
          setFlashIdx(i);
          setTimeout(() => setFlashIdx(f => f === i ? null : f), 600);
        }
      });
    };
    window.addEventListener("poll:update", handler);
    return () => window.removeEventListener("poll:update", handler);
  }, [postId, localVotes.counts]);

  const vote = async (idx) => {
    if (!token || voting) return;
    setVoting(true);
    try {
      const result = await api(`/posts/${postId}/vote`, { method: "POST", token, body: { optionIdx: idx } });
      setLocalVotes(result);
      onVote?.();
    } catch (e) {} finally { setVoting(false); }
  };

  const cancelVote = async () => {
    if (!token || voting || !hasVoted) return;
    setVoting(true);
    try {
      const result = await api(`/posts/${postId}/vote/cancel`, { method: "DELETE", token });
      setLocalVotes(result);
      onVote?.();
    } catch (e) {} finally { setVoting(false); }
  };

  const showVoters = async (idx) => {
    if (poll.anonymous) return;
    try {
      const data = await api(`/posts/${postId}/poll-voters`, { token });
      setVoters(data.voters || {});
      setVotersOptionIdx(idx);
    } catch {}
  };

  const votersModal = votersOptionIdx !== null && voters !== null && createPortal(
    <div className="poll-voters-modal-overlay" onClick={() => { setVotersOptionIdx(null); setVoters(null); }}>
      <div className="poll-voters-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="poll-voters-modal-head">
          <div className="poll-voters-modal-title">
            {poll.options[votersOptionIdx]}
          </div>
          <button className="poll-voters-modal-close" onClick={() => { setVotersOptionIdx(null); setVoters(null); }}>✕</button>
        </div>
        <div className="poll-voters-modal-list">
          {(voters[votersOptionIdx] || []).length === 0
            ? <div className="poll-voter-empty">{t("post.poll.noVotes")}</div>
            : (voters[votersOptionIdx] || []).map(v => (
              <div key={v.handle} className="poll-voter-row">
                <Avatar url={v.avatar_url} name={v.name} size="xs" />
                <div>
                  <Name className="poll-voter-name" name={v.name} verified={v.verified} role={v.role} nameColor={v.name_color} nameGradient={v.name_gradient} subTier={v.subscription_tier} />
                  <div className="poll-voter-handle">@{v.handle}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="poll-card">
      {votersModal}
      <div className="poll-head">
        <div className="poll-question">{poll.question}</div>
        <div className="poll-head-badges">
          {poll.anonymous && <span className="poll-anon-badge">{t("post.poll.anonymous")}</span>}
          {poll.expiresAt && remaining !== null && (
            <Tip content={isExpired ? t("post.poll.expired") : t("post.poll.expiresAt", { date: new Date(poll.expiresAt).toLocaleString(DATE_LOCALES[locale] || "ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })} pos="top">
              <span className={`poll-timer-badge${isExpired ? " expired" : ""}`}>
                <Timer size={11} />
                {formatCountdown(remaining, t)}
              </span>
            </Tip>
          )}
        </div>
      </div>
      <div className="poll-options">
        {poll.options.map((opt, i) => {
          const count = counts[i] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMyVote = userVotesArr.includes(i);
          return (
            <div key={i} className="poll-option-row-wrap">
              <button
                className={`poll-option ${hasVoted || isExpired ? "voted" : ""} ${isMyVote ? "my-vote" : ""} ${flashIdx === i ? "poll-option-flash" : ""}`}
                onClick={() => vote(i)}
                disabled={voting || isExpired || (!poll.multiChoice && hasVoted && !isMyVote)}
              >
                <div className="poll-option-bar" style={{ width: hasVoted ? `${pct}%` : "0%" }} />
                <span className="poll-option-text">{opt}</span>
                {hasVoted && <span className="poll-option-pct">{pct}%</span>}
                {isMyVote && <span className="poll-vote-mark">✓</span>}
              </button>
              {hasVoted && !poll.anonymous && count > 0 && (
                <button className="poll-voters-btn" onClick={() => showVoters(i)} title={t("post.poll.whoVoted")}>
                  <Users size={12} />
                  {count}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="poll-footer">
        <span className="poll-total">{total} {total === 1 ? t("post.poll.vote1") : total >= 2 && total <= 4 ? t("post.poll.vote2") : t("post.poll.vote5")}</span>
        {poll.multiChoice && <span className="poll-hint">{t("post.poll.multiChoice")}</span>}
        {poll.allowUnvote !== false && hasVoted && !isExpired && (
          <button className="poll-cancel-btn" onClick={cancelVote} disabled={voting}>{t("post.poll.cancelVote")}</button>
        )}
        {isMine && !isExpired && onClosePoll && (
          <button className="poll-close-btn" onClick={onClosePoll}>{t("post.poll.close")}</button>
        )}
      </div>
    </div>
  );
}

function ShareModal({ post, token, onClose }) {
  const t = useT();
  const [handle, setHandle] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const suggestTimer = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const q = handle.replace(/^@/, "").trim();
    if (!q) { setSuggestions([]); return; }
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(q)}`, { token })
        .then(rows => setSuggestions(rows.slice(0, 4)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [handle, token]);

  const postUrl = `${window.location.origin}?post=${post.id}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(postUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast(t("post.share.copyError"), { type: "error" }));
  };

  const sendToDM = async () => {
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setSending(true);
    try {
      const { convId } = await api(`/messages/open/${h}`, { method: "POST", token });
      const body = `📎 ${t("post.repost.header")} @${post.handle || post.author_handle}: ${postUrl}`;
      await api(`/messages/${convId}/send`, { method: "POST", token, body: { body } });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e) { toast(e.message || t("post.share.sendError"), { type: "error" }); }
    finally { setSending(false); }
  };

  return createPortal(
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="share-head">
          <span>{t("post.share.title")}</span>
          <button className="share-x" onClick={onClose}>✕</button>
        </div>
        <div className="share-link-row">
          <input className="share-link-input" readOnly value={postUrl} />
          <button className="share-copy-btn" onClick={copyLink}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? t("post.share.copied") : t("post.share.copy")}
          </button>
        </div>
        <div className="share-sep"><span>{t("post.share.orDm")}</span></div>
        <div className="share-dm-row" style={{ position: "relative" }}>
          <input
            className="share-dm-input"
            placeholder={t("post.share.handlePh")}
            value={handle}
            onChange={e => { setHandle(e.target.value); setSent(false); }}
            onKeyDown={e => e.key === "Enter" && sendToDM()}
          />
          <button className="share-dm-btn" onClick={sendToDM} disabled={!handle.trim() || sending || sent}>
            {sent ? <Check size={15} /> : <MessageCircle size={15} />}
            {sent ? t("post.share.sent") : sending ? "…" : t("post.share.send")}
          </button>
          {suggestions.length > 0 && !sent && (
            <div className="share-suggest-list">
              {suggestions.map(u => (
                <button key={u.handle} className="share-suggest-item" onMouseDown={e => { e.preventDefault(); setHandle(u.handle); setSuggestions([]); }}>
                  <span className="share-suggest-name">{u.name}</span>
                  <span className="share-suggest-handle">@{u.handle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Post({ post, token, me, onChange, commentBump, settings, onTag, onMention, onOpenOriginal, focusComment }) {
  const t = useT();
  const [open, setOpen] = useState(!!focusComment);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.body);
  const [editPreview, setEditPreview] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [repostText, setRepostText] = useState("");
  const [hoveredAuthor, setHoveredAuthor] = useState(null);
  const [tappedAuthor, setTappedAuthor] = useState(null);
  const [showContribs, setShowContribs] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const ref = useRef(null);
  const viewed = useRef(false);
  const lpTimer = useRef(null);
  const contribTimer = useRef(null);
  const mine = me && post.user_id === me.id;
  const isMod = me && me.role === "moderator";
  const { fieldRef: editRef, onContextMenu: editContext, formatMenu: editMenu } = useFormatMenu(setEditText);

  const INTERACTIVE = "button,a,input,textarea,select,[role=button],.toggle,.swatch,.emoji-btn,.reaction-btn";
  const openCtxAt = (x, y) => { if (me) setCtxMenu({ x, y }); };
  const onArticleCtx = (e) => {
    if (e.target.closest(INTERACTIVE)) return;
    e.preventDefault();
    openCtxAt(e.clientX, e.clientY);
  };
  const onArticleTouchStart = (e) => {
    if (e.target.closest(INTERACTIVE)) return;
    const t = e.touches?.[0];
    lpTimer.current = setTimeout(() => openCtxAt(t ? t.clientX : window.innerWidth / 2, t ? t.clientY - 50 : 200), 600);
  };
  const cancelLp = () => clearTimeout(lpTimer.current);

  // Close ctx menu on outside click (desktop only — mobile uses BottomSheet overlay)
  useEffect(() => {
    if (!ctxMenu) return;
    const h = (e) => { setCtxMenu(null); };
    document.addEventListener("mousedown", h, { once: true });
    return () => { document.removeEventListener("mousedown", h); };
}, [ctxMenu]);

  useEffect(() => {
    if (!settings.showViews || !ref.current || viewed.current) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !viewed.current) { viewed.current = true; api(`/posts/${post.id}/view`, { method: "POST", token }).catch(() => {}); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [post.id, token, settings.showViews]);

  const [commentsLocked, setCommentsLocked] = useState(!!post.comments_locked);
  const confirm = useConfirm();
  const toast = useToast();
  const confirmSafe = async (opts) => !settings.safeMode || (await confirm(opts));
  const react = async (emoji) => {
    const updated = await api(`/posts/${post.id}/react`, { method: "POST", token, body: { emoji } });
    onChange((prev) => prev.map((p) => p.id === post.id ? { ...p, reactions: updated } : p));
  };
  const saveEdit = async () => {
    if (!editText.trim()) return;
    if (!(await confirmSafe({ title: t("post.edit.confirm.title"), message: t("post.edit.confirm.msg"), okText: t("common.save") }))) return;
    onChange(await api(`/posts/${post.id}`, { method: "PATCH", token, body: { body: editText } }));
    setEditing(false); setEditPreview(false);
    toast(t("post.updated"), { type: "success" });
  };
  const del = async () => {
    const modDeleting = !mine && isMod;
    const ok = modDeleting
      ? await confirm({ title: t("post.delete.mod.title"), message: t("post.delete.mod.msg"), danger: true, okText: t("common.delete") })
      : await confirmSafe({ title: t("post.delete.confirm.title"), message: t("post.delete.confirm.msg"), danger: true, okText: t("common.delete") });
    if (!ok) return;
    setRemoving(true);
    setTimeout(async () => { try { onChange(await api(`/posts/${post.id}`, { method: "DELETE", token })); toast(t("post.deleted"), { type: "info" }); } catch { setRemoving(false); } }, 420);
  };
  const lockComments = async () => {
    const next = !commentsLocked;
    try { await api(`/posts/${post.id}/lock-comments`, { method: "PATCH", token, body: { locked: next } }); setCommentsLocked(next); toast(next ? t("post.commentsLocked") : t("post.commentsUnlocked"), { type: "info" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };
  const pinPost = async () => {
    try {
      await api(`/profile/pin/${post.id}`, { method: "POST", token });
      toast(t("post.pinned"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const doRepost = async () => {
    try { onChange(await api(`/posts/${post.id}/repost`, { method: "POST", token, body: { body: repostText } })); setReposting(false); setRepostText(""); toast(t("post.reposted"), { type: "success" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  const showContribsDelayed = () => { clearTimeout(contribTimer.current); setShowContribs(true); };
  const hideContribsDelayed = () => { contribTimer.current = setTimeout(() => { setShowContribs(false); setHoveredAuthor(null); }, 350); };

  const editMaxLen = (() => {
    if (!me) return 3000;
    if (me.role === "moderator") return 15000;
    const now = new Date().toISOString();
    const subExpired = me.subscription_expires && me.subscription_expires < now;
    const tier = (subExpired || me.subscription_canceled) ? 0 : (me.subscription_tier || 0);
    return tier === 3 ? 10000 : tier === 2 ? 7500 : tier === 1 ? 5000 : 3000;
  })();
  const editLeft = editMaxLen - editText.length;
  const isRepost = !!post.repost_of;
  const orig = post.original;

  const postTypeLabel = post.whisper ? t("post.whisperType") : post.collab ? t("post.collabType") : null;

  const collabAuthors = post.collab && post.blocks
    ? Object.values(post.blocks.reduce((acc, b) => {
        if (!acc[b.user_id]) {
          acc[b.user_id] = { ...b, firstBlockAt: b.created_at, editedByOwner: false };
        } else {
          if (b.created_at < acc[b.user_id].firstBlockAt) acc[b.user_id].firstBlockAt = b.created_at;
        }
        if (b.edited_by && b.edited_by !== b.handle) acc[b.user_id].editedByOwner = true;
        return acc;
      }, {}))
    : [];
  const bodyForReadTime = post.collab && post.blocks
    ? post.blocks.map(b => b.body).join(" ")
    : post.body;
  const bodyTooLong = settings.autoCollapse !== false && !post.collab && !isRepost && post.body && post.body.length > COLLAPSE_LEN;

  const activeAuthor = hoveredAuthor || tappedAuthor;

  const contribPopup = post.collab && collabAuthors.length > 0 && (
    <div className="collab-contrib-wrap"
      onMouseEnter={showContribsDelayed}
      onMouseLeave={hideContribsDelayed}>
      <button className="collab-contrib-btn"
        onMouseEnter={showContribsDelayed}
        onClick={() => setShowContribs(v => !v)}>
        <Users size={13} />
        <span>{collabAuthors.length}</span>
      </button>
      {showContribs && (
        <div className="collab-contrib-list pop-in"
          onMouseEnter={showContribsDelayed}
          onMouseLeave={hideContribsDelayed}>
          {collabAuthors.map(a => (
            <button key={a.user_id} className="contrib-item"
              onMouseEnter={() => setHoveredAuthor(a.user_id)}
              onMouseLeave={() => setHoveredAuthor(null)}
              title={`${t("post.collab.addedBy", { time: timeAgo(a.firstBlockAt) })}${a.editedByOwner ? t("post.collab.edited") : ""}`}
              onClick={() => {
                if (tappedAuthor === a.user_id) {
                  setTappedAuthor(null);
                  onMention && onMention(a.handle);
                } else {
                  setTappedAuthor(a.user_id);
                }
              }}>
              <span className="contrib-color-dot" style={{ background: authorColor(a.user_id) }} />
              <div className="contrib-ava" onClick={() => onMention && onMention(a.handle)}><Avatar url={a.avatar_url} name={a.name} size="xs" /></div>
              <div className="contrib-info">
                <Name name={a.name} verified={a.verified} role={a.role} nameColor={a.name_color} nameGradient={a.name_gradient} subTier={a.subscription_tier} />
                <span className="contrib-when">{timeAgo(a.firstBlockAt)}{a.editedByOwner ? t("post.collab.editedShort") : ""}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <article className={`post card rise ${removing ? "removing" : ""} ${post.whisper ? "whisper-post" : ""} ${post.collab ? "collab-post" : ""}`}
      ref={ref} data-post-type={postTypeLabel}
      onContextMenu={onArticleCtx}
      onTouchStart={onArticleTouchStart}
      onTouchEnd={cancelLp}
      onTouchMove={cancelLp}>
      {isRepost && (
        <div className="repost-head">
          <Repost />
          <div className="avatar-wrap clickable" onClick={() => onMention && onMention(post.handle)}><Avatar url={post.avatar_url} name={post.name} size="xs" /><PresenceDot online={post.online} lastSeen={post.last_seen} /></div>
          <span className="repost-by clickable" onClick={() => onMention && onMention(post.handle)}>
            <Name className="rb-name" name={post.name} verified={post.verified} role={post.role} nameColor={post.name_color} nameGradient={post.name_gradient} subTier={post.subscription_tier} />
            <span className="rb-text">{t("post.repost.header")}</span>
          </span>
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>
            <LiveTime iso={post.created_at} live={settings.liveTime} editedAt={post.edited_at} className="when" />
          </span>
        </div>
      )}
      {isRepost && post.body && <Md className="repost-comment md" onTag={onTag} onMention={onMention}>{post.body}</Md>}

      {isRepost ? (
        orig && !orig.deleted ? (
          <div className="repost-card">
            <div className="head">
              <div className="avatar-wrap clickable" onClick={() => onMention && onMention(orig.handle)}><Avatar url={orig.avatar_url} name={orig.name} size="sm" /><PresenceDot online={orig.online} lastSeen={orig.last_seen} /></div>
              <div className="head-id clickable" onClick={() => onMention && onMention(orig.handle)}>
                <Name className="name" name={orig.name} verified={orig.verified} role={orig.role} nameColor={orig.name_color} nameGradient={orig.name_gradient} subTier={orig.subscription_tier} />
                <div className="handle">@{orig.handle}</div>
              </div>
              <span style={{ marginLeft: "auto", flexShrink: 0 }}>
                <LiveTime iso={orig.created_at} live={settings.liveTime} editedAt={orig.edited_at} />
              </span>
            </div>
            {orig.body && <PostBody token={token} className="body md" onTag={onTag} onMention={onMention}>{orig.body}</PostBody>}
            <Gallery images={orig.images} />
            {onOpenOriginal && <button className="repost-open" onClick={() => onOpenOriginal(orig)}>{t("post.openOriginal")}</button>}
          </div>
        ) : (
          <div className="repost-card deleted-note"><span className="del-ico"><Trash2 size={13} /></span><span>{t("post.original.deleted")}</span></div>
        )
      ) : (
        <>
          <div className="head">
            <div className="avatar-wrap clickable" onClick={() => onMention && onMention(post.handle)}><Avatar url={post.avatar_url} name={post.name} /><PresenceDot online={post.online} lastSeen={post.last_seen} /></div>
            <div className="head-id clickable" onClick={() => onMention && onMention(post.handle)}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Name className="name" name={post.name} verified={post.verified} role={post.role} nameColor={post.name_color} nameGradient={post.name_gradient} subTier={post.subscription_tier} />
              </div>
              <div className="handle">@{post.handle}</div>
            </div>
            <div className="head-meta">
              <LiveTime iso={post.created_at} live={settings.liveTime} editedAt={post.edited_at} className="when" />
              {me && !editing && (
                <button className="post-opts-btn" onMouseDown={(e) => { e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}>⋯</button>
              )}
            </div>
          </div>
          {editing ? (
            <div className="post-editor">
              {editPreview ? (
                <div className="preview-box"><Md className="body md" onTag={onTag} onMention={onMention}>{editText || "_пусто_"}</Md></div>
              ) : (
                <MentionField ref={editRef} value={editText} onChange={setEditText} onEnter={saveEdit} onContextMenu={editContext} token={token} maxLength={editMaxLen} placeholder={t("post.editor.placeholder")} />
              )}
              <div className="post-editor-bar">
                <span className={`count ${editLeft < 30 ? "warn" : ""}`}>{editLeft}</span>
                <div className="edit-actions">
                  <button className="btn ghost" onClick={() => setEditPreview((v) => !v)}>{editPreview ? t("post.editor.edit") : t("post.editor.preview")}</button>
                  <button className="btn ghost" onClick={() => { setEditing(false); setEditText(post.body); setEditPreview(false); }}>{t("post.ctx.cancel")}</button>
                  <button className="btn accent" onClick={saveEdit} disabled={!editText.trim()}>{t("common.save")}</button>
                </div>
              </div>
              {editMenu}
            </div>
          ) : (
            <>
              {post.collab && post.blocks ? (
                <div className="collab-flow">
                  {post.published ? (
                    <div className="cp-unified-text">
                      {post.blocks.map(bl => (
                        <div key={bl.id}
                          className={`cp-block-unit ${activeAuthor === bl.user_id ? "cp-block-active" : ""}`}
                          style={{
                            background: activeAuthor === bl.user_id ? authorColor(bl.user_id) + "22" : undefined,
                            borderLeft: (bl.edited_by && bl.edited_by !== bl.handle) ? `3px solid ${authorColor(post.user_id)}44` : undefined,
                            paddingLeft: (bl.edited_by && bl.edited_by !== bl.handle) ? 8 : undefined,
                            transition: "background 0.2s",
                          }}
                        >
                          <Md className="cb-text md" onTag={onTag} onMention={onMention}>{bl.body}</Md>
                        </div>
                      ))}
                    </div>
                  ) : post.blocks.map((bl) => (
                    <div key={bl.id} className={`collab-para ${activeAuthor === bl.user_id ? "contrib-hl" : ""}`}>
                      <Md className="cb-text md" onTag={onTag} onMention={onMention}>{bl.body}</Md>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {bodyTooLong && !expanded ? (
                    <>
                      <div className="body-collapse-inner">
                        <PostBody className="body md" token={token} onTag={onTag} onMention={onMention}>{post.body}</PostBody>
                      </div>
                      <button className="read-more" onClick={() => setExpanded(true)}>{t("post.readMore")}</button>
                    </>
                  ) : (
                    post.body && <PostBody className="body md" token={token} onTag={onTag} onMention={onMention}>{post.body}</PostBody>
                  )}
                </>
              )}
              {post.poll && (
                <PollCard poll={post.poll} pollVotes={post.pollVotes} postId={post.id} token={token}
                  isMine={mine} onClosePoll={mine && post.poll?.expiresAt ? async () => {
                    try { await api(`/posts/${post.id}/poll/close`, { method: "POST", token }); }
                    catch (e) { console.error(e); }
                  } : undefined} />
              )}
              <Gallery images={post.images} />
            </>
          )}
        </>
      )}

      {reposting && (
        <div className="repost-compose">
          <MentionField value={repostText} onChange={setRepostText} token={token} maxLength={280} placeholder={t("post.repost.placeholder")} />
          <div className="edit-actions">
            <button className="btn ghost" onClick={() => { setReposting(false); setRepostText(""); }}>{t("post.ctx.cancel")}</button>
            <button className="btn accent" onClick={doRepost}>{t("post.repost.btn")}</button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="actions">
          {settings.allowReactions && <ReactionBar reactions={post.reactions} onReact={react} />}
          {settings.allowComments && (
            <Tip content={t("post.tip.comments")} pos="top">
              <button className={`act ${open ? "active" : ""}`} onClick={() => setOpen(!open)}><Bubble /> {post.comments || ""}</button>
            </Tip>
          )}
          {!isRepost && <Tip content={t("post.tip.repost")} pos="top"><button className="act" onClick={() => setReposting((v) => !v)}><Repost /></button></Tip>}
          {settings.showReadTime !== false && !isRepost && bodyForReadTime?.trim() && (
            <Tip content={t("post.tip.readTime", { t: readTime(bodyForReadTime, post.images?.length || 0) })} pos="top"><span className="act read-time"><Clock /></span></Tip>
          )}
          <span className="act-spacer" />
          {settings.showViews && <Tip content={t("post.tip.views")} pos="top"><span className="act views"><Eye /> {post.views || 0}</span></Tip>}
          {contribPopup}
        </div>
      )}
      {settings.allowComments && (
        <div className={`comments-wrap ${open ? "open" : ""}`}>
          {open && <Comments postId={post.id} token={token} me={me} settings={settings} bump={commentBump} onTag={onTag} onMention={onMention} focusComment={focusComment} commentsLocked={commentsLocked} isMod={isMod} />}
        </div>
      )}
      {reporting && <ReportDialog targetType="post" targetId={post.id} token={token} onClose={() => setReporting(false)} />}
      {sharing && <ShareModal post={post} token={token} onClose={() => setSharing(false)} />}
      {ctxMenu && createPortal(
        <BottomSheet onClose={() => setCtxMenu(null)}>
          {mine && !isRepost && <button onClick={() => { setCtxMenu(null); setEditing(true); }}><EditIcon /> {t("post.ctx.edit")}</button>}
          {mine && !isRepost && <button onClick={() => { setCtxMenu(null); pinPost(); }}>
            <Pin size={13} />
            {t("post.ctx.pin")}
          </button>}
          <button onClick={() => { setCtxMenu(null); setSharing(true); }}>
            <Share2 size={13} />
            {t("post.ctx.share")}
          </button>
          {mine && <button className="danger" onClick={() => { setCtxMenu(null); del(); }}><TrashIcon /> {t("post.ctx.delete")}</button>}
          {!mine && isMod && <button className="danger" onClick={() => { setCtxMenu(null); del(); }}><ModTrashIcon /> {t("post.ctx.deleteMod")}</button>}
          {isMod && <button onClick={() => { setCtxMenu(null); lockComments(); }}>
            {commentsLocked ? <LockOpen size={13} /> : <Lock size={13} />}
            {commentsLocked ? t("post.ctx.unlockComments") : t("post.ctx.lockComments")}
          </button>}
          {!mine && <button onClick={() => { setCtxMenu(null); setReporting(true); }}><FlagIcon /> {t("post.ctx.report")}</button>}
          <button className="post-ctx-cancel" onClick={() => setCtxMenu(null)}>{t("post.ctx.cancel")}</button>
        </BottomSheet>,
        document.body
      )}
    </article>
  );
}
