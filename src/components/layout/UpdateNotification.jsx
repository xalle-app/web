import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function UpdateNotification({ critical, message, changelog, onClose }) {
  const [countdown, setCountdown] = useState(60);
  const [minimized, setMinimized] = useState(!critical);

  useEffect(() => {
    if (!critical) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); window.location.reload(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [critical]);

  const progressPct = critical ? ((60 - countdown) / 60) * 100 : 0;
  const urgency = countdown <= 10 ? "crit" : countdown <= 30 ? "warn" : "";

  if (minimized) return createPortal(
    <div className={`upd-bar pop-in ${urgency}`} onClick={() => setMinimized(false)}>
      <span className="upd-bar-icon">{critical ? "⚠️" : "✦"}</span>
      <div className="upd-bar-body">
        <span className="upd-bar-title">{critical ? "Обновление платформы" : "Доступно обновление"}</span>
        {critical && <span className="upd-bar-timer">Перезагрузка через <strong>{countdown}с</strong></span>}
      </div>
      <button className="btn accent upd-bar-btn" onClick={e => { e.stopPropagation(); window.location.reload(); }}>
        Обновить
      </button>
      {critical && (
        <div className="upd-bar-progress">
          <div className="upd-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>,
    document.body
  );

  const changeItems = changelog
    ? (Array.isArray(changelog) ? changelog : changelog.split("\n").filter(Boolean))
    : null;

  return createPortal(
    <div className="upd-overlay">
      <div className="upd-modal pop-in">
        <div className="upd-icon">{critical ? "⚠️" : "✦"}</div>
        <h3 className="upd-title">{critical ? "Критическое обновление" : "Доступно обновление"}</h3>
        <p className="upd-body">
          {message || (critical
            ? "Вышла важная версия платформы. Требуется перезагрузка страницы."
            : "Вышла новая версия Xalle. Перезагрузи страницу, чтобы получить обновление."
          )}
        </p>
        {changeItems && changeItems.length > 0 && (
          <div className="upd-changelog">
            <div className="upd-changelog-title">Что нового:</div>
            <ul className="upd-changelog-list">
              {changeItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {critical && (
          <div className="upd-countdown">
            Автоматическая перезагрузка через <strong>{countdown}</strong> сек
            <div className="upd-progress-bar">
              <div className="upd-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <div className="upd-actions">
          <button className="btn primary upd-btn-reload" onClick={() => window.location.reload()}>
            Обновить сейчас
          </button>
          <button className="btn ghost upd-btn-dismiss" onClick={() => { critical ? setMinimized(true) : onClose(); }}>
            {critical ? "Понятно, позже" : "Позже"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
