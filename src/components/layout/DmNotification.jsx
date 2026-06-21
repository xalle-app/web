import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { Av } from "../shared/icons.jsx";

function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

const DURATION = 10000;

export default function DmNotification({ token, toastPos = "br", onOpen }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [show, setShow] = useState(false);
  const hideTimer = useRef(null);
  const replyRef = useRef(null);
  const timerStart = useRef(null);
  const timerRemaining = useRef(DURATION);

  const startTimer = (ms) => {
    clearTimeout(hideTimer.current);
    timerStart.current = Date.now();
    timerRemaining.current = ms;
    hideTimer.current = setTimeout(() => dismiss(), ms);
  };

  const pauseTimer = () => {
    if (!hideTimer.current) return;
    clearTimeout(hideTimer.current);
    const elapsed = Date.now() - (timerStart.current || Date.now());
    timerRemaining.current = Math.max(0, timerRemaining.current - elapsed);
  };

  const resumeTimer = () => {
    if (!timerRemaining.current) return;
    startTimer(timerRemaining.current);
  };

  // Listen for DM notifications
  useEffect(() => {
    const h = e => {
      const { msg, conv } = e.detail;
      if (!msg || !conv) return;
      setQueue(prev => [...prev, { msg, conv, id: Date.now() }]);
    };
    window.addEventListener("dm:notification", h);
    return () => window.removeEventListener("dm:notification", h);
  }, []);

  // Show next from queue
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrent(next);
    setReplyText("");
    setReplying(false);
    setShow(false);
    requestAnimationFrame(() => setShow(true));
    startTimer(DURATION);
  }, [queue, current]);

  const dismiss = () => {
    setShow(false);
    setTimeout(() => { setCurrent(null); setReplying(false); setReplyText(""); }, 350);
    clearTimeout(hideTimer.current);
  };

  const markRead = async () => {
    if (!current) return;
    try { await api(`/messages/${current.msg.conv_id}/read`, { method: "POST", token }); } catch {}
    dismiss();
  };

  const openChat = () => {
    if (!current) return;
    onOpen(current.conv);
    dismiss();
  };

  const sendReply = async () => {
    if (!replyText.trim() || !current) return;
    setReplying(true);
    try {
      await api(`/messages/${current.msg.conv_id}/send`, { method: "POST", token, body: { body: replyText.trim() } });
      setReplyText("");
      dismiss();
    } catch {}
    setReplying(false);
  };

  if (!current) return null;

  const pos = toastPos || "br";
  const posStyle = {
    "br": { bottom: 24, right: 24 },
    "bl": { bottom: 24, left: 24 },
    "tr": { top: 80, right: 24 },
    "tl": { top: 80, left: 24 },
  }[pos] || { bottom: 24, right: 24 };

  return (
    <div
      className={`dmn-wrap ${show ? "dmn-show" : ""}`}
      style={posStyle}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <div className="dmn-card">
        <button className="dmn-x" onClick={dismiss}>✕</button>
        <div className="dmn-top" onClick={openChat} style={{ cursor: "pointer" }}>
          <Av name={current.conv?.other_name || current.msg.sender_name} avatar={current.conv?.other_avatar || current.msg.sender_avatar} size={38} />
          <div className="dmn-info">
            <div className="dmn-name">{current.conv?.other_name || current.msg.sender_name}</div>
            <div className="dmn-preview">{(current.msg.body || "").slice(0, 80)}</div>
          </div>
          <span className="dmn-time">{fmtTime(current.msg.created_at)}</span>
        </div>

        {!current.conv?.is_self && (
          <>
            {current.showReply ? (
              <div className="dmn-reply">
                <input ref={replyRef} className="dmn-reply-input" placeholder="Быстрый ответ…"
                  value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendReply(); if (e.key === "Escape") dismiss(); }}
                  autoFocus />
                <button className="dmn-btn-send" onClick={sendReply} disabled={!replyText.trim() || replying}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="dmn-actions">
                <button className="dmn-btn-reply" onClick={() => { setCurrent(c => ({ ...c, showReply: true })); clearTimeout(hideTimer.current); }}>
                  Ответить
                </button>
                <button className="dmn-btn-read" onClick={markRead}>
                  Прочитано
                </button>
              </div>
            )}
          </>
        )}

        <div className="dmn-progress">
          <div className="dmn-progress-bar" style={{ "--dmn-dur": `${DURATION}ms` }} />
        </div>
      </div>
    </div>
  );
}
