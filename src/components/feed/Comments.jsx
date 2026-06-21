import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api.js";
import { LiveTime, Avatar, Name, PresenceDot, EditIcon, TrashIcon, ModTrashIcon, FlagIcon } from "../shared/icons.jsx";
import Tip from "../shared/Tip.jsx";
import ReportDialog from "./ReportDialog.jsx";
import Md from "../shared/Markdown.jsx";
import PostBody from "../shared/PostBody.jsx";
import ReactionBar from "./ReactionBar.jsx";
import MentionField from "../composer/MentionField.jsx";
import { useFormatMenu } from "../composer/FormatMenu.jsx";
import { useConfirm, useToast } from "../shared/ui.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

function CommentPoll({ node, pollVotes: initialVotes, token, onTree, postId }) {
  const t = useT();
  const [votes, setVotes] = useState(initialVotes);
  const poll = node.poll;
  if (!poll) return null;

  const vote = async (idx) => {
    try {
      const res = await api(`/comments/${node.id}/vote`, { method: "POST", token, body: { optionIdx: idx } });
      setVotes(res);
    } catch {}
  };

  const total = votes?.total || 0;
  const myVote = votes?.myVote ?? null;

  const pluralVote = (n) => n === 1 ? t("comment.vote1") : n < 5 ? t("comment.vote2") : t("comment.vote5");

  return (
    <div className="cpoll">
      <div className="cpoll-q">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ flexShrink: 0 }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        {poll.question}
      </div>
      {poll.options.map((opt, i) => {
        const count = votes?.counts?.[i] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMyVote = myVote === i;
        return (
          <button key={i} className={`cpoll-opt${isMyVote ? " my-vote" : ""}`} onClick={() => token && vote(i)}>
            <div className="cpoll-bar" style={{ width: `${pct}%` }} />
            <span className="cpoll-text">{opt}</span>
            <span className="cpoll-pct">{pct}%</span>
          </button>
        );
      })}
      <div className="cpoll-total">{total} {pluralVote(total)}</div>
    </div>
  );
}

const MAX_INDENT = 3;
const COLLAPSE_AFTER = 3;

const REPLY_BATCH = 2;

