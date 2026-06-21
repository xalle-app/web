import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { X, Search, Send } from "lucide-react";
import { useT } from "../../contexts/I18nContext.jsx";
import { useToast } from "./ui.jsx";
import { Av } from "./icons.jsx";

export default function ForwardModal({ token, msg, onClose }) {
  const t = useT();
  const toast = useToast();
  const [convs, setConvs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(null); // id of target being sent to
  const [sent, setSent] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api("/conversations", { token }).catch(() => []),
      api("/groups", { token }).catch(() => []),
    ]).then(([c, g]) => { setConvs(c); setGroups(g); });
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [token]);

  const q = search.toLowerCase();
  const filteredConvs = convs.filter(c => (c.other_name || c.name || "").toLowerCase().includes(q));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(q));

  const forward = async (type, id, name) => {
    if (sent.has(`${type}:${id}`)) return;
    setSending(`${type}:${id}`);
    try {
      const forwardedFrom = msg.sender_name || t("forward.unknown");
      const body = msg.body || "";
      if (type === "dm") {
        await api(`/messages/${id}/send`, { method: "POST", token, body: { body, forwardedFrom } });
      } else {
        await api(`/groups/${id}/messages`, { method: "POST", token, body: { body, forwarded_from: forwardedFrom } });
      }
      setSent(prev => new Set([...prev, `${type}:${id}`]));
      toast(t("forward.sent", { name }), { type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setSending(null);
    }
  };

  return createPortal(
    <div className="fwd-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fwd-modal pop-in">
        <div className="fwd-head">
          <span className="fwd-title">{t("forward.title")}</span>
          <button className="fwd-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="fwd-search-wrap">
          <Search size={14} className="fwd-search-ico" />
          <input ref={inputRef} className="fwd-search" placeholder={t("forward.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="fwd-list">
          {filteredConvs.length === 0 && filteredGroups.length === 0 && (
            <div className="fwd-empty">{t("common.noResults")}</div>
          )}

          {filteredConvs.length > 0 && (
            <>
              <div className="fwd-section-label">{t("forward.dms")}</div>
              {filteredConvs.map(c => {
                const key = `dm:${c.id}`;
                const isSent = sent.has(key);
                const isLoading = sending === key;
                return (
                  <button key={c.id} className={`fwd-item ${isSent ? "fwd-item-sent" : ""}`}
                    onClick={() => forward("dm", c.id, c.other_name)}
                    disabled={isLoading}>
                    <Av name={c.other_name} avatar={c.other_avatar} size={36} />
                    <span className="fwd-item-name">{c.other_name || t("messages.favorites")}</span>
                    <span className="fwd-item-action">
                      {isSent ? "✓" : isLoading ? "…" : <Send size={14} />}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {filteredGroups.length > 0 && (
            <>
              <div className="fwd-section-label">{t("forward.groups")}</div>
              {filteredGroups.map(g => {
                const key = `group:${g.id}`;
                const isSent = sent.has(key);
                const isLoading = sending === key;
                return (
                  <button key={g.id} className={`fwd-item ${isSent ? "fwd-item-sent" : ""}`}
                    onClick={() => forward("group", g.id, g.name)}
                    disabled={isLoading}>
                    <Av name={g.name} avatar={g.avatar_url} size={36} />
                    <span className="fwd-item-name">{g.name}</span>
                    <span className="fwd-item-action">
                      {isSent ? "✓" : isLoading ? "…" : <Send size={14} />}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Preview */}
        <div className="fwd-preview">
          <span className="fwd-preview-label">{t("forward.preview")}</span>
          <div className="fwd-preview-body">{(msg.body || "📎").slice(0, 100)}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
