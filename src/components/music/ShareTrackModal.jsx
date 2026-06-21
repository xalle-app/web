import { useState, useEffect, useRef } from "react";
import { Link2, MessageCircle, Check, Search, FileText, QrCode, UserPlus } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { useToast } from "../shared/ui.jsx";
import { createPortal } from "react-dom";

export default function ShareTrackModal({ track, token, onClose }) {
  const [tab, setTab] = useState("link"); // link | dm | post
  const [postCopied, setPostCopied] = useState(false);
  const [convs, setConvs] = useState([]);
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [sending, setSending] = useState(null); // conv id or handle being sent
  const [sent, setSent] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const searchTimer = useRef(null);

  useEffect(() => {
    if (tab !== "dm") return;
    api("/messages", { token }).then(setConvs).catch(() => {});
  }, [tab, token]);

  useEffect(() => {
    if (!query.trim()) { setUserResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(query.replace(/^@/, ""))}`, { token })
        .then(rows => {
          const existingHandles = new Set(convs.map(c => c.other_handle).filter(Boolean));
          setUserResults(rows.filter(u => !existingHandles.has(u.handle)));
        })
        .catch(() => {});
    }, 280);
    return () => clearTimeout(searchTimer.current);
  }, [query, convs, token]);

  const shareLink = track.shareToken
    ? `${window.location.origin}?track=${track.shareToken}`
    : `${window.location.origin}?track=${track.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Не удалось скопировать", { type: "error" });
    }
  };

  const sendToDM = async (conv) => {
    if (sent.has(conv.id)) return;
    setSending(conv.id);
    const body = `🎵 **${track.title}**${track.artist ? ` — ${track.artist}` : ""}\n${shareLink}`;
    try {
      await api(`/messages/${conv.id}/send`, { method: "POST", token, body: { body, images: [] } });
      setSent(prev => new Set([...prev, conv.id]));
      toast("Отправлено!", { type: "success" });
    } catch (e) {
      toast(e.message || "Ошибка", { type: "error" });
    } finally { setSending(null); }
  };

  const sendToUser = async (user) => {
    const key = `u:${user.handle}`;
    if (sent.has(key)) return;
    setSending(key);
    const msgBody = `🎵 **${track.title}**${track.artist ? ` — ${track.artist}` : ""}\n${shareLink}`;
    try {
      const { convId } = await api(`/messages/open/${user.handle}`, { method: "POST", token });
      await api(`/messages/${convId}/send`, { method: "POST", token, body: { body: msgBody, images: [] } });
      setSent(prev => new Set([...prev, key]));
      toast("Отправлено!", { type: "success" });
    } catch (e) {
      toast(e.message || "Ошибка", { type: "error" });
    } finally { setSending(null); }
  };

  const filtered = convs.filter(c => {
    if (!query.trim()) return true;
    const name = (c.other_name || c.title || "").toLowerCase();
    const handle = (c.other_handle || "").toLowerCase();
    const q = query.toLowerCase().replace(/^@/, "");
    return name.includes(q) || handle.includes(q);
  });

  return createPortal(
    <div className="share-overlay" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-modal card pop-in" onClick={e => e.stopPropagation()}>
        <div className="share-head">
          <h3>Поделиться треком</h3>
          <button className="share-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-track-info">
          {track.coverUrl
            ? <img src={assetUrl(track.coverUrl)} className="share-track-cover" alt="" />
            : <div className="share-track-cover share-cover-empty">♪</div>
          }
          <div>
            <div className="share-track-title">{track.title}</div>
            {track.artist && <div className="share-track-artist">{track.artist}</div>}
          </div>
        </div>

        <div className="share-tabs">
          <button className={tab === "link" ? "on" : ""} onClick={() => setTab("link")}>
            <Link2 size={14} /> Ссылка
          </button>
          <button className={tab === "qr" ? "on" : ""} onClick={() => setTab("qr")}>
            <QrCode size={14} /> QR
          </button>
          <button className={tab === "dm" ? "on" : ""} onClick={() => setTab("dm")}>
            <MessageCircle size={14} /> В сообщения
          </button>
          <button className={tab === "post" ? "on" : ""} onClick={() => setTab("post")}>
            <FileText size={14} /> В пост
          </button>
        </div>

        {tab === "link" && (
          <div className="share-link-body">
            <div className="share-link-row">
              <input className="share-link-input" value={shareLink} readOnly onClick={e => e.target.select()} />
              <button className={`btn accent share-copy-btn ${copied ? "share-copy-done" : ""}`} onClick={copyLink}>
                {copied ? <><Check size={14} /> Скопировано</> : <><Link2 size={14} /> Копировать</>}
              </button>
            </div>
          </div>
        )}

        {tab === "qr" && (
          <div className="share-qr-body">
            <div className="share-qr-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareLink)}&size=220x220&margin=10`}
                className="share-qr-img" alt="QR"
              />
            </div>
            <p className="share-qr-hint">Отсканируй QR-код чтобы открыть трек</p>
            <button className="btn ghost" style={{ width: "100%" }} onClick={copyLink}>
              {copied ? <><Check size={14} /> Скопировано</> : <><Link2 size={14} /> Копировать ссылку</>}
            </button>
          </div>
        )}

        {tab === "post" && (
          <div className="share-link-body">
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink-soft)" }}>
              Скопируй и вставь в пост:
            </p>
            <div className="share-link-row">
              <input
                className="share-link-input"
                value={`🎵 **${track.title}**${track.artist ? ` — ${track.artist}` : ""}\n${shareLink}`}
                readOnly
                onClick={e => e.target.select()}
              />
              <button
                className={`btn accent share-copy-btn ${postCopied ? "share-copy-done" : ""}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`🎵 **${track.title}**${track.artist ? ` — ${track.artist}` : ""}\n${shareLink}`);
                    setPostCopied(true); setTimeout(() => setPostCopied(false), 2000);
                  } catch { toast("Не удалось скопировать", { type: "error" }); }
                }}
              >
                {postCopied ? <><Check size={14} /> Скопировано</> : <><Link2 size={14} /> Копировать</>}
              </button>
            </div>
          </div>
        )}

        {tab === "dm" && (
          <div className="share-dm-body">
            <div className="share-dm-search">
              <Search size={14} className="share-dm-search-ico" />
              <input placeholder="Поиск по имени или @хэндлу…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="share-dm-list">
              {filtered.map(conv => (
                <button key={conv.id} className="share-dm-item" onClick={() => sendToDM(conv)} disabled={!!sending}>
                  {conv.other_avatar
                    ? <img src={assetUrl(conv.other_avatar)} className="share-dm-av" alt="" />
                    : <div className="share-dm-av share-dm-av-empty">{(conv.other_name || conv.title || "?")[0]}</div>
                  }
                  <div className="share-dm-name">{conv.other_name || conv.title || "Диалог"}</div>
                  {sent.has(conv.id)
                    ? <Check size={15} className="share-dm-sent-ico" />
                    : sending === conv.id
                      ? <span className="share-dm-sending">…</span>
                      : <span className="share-dm-send-lbl">Отправить</span>
                  }
                </button>
              ))}
              {userResults.length > 0 && (
                <>
                  {filtered.length > 0 && <div className="share-dm-divider">Новый диалог</div>}
                  {userResults.map(user => {
                    const key = `u:${user.handle}`;
                    return (
                      <button key={user.handle} className="share-dm-item" onClick={() => sendToUser(user)} disabled={!!sending}>
                        <div className="share-dm-av share-dm-av-empty">{user.name[0]}</div>
                        <div className="share-dm-name-wrap">
                          <div className="share-dm-name">{user.name}</div>
                          <div className="share-dm-handle">@{user.handle}</div>
                        </div>
                        {sent.has(key)
                          ? <Check size={15} className="share-dm-sent-ico" />
                          : sending === key
                            ? <span className="share-dm-sending">…</span>
                            : <><UserPlus size={13} /><span className="share-dm-send-lbl">Написать</span></>
                        }
                      </button>
                    );
                  })}
                </>
              )}
              {filtered.length === 0 && userResults.length === 0 && (
                <div className="share-dm-empty">{query ? "Ничего не найдено" : "Нет диалогов"}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