function Comment({ node, postId, token, me, settings, onTree, onTag, onMention, depth = 0, parent = null }) {
  const t = useT();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [editText, setEditText] = useState(node.body);
  const [visibleCount, setVisibleCount] = useState(depth < 2 ? REPLY_BATCH : 0);
  const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false);
  useEffect(() => { if (node.deleted && removing) setRemoving(false); }, [node.deleted]);
  const mineComment = me && node.user_id === me.id && !node.deleted;
  const isMod = me && me.role === "moderator";
  const { fieldRef: editFieldRef, onContextMenu: editCtx, onTouchStart: editTS, onTouchEnd: editTE, onTouchMove: editTM, formatMenu: editMenu } = useFormatMenu(setEditText);
  const replyFmt = useFormatMenu(setText);
  const confirm = useConfirm();
  const toast = useToast();
  const confirmSafe = async (opts) => !settings.safeMode || (await confirm(opts));

  const react = async (emoji) => onTree(await api(`/comments/${node.id}/react`, { method: "POST", token, body: { emoji } }));
  const sendReply = async () => {
    if (!text.trim()) return;
    try {
      onTree(await api(`/posts/${postId}/comments`, { method: "POST", token, body: { body: text, parentId: node.id } }));
      setText(""); setReplying(false); setVisibleCount(v => Math.max(v, REPLY_BATCH));
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };
  const saveEdit = async () => {
    if (!editText.trim()) return;
    if (!(await confirmSafe({ title: t("comment.save.title"), message: t("comment.save.msg"), okText: t("common.save") }))) return;
    onTree(await api(`/comments/${node.id}`, { method: "PATCH", token, body: { body: editText } }));
    setEditing(false);
  };
  const del = async () => {
    const modDeleting = !mineComment && isMod;
    const ok = modDeleting
      ? await confirm({ title: t("comment.delete.mod.title"), message: t("comment.delete.mod.msg"), danger: true, okText: t("common.delete") })
      : await confirmSafe({ title: t("comment.delete.title"), message: t("comment.delete.msg"), danger: true, okText: t("common.delete") });
    if (!ok) return;
    setRemoving(true);
    setTimeout(async () => { try { onTree(await api(`/comments/${node.id}`, { method: "DELETE", token })); toast(t("comment.deletedToast"), { type: "info" }); } catch { setRemoving(false); } }, 360);
  };
  const indent = depth > 0 && depth <= MAX_INDENT;
  const replies = node.replies || [];
  const allCollapsed = visibleCount === 0 && replies.length > 0;
  const visibleReplies = replies.slice(0, visibleCount);
  const hasMore = visibleCount > 0 && visibleCount < replies.length;

  return (
    <div id={`comment-${node.id}`} className={`comment slide-in ${indent ? "nested" : ""} ${node.deleted ? "is-deleted" : ""} ${removing ? "removing" : ""}`}>
      {node.deleted ? (
        <div className="deleted-note">
          <span className="del-ico" aria-hidden="true">🗑</span>
          <span>{replies.length > 0 ? t("comment.deletedReplies") : t("comment.deleted")}</span>
        </div>
      ) : (
        <div className="comment-main">
          <div className="avatar-wrap clickable" onClick={() => onMention && onMention(node.handle)}><Avatar url={node.avatar_url} name={node.name} /><PresenceDot online={node.online} lastSeen={node.last_seen} /></div>
          <div className="c-body">
            <div className="c-top">
              <span className="clickable" onClick={() => onMention && onMention(node.handle)}><Name className="c-name" name={node.name} verified={node.verified} role={node.role} nameColor={node.name_color} nameGradient={node.name_gradient} subTier={node.subscription_tier} /></span>
              <span className="h">@{node.handle}</span>
              {parent && depth > MAX_INDENT && <span className="reply-to">→ @{parent.handle}</span>}
              <LiveTime iso={node.created_at} live={settings.liveTime} editedAt={node.edited_at} className="c-when" />
            </div>
            {editing ? (
              <div className="edit-box">
                <MentionField ref={editFieldRef} value={editText} onChange={setEditText} onEnter={saveEdit} onContextMenu={editCtx} onTouchStart={editTS} onTouchEnd={editTE} onTouchMove={editTM} token={token} placeholder={t("comment.edit.placeholder")} />
                <div className="edit-row">
                  <button className="btn ghost" onClick={() => { setEditing(false); setEditText(node.body); }}>{t("common.cancel")}</button>
                  <button className="btn accent" onClick={saveEdit} disabled={!editText.trim()}>{t("common.save")}</button>
                </div>
                {editMenu}
              </div>
            ) : (<PostBody className="md" token={token} onTag={onTag} onMention={onMention}>{node.body}</PostBody>)}
            {!editing && node.poll && <CommentPoll node={node} pollVotes={node.pollVotes} token={token} onTree={onTree} postId={postId} />}
            {!editing && (
              <div className="c-actions">
                {settings.allowReactions && <ReactionBar reactions={node.reactions} onReact={react} compact />}
                <button className="c-act" onClick={() => setReplying(!replying)}>{t("comment.reply")}</button>
                {mineComment && <Tip content={t("comment.tip.edit")} pos="top"><button className="c-act icon-act" onClick={() => setEditing(true)}><EditIcon /></button></Tip>}
                {mineComment && <Tip content={t("comment.tip.delete")} pos="top"><button className="c-act icon-act danger" onClick={del}><TrashIcon /></button></Tip>}
                {!mineComment && isMod && !node.deleted && <Tip content={t("comment.tip.deleteMod")} pos="top"><button className="c-act icon-act mod-act" onClick={del}><ModTrashIcon /></button></Tip>}
                {!mineComment && !node.deleted && <Tip content={t("comment.tip.report")} pos="top"><button className="c-act icon-act report-act" onClick={() => setReporting(true)}><FlagIcon /></button></Tip>}
              </div>
            )}
          </div>
        </div>
      )}
      {replying && (
        <div className="reply-form">
          <MentionField ref={replyFmt.fieldRef} value={text} onChange={setText} onEnter={sendReply} onContextMenu={replyFmt.onContextMenu} onTouchStart={replyFmt.onTouchStart} onTouchEnd={replyFmt.onTouchEnd} onTouchMove={replyFmt.onTouchMove} token={token} placeholder={t("comment.reply.placeholder", { name: node.name })} minRows={2} hint={t("comment.hint")} />
          <button className="btn ghost send" onClick={sendReply}>↑</button>
          {replyFmt.formatMenu}
        </div>
      )}
      {allCollapsed && <button className="show-replies" onClick={() => setVisibleCount(REPLY_BATCH)}>{t("comment.showReplies", { n: replies.length })}</button>}
      {!allCollapsed && replies.length > 0 && (
        <div className={`replies ${depth >= MAX_INDENT ? "flat" : ""}`}>
          {visibleReplies.map((child) => (<Comment key={child.id} node={child} postId={postId} token={token} me={me} settings={settings} onTree={onTree} onTag={onTag} onMention={onMention} depth={depth + 1} parent={node} />))}
          {hasMore && <button className="show-replies" onClick={() => setVisibleCount(v => v + REPLY_BATCH)}>{t("comment.moreReplies", { n: replies.length - visibleCount })}</button>}
          {!hasMore && depth < 1 && replies.length >= COLLAPSE_AFTER && <button className="show-replies" onClick={() => setVisibleCount(0)}>{t("comment.collapse")}</button>}
        </div>
      )}
      {reporting && <ReportDialog targetType="comment" targetId={node.id} token={token} onClose={() => setReporting(false)} />}
    </div>
  );
}

