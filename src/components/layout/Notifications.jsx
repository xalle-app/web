import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { timeAgo } from "../../lib/format.js";
import { CheckBadge, ModBadge } from "../shared/icons.jsx";
import { Bell } from "lucide-react";
import { useT } from "../../contexts/I18nContext.jsx";

export default function Notifications({ token, bump, onOpenPost, onGoCollabs }) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const LABEL = {
    repost: t("notif.repost"),
    reply: t("notif.reply"),
    mention: t("notif.mention"),
    commentReaction: t("notif.commentReaction"),
    postReaction: t("notif.postReaction"),
    follow: t("notif.follow"),
    collabBlock: t("notif.collabBlock"),
    gift: t("notif.gift"),
  };

  const load = useCallback(() => {
    if (!token) return;
    api("/notifications", { token }).then(setItems).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load, bump]);

  const unread = items.filter((n) => !n.read).length;

  const clearAll = async (e) => {
    e.stopPropagation();
    try { await api("/notifications/clear", { method: "POST", token }); setItems([]); } catch {}
  };

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ x: Math.min(r.left, window.innerWidth - 340), y: r.bottom + 8 });
  };
  const toggle = () => {
    if (!open) { place(); setOpen(true); if (unread) api("/notifications/read", { method: "POST", token }).then(() => setItems((cur) => cur.map((n) => ({ ...n, read: true })))).catch(() => {}); }
    else setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    window.addEventListener("resize", place);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("resize", place); };
  }, [open]);

  return (
    <div className="notif-wrap">
      <button ref={btnRef} className={`notif-btn ${unread ? "has" : ""}`} onClick={toggle} aria-label={t("notifications.title")}>
        <Bell />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && createPortal(
        <div className="notif-pop pop-in" ref={popRef} style={{ left: coords.x, top: coords.y }}>
          <div className="notif-head">
            <span>{t("notifications.title")}</span>
            {items.length > 0 && <button className="notif-clear" onClick={clearAll}>{t("notif.clear")}</button>}
          </div>
          {items.length === 0 ? (
            <div className="notif-empty">{t("notif.empty")}</div>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                n.type === "system" ? (
                  <div key={n.id} className={`notif-item system ${n.read ? "" : "unread"}`}>
                    <div className="ni-system"><span className="ni-sys-ico">⚠</span><span>{n.text}</span></div>
                    <div className="ni-time">{timeAgo(n.created_at)}</div>
                  </div>
                ) : n.type === "gift" ? (
                  <div key={n.id} className={`notif-item gift ${n.read ? "" : "unread"}`}>
                    <div className="ni-system"><span className="ni-sys-ico">🎁</span><span><b>{n.actor_name}</b> {LABEL.gift}</span></div>
                    {n.text && <div className="ni-snippet">{n.text}</div>}
                    <div className="ni-time">{timeAgo(n.created_at)}</div>
                  </div>
                ) : (
                  <button key={n.id} className={`notif-item ${n.read ? "" : "unread"}`}
                    onClick={() => { setOpen(false); if (n.type === "collabBlock" && n.post_id) { onGoCollabs?.(n.post_id); } else if (n.post_id && onOpenPost) onOpenPost(n.post_id, n.comment_id); }}>
                    <div className="ni-text">
                      <b>{n.actor_name}{n.actor_verified && <CheckBadge />}{n.actor_role === "moderator" && <ModBadge />}</b> {LABEL[n.type] || t("notif.new")}
                    </div>
                    {n.text && <div className="ni-snippet">{n.text}</div>}
                    <div className="ni-time">{timeAgo(n.created_at)}</div>
                  </button>
                )
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
