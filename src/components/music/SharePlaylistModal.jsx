import { useState, useEffect, useRef } from "react";
import { Link2, MessageCircle, QrCode, Check, Search, UserPlus } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { useToast } from "../shared/ui.jsx";
import { createPortal } from "react-dom";
import { useT } from "../../contexts/I18nContext.jsx";

export default function SharePlaylistModal({ playlist, token, onClose }) {
  const t = useT();
  const [tab, setTab] = useState("link");
  const [convs, setConvs] = useState([]);
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const searchTimer = useRef(null);

  const shareLink = `${window.location.origin}?playlist=${playlist.share_token}`;

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast(t("common.error"), { type: "error" }); }
  };

  const sendToDM = async (conv) => {
    if (sent.has(conv.id)) return;
    setSending(conv.id);
    const body = `🎵 **${playlist.title}**\n${shareLink}`;
    try {
      await api(`/messages/${conv.id}/send`, { method: "POST", token, body: { body, images: [] } });
      setSent(prev => new Set([...prev, conv.id]));
      toast(t("music.playlist.shareSent"), { type: "success" });
    } catch (e) {
      toast(e.message || t("common.error"), { type: "error" });
    } finally { setSending(null); }
  };

  const sendToUser = async (user) => {
    const key = `u:${user.handle}`;
    if (sent.has(key)) return;
    setSending(key);
    const msgBody = `🎵 **${playlist.title}**\n${shareLink}`;
    try {
      const { convId } = await api(`/messages/open/${user.handle}`, { method: "POST", token });
      await api(`/messages/${convId}/send`, { method: "POST", token, body: { body: msgBody, images: [] } });
      setSent(prev => new Set([...prev, key]));
      toast(t("music.playlist.shareSent"), { type: "success" });
    } catch (e) {
      toast(e.message || t("common.error"), { type: "error" });
    } finally { setSending(null); }
  };

  const filtered = convs.filter(c => {
    if (!query.trim()) return true;
    const name = (c.other_name || c.title || "").toLowerCase();
    const handle = (c.other_handle || "").toLowerCase();
    const q = query.toLowerCase().replace(/^@/, "");
    return name.includes(q) || handle.includes(q);
  });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareLink)}&size=220x220&margin=10&color=000000&bgcolor=ffffff`;

  return createPortal(
    <div className="share-overlay" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-modal card pop-in" onClick={e => e.stopPropagation()}>
        <div className="share-head">
          <h3>{t("music.playlist.share.title")}</h3>
          <button className="share-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-track-info">
          {playlist.cover_url
            ? <img src={assetUrl(playlist.cover_url)} className="share-track-cover" alt="" />
            : <div className="share-track-cover share-cover-empty">🎵</div>
          }
          <div>
            <div className="share-track-title">{playlist.title}</div>
            <div className="share-track-artist">{playlist.track_count} {t("music.playlist.share.tracks")}</div>
          </div>
        </div>

        <div className="share-tabs">
          <button className={tab === "link" ? "on" : ""} onClick={() => setTab("link")}>
            <Link2 size={14} /> {t("music.playlist.share.tab.link")}
          </button>
          <button className={tab === "qr" ? "on" : ""} onClick={() => setTab("qr")}>
            <QrCode size={14} /> QR
          </button>
          <button className={tab === "dm" ? "on" : ""} onClick={() => setTab("dm")}>
            <MessageCircle size={14} /> {t("music.playlist.share.tab.dm")}
          </button>
        </div>

        {tab === "link" && (
          <div className="share-link-body">
            <div className="share-link-row">
              <input className="share-link-input" value={shareLink} readOnly onClick={e => e.target.select()} />
              <button className={`btn accent share-copy-btn ${copied ? "share-copy-done" : ""}`} onClick={copyLink}>
                {copied ? <><Check size={14} /> {t("common.copied")}</> : <><Link2 size={14} /> {t("common.copy")}</>}
              </button>
            </div>
          </div>
        )}

        {tab === "qr" && (
          <div className="share-qr-body">
            <div className="share-qr-wrap">
              <img src={qrUrl} className="share-qr-img" alt="QR" />
            </div>
            <p className="share-qr-hint">{t("music.playlist.share.qr.hint")}</p>
            <button className="btn ghost" style={{ width: "100%" }} onClick={copyLink}>
              {copied ? <><Check size={14} /> {t("common.copied")}</> : <><Link2 size={14} /> {t("common.copyLink")}</>}
            </button>
          </div>
        )}

        {tab === "dm" && (
          <div className="share-dm-body">
            <div className="share-dm-search">
              <Search size={14} className="share-dm-search-ico" />
              <input placeholder={t("music.playlist.share.search")} value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="share-dm-list">
              {filtered.map(conv => (
                <button key={conv.id} className="share-dm-item" onClick={() => sendToDM(conv)} disabled={!!sending}>
                  {conv.other_avatar
                    ? <img src={assetUrl(conv.other_avatar)} className="share-dm-av" alt="" />
                    : <div className="share-dm-av share-dm-av-empty">{(conv.other_name || conv.title || "?")[0]}</div>
                  }
                  <div className="share-dm-name">{conv.other_name || conv.title || t("music.playlist.share.conv")}</div>
                  {sent.has(conv.id)
                    ? <Check size={15} className="share-dm-sent-ico" />
                    : sending === conv.id
                      ? <span className="share-dm-sending">…</span>
                      : <span className="share-dm-send-lbl">{t("common.send")}</span>
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
                <div className="share-dm-empty">{query ? "Ничего не найдено" : t("music.playlist.share.noConvs")}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
