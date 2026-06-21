import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const APP_VERSION = "1.3.0";

const TYPE_LABEL = { major: "Крупное обновление", minor: "Обновление", patch: "Исправления" };
const TYPE_COLOR = { major: "#c8745a", minor: "#5fa8d3", patch: "#5b9e6e" };

export { APP_VERSION };

export function useChangelogNotif() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("xalle_seen_version");
    if (seen !== APP_VERSION) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("xalle_seen_version", APP_VERSION);
    setShow(false);
  };

  return { show, dismiss };
}

export default function Changelog({ onClose }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    api("/changelog").then(setEntries).catch(() => setEntries([]));
    // Mark as seen when changelog is opened
    localStorage.setItem("xalle_seen_version", APP_VERSION);
  }, []);

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal changelog-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>История изменений</h3>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="changelog-body">
          {entries === null ? (
            <div className="empty">Загрузка…</div>
          ) : entries.length === 0 ? (
            <div className="empty">Изменения не найдены</div>
          ) : entries.map(entry => (
            <div key={entry.version} className="cl-entry">
              <div className="cl-entry-head">
                <span className="cl-version">v{entry.version}</span>
                <span className="cl-type-badge" style={{ background: (TYPE_COLOR[entry.type] || "#888") + "22", color: TYPE_COLOR[entry.type] || "#888", border: `1px solid ${(TYPE_COLOR[entry.type] || "#888")}44` }}>
                  {TYPE_LABEL[entry.type] || entry.type}
                </span>
                {entry.date && <span className="cl-date">{entry.date}</span>}
              </div>
              {entry.body && (
                <div className="cl-body">
                  {entry.body.split("\n").map((line, i) => {
                    if (line.startsWith("### ")) return <div key={i} className="cl-h3">{line.slice(4)}</div>;
                    if (line.startsWith("## ")) return <div key={i} className="cl-h2">{line.slice(3)}</div>;
                    if (line.startsWith("- ")) return <div key={i} className="cl-item"><span className="cl-bullet">✦</span>{line.slice(2)}</div>;
                    if (line.trim()) return <div key={i} className="cl-text">{line}</div>;
                    return <div key={i} className="cl-spacer" />;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
