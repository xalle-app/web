import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { UsersRound, MoreHorizontal, Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Pencil, GitCompare } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { timeAgo } from "../../lib/format.js";
import { Avatar, Name, TrashIcon, EditIcon } from "../shared/icons.jsx";
import Tip from "../shared/Tip.jsx";
import Md from "../shared/Markdown.jsx";
import MentionField from "../composer/MentionField.jsx";
import { useFormatMenu } from "../composer/FormatMenu.jsx";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { HeroHeader } from "../shared/HeroHeader.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

const BLOCK_MAX = 10000;
const AUTHORS_PALETTE = ["#a78bfa","#60a5fa","#34d399","#fb923c","#f472b6","#38bdf8","#a3e635","#fbbf24","#e879f9","#4ade80"];

function ruPlural(n, t, key1, key24, keyN) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t(keyN);
  if (mod10 === 1) return t(key1);
  if (mod10 >= 2 && mod10 <= 4) return t(key24);
  return t(keyN);
}

// ─── Simple word-level diff ──────────────────────────────────────
function computeDiff(before, after) {
  const bWords = before.split(/(\s+)/);
  const aWords = after.split(/(\s+)/);
  const result = [];
  let bi = 0, ai = 0;
  while (bi < bWords.length || ai < aWords.length) {
    if (bi < bWords.length && ai < aWords.length && bWords[bi] === aWords[ai]) {
      result.push({ type: "eq", text: bWords[bi] }); bi++; ai++;
    } else if (ai < aWords.length && (bi >= bWords.length || !bWords.slice(bi, bi + 3).includes(aWords[ai]))) {
      result.push({ type: "add", text: aWords[ai] }); ai++;
    } else if (bi < bWords.length) {
      result.push({ type: "del", text: bWords[bi] }); bi++;
    } else { break; }
  }
  return result;
}

function DiffView({ before, after }) {
  const t = useT();
  const diff = computeDiff(before, after);
  return (
    <div className="cb-diff">
      <div className="cb-diff-label">
        <span className="cb-diff-old">{t("collab.diff.before")}</span>
        <span className="cb-diff-arrow">→</span>
        <span className="cb-diff-new">{t("collab.diff.after")}</span>
      </div>
      <div className="cb-diff-text">
        {diff.map((chunk, i) => (
          chunk.type === "eq" ? <span key={i}>{chunk.text}</span>
          : chunk.type === "add" ? <mark key={i} className="cb-diff-add">{chunk.text}</mark>
          : <del key={i} className="cb-diff-del">{chunk.text}</del>
        ))}
      </div>
    </div>
  );
}

