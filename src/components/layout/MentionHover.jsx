import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { Avatar, Name, PresenceDot } from "../shared/icons.jsx";

// Глобально слушает наведение на .mention и показывает карточку пользователя
export default function MentionHover({ token, onOpenUser, onMention }) {
  const [card, setCard] = useState(null); // { handle, x, y, data }
  const hideTimer = useRef(null);
  const cache = useRef({});
  const cardRef = useRef(null);

  useEffect(() => {
    const onOver = (e) => {
      const el = e.target.closest?.(".mention");
      if (!el) return;
      const handle = el.getAttribute("data-mention");
      if (!handle) return;
      clearTimeout(hideTimer.current);
      const r = el.getBoundingClientRect();
      setCard({ handle, x: r.left, y: r.bottom + 6, data: cache.current[handle] || null });
      if (!cache.current[handle]) {
        api(`/profile/${handle}`, { token }).then((d) => { cache.current[handle] = d; setCard((c) => c && c.handle === handle ? { ...c, data: d } : c); }).catch(() => {});
      }
    };
    const onOut = (e) => {
      const el = e.target.closest?.(".mention");
      if (!el) return;
      hideTimer.current = setTimeout(() => setCard(null), 250);
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => { document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut); };
  }, [token]);

  if (!card) return null;
  const keep = () => clearTimeout(hideTimer.current);
  const leave = () => { hideTimer.current = setTimeout(() => setCard(null), 200); };
  const d = card.data;

  return createPortal(
    <div className="mention-card pop-in" ref={cardRef}
      style={{ left: Math.min(card.x, window.innerWidth - 260), top: card.y }}
      onMouseEnter={keep} onMouseLeave={leave}>
      {!d ? (
        <div className="mc-loading">Загрузка…</div>
      ) : d.handle ? (
        <>
          <div className="mc-head">
            <div className="avatar-wrap clickable" onClick={() => onMention && onMention(d.handle)}><Avatar url={d.avatar_url} name={d.name} /><PresenceDot online={d.online} lastSeen={d.last_seen} /></div>
            <div className="mc-info">
              <Name className="mc-name" name={d.name} verified={d.verified} role={d.role} />
              <div className="mc-handle">@{d.handle}</div>
            </div>
          </div>
          <div className="mc-stats"><span><b>{d.followers}</b> подписчиков</span><span><b>{d.posts}</b> постов</span></div>
          <button className="btn accent mc-btn" onClick={() => { onOpenUser(d.handle); setCard(null); }}>Перейти в профиль</button>
        </>
      ) : (
        <div className="mc-loading">Пользователь не найден</div>
      )}
    </div>,
    document.body
  );
}
