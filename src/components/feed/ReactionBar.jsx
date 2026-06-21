import { useState, useRef, useEffect } from "react";
import { REACTIONS } from "../../lib/format.js";
import { burstConfetti } from "../../lib/confetti.js";

export default function ReactionBar({ reactions, onReact, compact }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const counts = reactions?.counts || {};
  const mine = reactions?.mine || null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sorted = REACTIONS.filter((e) => counts[e]).sort((a, b) => counts[b] - counts[a]);
  const top = sorted.slice(0, 3);

  const keepOpen = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const scheduleClose = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 500); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const pick = (e, ev) => {
    const picking = mine !== e;
    onReact(mine === e ? null : e);
    setOpen(false);
    if (picking && e === "🎉") burstConfetti(ev.clientX, ev.clientY);
  };

  return (
    <div className={`react-bar ${compact ? "compact" : ""}`} onMouseEnter={keepOpen} onMouseLeave={scheduleClose}>
      {/* Единая кнопка: показывает выбранные реакции (или приглашение) и открывает выбор */}
      <button className={`react-main ${mine ? "mine" : ""} ${total > 0 ? "has" : ""}`} onClick={() => (open ? setOpen(false) : keepOpen())}>
        {total > 0 ? (
          <>
            <span className="rcl-emojis">{top.map((e, i) => <span key={e} className="rcl-emoji" style={{ zIndex: 3 - i }}>{e}</span>)}</span>
            <span className="rcl-total">{total}</span>
          </>
        ) : (
          <span className="react-add"><span className="ra-face">🙂</span>{!compact && <span className="ra-plus">+</span>}</span>
        )}
      </button>

      {open && (
        <div className="react-pop pop-in" onMouseEnter={keepOpen} onMouseLeave={scheduleClose}>
          {REACTIONS.map((e) => (
            <button key={e} className={`react-opt ${mine === e ? "sel" : ""}`} onClick={(ev) => pick(e, ev)}>
              <span className="ro-emoji">{e}</span>
              {counts[e] > 0 && <span className="ro-count">{counts[e]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
