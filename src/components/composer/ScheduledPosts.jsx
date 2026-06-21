import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { createPortal } from "react-dom";
import Md from "../shared/Markdown.jsx";
import DateTimePicker from "./DateTimePicker.jsx";
import { Clock, Send, Pencil, Trash2, ArrowUpDown, CalendarDays, Zap, AlertCircle } from "lucide-react";
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";

function useCountdown(dt) {
  const [val, setVal] = useState(() => dt ? Math.max(0, new Date(dt) - Date.now()) : null);
  useEffect(() => {
    if (!dt) return;
    const timer = setInterval(() => setVal(Math.max(0, new Date(dt) - Date.now())), 1000);
    return () => clearInterval(timer);
  }, [dt]);
  return val;
}

function Countdown({ dt }) {
  const t = useT();
  const ms = useCountdown(dt);
  if (ms === null) return null;
  if (ms <= 0) return <span className="sp-badge sp-badge-now"><Zap size={10} /> {t("sched.publishing")}</span>;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let label;
  if (d > 0) label = `${d}${t("sched.time.d")} ${h % 24}${t("sched.time.h")}`;
  else if (h > 0) label = `${h}${t("sched.time.h")} ${m % 60}${t("sched.time.m")}`;
  else if (m > 0) label = `${m}${t("sched.time.m")} ${s % 60}${t("sched.time.s")}`;
  else label = `${s}${t("sched.time.s")}`;
  const urgent = ms < 3600000;
  return <span className={`sp-badge ${urgent ? "sp-badge-urgent" : "sp-badge-soon"}`}><Clock size={10} /> {t("sched.in", { label })}</span>;
}

function groupByDay(posts, localeStr) {
  const groups = {};
  posts.forEach(p => {
    const day = new Date(p.scheduled_for).toLocaleDateString(localeStr, { day: "numeric", month: "long" });
    if (!groups[day]) groups[day] = [];
    groups[day].push(p);
  });
  return Object.entries(groups);
}

export default function ScheduledPosts({ token, onClose }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");
  const [err, setErr] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api("/posts/scheduled", { token }).then(setPosts).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const remove = async (id) => {
    const updated = await api(`/posts/scheduled/${id}`, { method: "DELETE", token });
    setPosts(updated);
    setConfirmDelete(null);
  };

  const publishNow = async (id) => {
    const updated = await api(`/posts/scheduled/${id}/publish-now`, { method: "POST", token });
    setPosts(updated);
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditBody(p.body);
    setEditDate(p.scheduled_for || "");
    setErr("");
  };

  const saveEdit = async () => {
    if (!editDate) { setErr(t("sched.noDateErr")); return; }
    try {
      const updated = await api(`/posts/scheduled/${editId}`, {
        method: "PATCH", token, body: { body: editBody, scheduledFor: editDate }
      });
      setPosts(updated);
      setEditId(null);
    } catch (e) { setErr(e.message); }
  };

  const pluralCount = (n) => n === 1 ? t("sched.count1", { n }) : n < 5 ? t("sched.count2", { n }) : t("sched.count5", { n });

  const minDateTime = () => new Date(Date.now() + 60000).toISOString();
  const sorted = [...posts].sort((a, b) => {
    const d = new Date(a.scheduled_for) - new Date(b.scheduled_for);
    return sortAsc ? d : -d;
  });
  const groups = groupByDay(sorted, localeStr);

  return createPortal(
    <div className="sched-overlay" onClick={onClose}>
      <div className="sched-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="sched-head">
          <div className="sched-head-left">
            <div className="sched-head-icon"><CalendarDays size={18} /></div>
            <div>
              <h3 className="sched-head-title">{t("sched.title")}</h3>
              {!loading && posts.length > 0 && (
                <span className="sched-head-count">{pluralCount(posts.length)}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!loading && posts.length > 1 && (
              <button className="sched-sort-btn" onClick={() => setSortAsc(v => !v)} title={sortAsc ? t("sched.sortNearest") : t("sched.sortFarthest")}>
                <ArrowUpDown size={14} />
                {sortAsc ? t("sched.sortAsc") : t("sched.sortDesc")}
              </button>
            )}
            <button className="sched-x" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div className="sched-empty sched-loading">
            <div className="sched-spinner" />
            {t("sched.loading")}
          </div>
        ) : posts.length === 0 ? (
          <div className="sched-empty">
            <div className="sched-empty-art">
              <CalendarDays size={40} strokeWidth={1.2} />
            </div>
            <div className="sched-empty-title">{t("sched.empty.title")}</div>
            <div className="sched-empty-hint">{t("sched.empty.hint")}</div>
          </div>
        ) : (
          <div className="sched-list">
            {groups.map(([day, dayPosts]) => (
              <div key={day} className="sched-day-group">
                <div className="sched-day-label">
                  <span>{day}</span>
                </div>
                {dayPosts.map(p => (
                  <div key={p.id} className={`sched-item card ${editId === p.id ? "sched-item-editing" : ""}`}>
                    {editId === p.id ? (
                      <div className="sched-edit">
                        <label className="sched-edit-label">{t("sched.edit.postText")}</label>
                        <textarea className="sched-edit-body" value={editBody}
                          onChange={e => setEditBody(e.target.value)} rows={4}
                          placeholder={t("sched.edit.placeholder")} />
                        <label className="sched-edit-label">{t("sched.edit.dateLabel")}</label>
                        <DateTimePicker value={editDate} onChange={setEditDate} minDate={minDateTime()} />
                        {err && <div className="sched-err"><AlertCircle size={13} /> {err}</div>}
                        <div className="sched-edit-btns">
                          <button className="btn accent" onClick={saveEdit}>{t("sched.edit.save")}</button>
                          <button className="btn ghost" onClick={() => setEditId(null)}>{t("common.cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="sched-item-top">
                          <div className="sched-item-meta-top">
                            <span className="sched-item-time">
                              <Clock size={12} />
                              {new Date(p.scheduled_for).toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <Countdown dt={p.scheduled_for} />
                          </div>
                          <div className="sched-item-actions-top">
                            <button className="sched-act" title={t("sched.tip.edit")} onClick={() => startEdit(p)}><Pencil size={13} /></button>
                            <button className="sched-act sched-act-danger" title={t("sched.tip.delete")} onClick={() => setConfirmDelete(p.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <div className="sched-item-body">
                          {p.body
                            ? <Md className="md">{p.body.length > 280 ? p.body.slice(0, 280) + "…" : p.body}</Md>
                            : <span className="sched-no-text">{t("sched.noText")}</span>
                          }
                        </div>
                        {confirmDelete === p.id ? (
                          <div className="sched-confirm">
                            <span>{t("sched.delete.confirm")}</span>
                            <button className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setConfirmDelete(null)}>{t("common.no")}</button>
                            <button className="btn danger-solid" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => remove(p.id)}>{t("sched.delete.yes")}</button>
                          </div>
                        ) : (
                          <button className="sched-publish-now" onClick={() => publishNow(p.id)}>
                            <Send size={13} /> {t("sched.publishNow")}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