export default function Comments({ postId, token, me, settings, bump, onTag, onMention, focusComment, commentsLocked, isMod }) {
  const t = useT();
  const [tree, setTree] = useState(null);
  const [text, setText] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [showCPoll, setShowCPoll] = useState(false);
  const [cpollQ, setCpollQ] = useState("");
  const [cpollOpts, setCpollOpts] = useState(["", ""]);
  const composeFmt = useFormatMenu(setText);
  const toast = useToast();
  const load = useCallback(() => { api(`/posts/${postId}/comments`, { token }).then(setTree).catch(() => setTree([])); }, [postId, token]);
  useEffect(() => { load(); }, [load, bump]);

  const buildCPoll = () => {
    if (!showCPoll || !cpollQ.trim()) return undefined;
    const opts = cpollOpts.filter(o => o.trim());
    if (opts.length < 2) return undefined;
    return { question: cpollQ.trim(), options: opts };
  };

  const send = async () => {
    if (!text.trim()) return;
    setSendErr("");
    try {
      setTree(await api(`/posts/${postId}/comments`, { method: "POST", token, body: { body: text, poll: buildCPoll() } }));
      setText(""); setShowCPoll(false); setCpollQ(""); setCpollOpts(["", ""]);
    } catch (e) {
      setSendErr(e.message);
      toast(e.message, { type: "error" });
    }
  };

  useEffect(() => {
    if (!focusComment || tree === null) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${focusComment}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("comment-flash");
        setTimeout(() => el.classList.remove("comment-flash"), 2000);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [focusComment, tree]);

  if (tree === null) return null;
  return (
    <div className="comments fade-in">
      {tree.map((node) => (<Comment key={node.id} node={node} postId={postId} token={token} me={me} settings={settings} onTree={setTree} onTag={onTag} onMention={onMention} />))}
      {commentsLocked && <div className="comment-blocked-msg"><span className="cb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span>{t("comment.locked")}{isMod ? ` ${t("comment.lockedMod")}` : ""}</span></div>}
      {me && (!commentsLocked || isMod) && (
        <div className="comment-form-wrap">
          {sendErr && <div className="comment-blocked-msg"><span className="cb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span><span>{sendErr}</span></div>}
          <div className="comment-form">
            <MentionField ref={composeFmt.fieldRef} value={text} onChange={(v) => { setText(v); setSendErr(""); }} onEnter={send} onContextMenu={composeFmt.onContextMenu} onTouchStart={composeFmt.onTouchStart} onTouchEnd={composeFmt.onTouchEnd} onTouchMove={composeFmt.onTouchMove} token={token} placeholder={t("comment.compose.placeholder")} minRows={2} hint={t("comment.compose.hint")} />
            <div className="comment-form-actions">
              <button className={`c-act${showCPoll ? " on" : ""}`} title={t("comment.addPoll")} onClick={() => setShowCPoll(v => !v)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </button>
              <button className="btn ghost send" onClick={send}>↑</button>
            </div>
          </div>
          {showCPoll && (
            <div className="cpoll-compose">
              <input className="cpoll-q-input" placeholder={t("comment.poll.question")} value={cpollQ} onChange={e => setCpollQ(e.target.value)} maxLength={200} />
              {cpollOpts.map((opt, i) => (
                <div key={i} className="cpoll-opt-row">
                  <input className="cpoll-opt-input" placeholder={t("comment.poll.option", { n: i + 1 })} value={opt}
                    onChange={e => { const n = [...cpollOpts]; n[i] = e.target.value; setCpollOpts(n); }} maxLength={100} />
                  {cpollOpts.length > 2 && <button className="cpoll-rm" onClick={() => setCpollOpts(cpollOpts.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              {cpollOpts.length < 4 && <button className="btn ghost" style={{ fontSize: 12, padding: "4px 10px", alignSelf: "flex-start" }} onClick={() => setCpollOpts([...cpollOpts, ""])}>{t("comment.poll.addOption")}</button>}
            </div>
          )}
          {composeFmt.formatMenu}
        </div>
      )}
    </div>
  );
}