// ─── Collab head actions menu (mobile 3-dot / desktop inline) ───
function CollabHeadActions({ preview, setPreview, isOwner, isMod, collabOpen, toggleOpen, deletePost }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const btnRef = useRef(null);

  const openMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setCoords({ x: r.right, y: r.bottom + 6 });
    setOpen(true);
  };

  const menuItems = [
    { icon: preview ? <EyeOff size={14}/> : <Eye size={14}/>, label: preview ? t("collab.editor") : t("collab.preview"), action: () => setPreview(v => !v) },
    ...(isOwner ? [{
      icon: collabOpen ? <Lock size={14}/> : <Unlock size={14}/>,
      label: collabOpen ? t("collab.close.btn") : t("collab.open.btn"),
      action: toggleOpen,
    }] : []),
    ...((isOwner || isMod) ? [{ icon: <Trash2 size={14}/>, label: t("collab.delete.btn"), danger: true, action: deletePost }] : []),
  ];

  return (
    <>
      {/* Desktop: inline buttons */}
      <div className="cc-head-actions cc-head-actions-desktop">
        <button className="btn ghost cc-mode-btn" onClick={() => setPreview(v => !v)}>
          {preview ? <EyeOff size={14}/> : <Eye size={14}/>} {preview ? t("collab.editor") : t("collab.preview")}
        </button>
        {isOwner && (
          <button className={`btn ghost cc-mode-btn ${!collabOpen ? "cc-closed" : ""}`} onClick={toggleOpen}>
            {collabOpen ? <Unlock size={14}/> : <Lock size={14}/>}
            {collabOpen ? t("collab.open.status") : t("collab.closed.status")}
          </button>
        )}
        {(isOwner || isMod) && (
          <button className="c-act icon-act danger" onClick={deletePost} title={t("collab.delete.btn")}><TrashIcon /></button>
        )}
      </div>

      {/* Mobile: single 3-dot button */}
      <div className="cc-head-actions cc-head-actions-mobile">
        <button className="c-act icon-act cc-dots-btn" onClick={openMenu} ref={btnRef} title={t("collab.actions")}>
          <MoreHorizontal size={16}/>
        </button>
      </div>

      {/* Portal menu */}
      {open && createPortal(
        <>
          <div className="cc-menu-overlay" onClick={() => setOpen(false)} />
          <div className="cc-menu" style={{ position: "fixed", right: `calc(100vw - ${coords.x}px)`, top: coords.y, zIndex: 9999 }}>
            {menuItems.map((item, i) => (
              <button key={i} className={`cc-menu-item ${item.danger ? "cc-menu-danger" : ""}`}
                onClick={() => { item.action(); setOpen(false); }}>
                {item.icon}{item.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function CollabDraft({ draft, me, token, onChanged, onTag, onMention }) {
  const t = useT();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [blocks, setBlocks] = useState(draft.blocks || []);
  const [editBlockId, setEditBlockId] = useState(null);
  const [editText, setEditText] = useState("");
  const [preview, setPreview] = useState(false);
  const [collabOpen, setCollabOpen] = useState(draft.collab_open !== false);
  const [showDiff, setShowDiff] = useState({});
  useEffect(() => { setBlocks(draft.blocks || []); }, [draft.blocks]);
  const fmt = useFormatMenu(setText);
  const editFmt = useFormatMenu(setEditText);
  const toast = useToast();
  const confirm = useConfirm();
  const isOwner = me?.id === draft.user_id;
  const isMod = me?.role === "moderator";
  const canEdit = (bl) => isOwner || me?.handle === bl.handle;

  const deletePost = async () => {
    if (!(await confirm({ title: t("collab.delete.confirm.title"), message: t("collab.delete.confirm.msg"), danger: true, okText: t("common.delete") }))) return;
    try {
      await api(`/posts/${draft.id}`, { method: "DELETE", token });
      toast(t("collab.delete.toast"), { type: "info" });
      onChanged?.();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const addBlock = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const r = await api(`/posts/${draft.id}/block`, { method: "POST", token, body: { body: text } });
      setBlocks(r.blocks); setText("");
      toast(t("collab.block.added.toast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setAdding(false); }
  };

  const delBlock = async (blockId) => {
    if (!(await confirm({ title: t("collab.block.delete.confirm.title"), message: t("collab.block.delete.confirm.msg"), danger: true, okText: t("common.delete") }))) return;
    try {
      const r = await api(`/posts/${draft.id}/blocks/${blockId}`, { method: "DELETE", token });
      setBlocks(r.blocks);
      toast(t("collab.block.deleted.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const startEdit = (bl) => { setEditBlockId(bl.id); setEditText(bl.body); };
  const cancelEdit = () => { setEditBlockId(null); setEditText(""); };
  const saveEdit = async (blockId) => {
    if (!editText.trim()) return;
    try {
      const r = await api(`/posts/${draft.id}/blocks/${blockId}`, { method: "PATCH", token, body: { body: editText } });
      setBlocks(r.blocks); cancelEdit();
      toast(t("collab.block.updated.toast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const moveBlock = async (blockId, dir) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setBlocks(reordered);
    try {
      const r = await api(`/posts/${draft.id}/blocks/reorder`, { method: "PATCH", token, body: { blockIds: reordered.map(b => b.id) } });
      setBlocks(r.blocks);
    } catch (e) { toast(e.message, { type: "error" }); setBlocks(blocks); }
  };

  const toggleOpen = async () => {
    const next = !collabOpen;
    setCollabOpen(next);
    try {
      await api(`/posts/${draft.id}/collab-mode`, { method: "PATCH", token, body: { open: next } });
      toast(next ? t("collab.opened.toast") : t("collab.closed.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); setCollabOpen(!next); }
  };

  const publish = async () => {
    if (!(await confirm({ title: t("collab.publish.confirm.title"), message: t("collab.publish.confirm.msg"), okText: t("collab.publish.btn") }))) return;
    try {
      await api(`/posts/${draft.id}/publish`, { method: "POST", token });
      toast(t("collab.publish.toast"), { type: "success" });
      onChanged?.();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const authorColorMap = {};
  blocks.forEach(bl => {
    if (!authorColorMap[bl.handle]) {
      authorColorMap[bl.handle] = AUTHORS_PALETTE[Object.keys(authorColorMap).length % AUTHORS_PALETTE.length];
    }
  });

  const contributors = [];
  const seen = new Set();
  blocks.forEach(bl => {
    if (!seen.has(bl.handle)) { seen.add(bl.handle); contributors.push(bl); }
  });
  if (!seen.has(draft.handle)) contributors.unshift(draft);

  const remaining = BLOCK_MAX - text.length;

  return (
    <div className="collab-card card">
      {/* Header */}
      <div className="cc-head">
        <div className="cc-ava clickable" onClick={() => onMention?.(draft.handle)}>
          <Avatar url={draft.avatar_url} name={draft.name} />
        </div>
        <div className="cc-headinfo">
          <div className="cc-author">
            <Name name={draft.name} verified={draft.verified} role={draft.role} nameColor={draft.name_color} nameGradient={draft.name_gradient} subTier={draft.subscription_tier} />
            <span className="cc-sub">{t("collab.founded")}</span>
          </div>
          <div className="cc-sub cc-meta-row">
            <span>{timeAgo(draft.created_at)}</span>
            <span className="cc-dot">·</span>
            <span>{blocks.length} {ruPlural(blocks.length, t, "collab.block.1", "collab.block.24", "collab.block.n")}</span>
            <span className="cc-dot">·</span>
            <span>{contributors.length} {ruPlural(contributors.length, t, "collab.author.1", "collab.author.24", "collab.author.n")}</span>
            <span className={`cc-status-badge ${collabOpen ? "open" : "closed"}`}>{collabOpen ? t("collab.status.open") : t("collab.status.closed")}</span>
          </div>
        </div>
        <CollabHeadActions
          preview={preview} setPreview={setPreview}
          isOwner={isOwner} isMod={isMod}
          collabOpen={collabOpen} toggleOpen={toggleOpen}
          deletePost={deletePost}
        />
      </div>

      {/* Contributors */}
      {contributors.length > 0 && (
        <div className="cc-contributors">
          <span className="cc-contrib-label">{t("collab.authors.label")}</span>
          <div className="cc-contrib-avatars">
            {contributors.map(c => (
              <Tip key={c.handle} content={`@${c.handle}`} pos="top">
                <div className="cc-contrib-av"
                  style={{ borderColor: authorColorMap[c.handle] || "var(--line)" }}
                  onClick={() => onMention?.(c.handle)}>
                  <Avatar url={c.avatar_url} name={c.name} size="xs" />
                </div>
              </Tip>
            ))}
          </div>
        </div>
      )}

      {/* Preview or blocks */}
      {preview ? (
        <div className="cc-preview">
          <div className="cc-preview-label">{t("collab.preview.label")}</div>
          <div className="collab-flow">
            {blocks.map(bl => (
              <div key={bl.id} className="collab-para">
                <Md className="cb-text md" onTag={onTag} onMention={onMention}>{bl.body}</Md>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="collab-blocks">
          {blocks.length === 0 && (
            <div className="cc-empty-blocks">{t("collab.blocks.empty")}</div>
          )}
          {blocks.map((bl, idx) => {
            const authorColor = authorColorMap[bl.handle] || "var(--accent)";
            const isDiffOpen = showDiff[bl.id];
            const editRemaining = BLOCK_MAX - editText.length;
            return (
              <div key={bl.id} className="collab-block" style={{ "--cb-color": authorColor }}>
                <div className="cb-block-head">
                  <div className="cb-author clickable" onClick={() => onMention?.(bl.handle)}>
                    <div className="cb-ava"><Avatar url={bl.avatar_url} name={bl.name} size="xs" /></div>
                    <Name className="cb-name" name={bl.name} verified={bl.verified} role={bl.role} nameColor={bl.name_color} nameGradient={bl.name_gradient} subTier={bl.subscription_tier} />
                    <span className="cb-block-num">#{idx + 1}</span>
                  </div>
                  <div className="cb-block-acts">
                    {bl.prev_body && (
                      <Tip content={isDiffOpen ? t("collab.diff.hide") : t("collab.diff.show")} pos="top">
                        <button className={`c-act icon-act ${isDiffOpen ? "cb-diff-active" : ""}`}
                          onClick={() => setShowDiff(p => ({ ...p, [bl.id]: !p[bl.id] }))}>
                          <GitCompare size={13}/>
                        </button>
                      </Tip>
                    )}
                    {isOwner && (
                      <>
                        <button className="c-act icon-act" onClick={() => moveBlock(bl.id, -1)} disabled={idx === 0} title={t("collab.move.up")}><ChevronUp size={13}/></button>
                        <button className="c-act icon-act" onClick={() => moveBlock(bl.id, 1)} disabled={idx === blocks.length - 1} title={t("collab.move.down")}><ChevronDown size={13}/></button>
                      </>
                    )}
                    {canEdit(bl) && editBlockId !== bl.id && (
                      <button className="c-act icon-act" onClick={() => startEdit(bl)} title={t("common.edit")}><Pencil size={13}/></button>
                    )}
                    {(isOwner || me?.handle === bl.handle) && (
                      <button className="c-act icon-act danger cb-del" onClick={() => delBlock(bl.id)} title={t("common.delete")}><TrashIcon /></button>
                    )}
                  </div>
                </div>

                {editBlockId === bl.id ? (
                  <div className="cb-edit">
                    <MentionField ref={editFmt.fieldRef} value={editText} onChange={setEditText}
                      onContextMenu={editFmt.onContextMenu} token={token}
                      maxLength={BLOCK_MAX} minRows={2} placeholder={t("collab.block.edit.placeholder")} />
                    <div className="cb-edit-bar">
                      <span className={`count ${editRemaining < 100 ? "warn" : ""}`}>{editRemaining}</span>
                      <button className="btn ghost" onClick={cancelEdit}>{t("common.cancel")}</button>
                      <button className="btn accent" onClick={() => saveEdit(bl.id)} disabled={!editText.trim()}>{t("common.save")}</button>
                    </div>
                    {editFmt.formatMenu}
                  </div>
                ) : (
                  <>
                    <Md className="cb-text md" onTag={onTag} onMention={onMention}>{bl.body}</Md>
                    {bl.edited_by && bl.edited_by !== bl.handle && (
                      <div className="cb-edited-by">
                        <Pencil size={11}/>
                        <span>{t("collab.block.edited.by", { handle: bl.edited_by })}</span>
                      </div>
                    )}
                    {isDiffOpen && bl.prev_body && (
                      <DiffView before={bl.prev_body} after={bl.body} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add block */}
      {!preview && (
        <div className={`cc-add ${!collabOpen && !isOwner ? "cc-add-disabled" : ""}`}>
          {!collabOpen && !isOwner ? (
            <div className="cc-closed-notice">
              <Lock size={14}/> <span>{t("collab.closed.notice")}</span>
            </div>
          ) : (
            <>
              <div className="cc-add-label">
                {me?.avatar_url
                  ? <img src={assetUrl(me.avatar_url)} className="cc-add-av" alt="" />
                  : <div className="cc-add-av cc-add-av-letter">{(me?.name || "?")[0]}</div>
                }
                <span>{t("collab.add.label")}</span>
              </div>
              <MentionField ref={fmt.fieldRef} value={text} onChange={setText}
                onEnter={addBlock} onContextMenu={fmt.onContextMenu}
                onTouchStart={fmt.onTouchStart} onTouchEnd={fmt.onTouchEnd} onTouchMove={fmt.onTouchMove}
                token={token} maxLength={BLOCK_MAX} minRows={2}
                placeholder={t("collab.add.placeholder")}
                hint={t("collab.add.hint")} />
              <div className="cc-add-actions">
                <span className={`count ${remaining < 100 ? "warn" : ""}`}
                  style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-faint)", marginRight: "auto" }}>
                  {remaining}
                </span>
                <button className="btn ghost" onClick={addBlock} disabled={adding || !text.trim()}>
                  {adding ? t("collab.block.adding") : t("collab.block.add.btn")}
                </button>
                {isOwner && <button className="btn accent" onClick={publish}>{t("collab.publish.btn")}</button>}
              </div>
              {fmt.formatMenu}
            </>
          )}
        </div>
      )}
      {isOwner && preview && (
        <div className="cc-add-actions" style={{ marginTop: 8 }}>
          <button className="btn accent" onClick={publish}>{t("collab.publish.btn")}</button>
        </div>
      )}
    </div>
  );
}

export default function CollabPanel({ token, me, bump, onTag, onMention, highlightId }) {
  const t = useT();
  const [drafts, setDrafts] = useState(null);
  const highlightRefs = useRef({});

  const load = useCallback(() => {
    api("/collabs", { token }).then(setDrafts).catch(() => setDrafts([]));
  }, [token]);
  useEffect(() => { load(); }, [load, bump]);

  useEffect(() => {
    if (highlightId && highlightRefs.current[highlightId]) {
      highlightRefs.current[highlightId].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, drafts]);

  return (
    <div className="screen collab-screen">
      <HeroHeader
        icon={<UsersRound size={32} />}
        title={t("collab.title")}
        subtitle={t("collab.subtitle")}
      />
      {drafts === null ? (
        <div className="empty">{t("common.loading")}</div>
      ) : drafts.length === 0 ? (
        <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 16px" }}>
          <div style={{ fontSize: 36 }}>✍️</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t("collab.empty.title")}</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center" }}>
            {t("collab.empty.hint")}
          </div>
        </div>
      ) : (
        <div className="collab-list">
          {drafts.map((d) => (
            <div key={d.id} ref={el => highlightRefs.current[d.id] = el} className={highlightId === d.id ? "collab-highlight" : ""}>
              <CollabDraft draft={d} me={me} token={token} onChanged={load} onTag={onTag} onMention={onMention} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
