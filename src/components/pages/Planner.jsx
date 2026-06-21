import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Download, X, Copy } from "lucide-react";
import { api } from "../../lib/api.js";
import { API_BASE } from "../../lib/config.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import DateTimePicker from "../composer/DateTimePicker.jsx";
import Tip from "../shared/Tip.jsx";
import { HeroHeader } from '../shared/HeroHeader.jsx';
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";

const TYPE_KEYS = [
  { value: "task", labelKey: "planner.type.task", icon: "✓", color: "#5fa8d3" },
  { value: "reminder", labelKey: "planner.type.reminder", icon: "🔔", color: "#d99a2b" },
  { value: "event", labelKey: "planner.type.event", icon: "📅", color: "#7a7ec8" },
];
const PRIO_KEYS = [
  { value: "low", labelKey: "planner.prio.low", color: "#5fa8a8" },
  { value: "normal", labelKey: "planner.prio.normal", color: "#888" },
  { value: "high", labelKey: "planner.prio.high", color: "#d65f7a" },
];
const CAT_KEYS = ["planner.cat.work", "planner.cat.study", "planner.cat.personal", "planner.cat.health", "planner.cat.finance", "planner.cat.hobby"];

const TYPE_MAP = Object.fromEntries(TYPE_KEYS.map(t => [t.value, t]));
const PRIO_MAP = Object.fromEntries(PRIO_KEYS.map(p => [p.value, p]));

function fmtDue(dt, t) {
  if (!dt) return null;
  const d = new Date(dt.replace(" ", "T"));
  const now = new Date();
  const diff = d - now;
  const dayMs = 86400000;
  if (diff < 0) return { text: t("planner.due.overdue"), warn: true };
  if (diff < dayMs) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return {
      text: h > 0
        ? t("planner.due.hoursMin", { h, m })
        : t("planner.due.minutes", { m }),
      urgent: diff < 3600000,
    };
  }
  const days = Math.floor(diff / dayMs);
  if (days === 1) return { text: t("planner.due.tomorrow") };
  if (days <= 7) return { text: t("planner.due.days", { n: days }) };
  return { text: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) };
}

function TaskCard({ task, onDone, onDelete, onEdit, onShare, shared, pending, onAccept, onDecline }) {
  const t = useT();
  const typeInfo = TYPE_MAP[task.type] || TYPE_KEYS[0];
  const p = PRIO_MAP[task.priority] || PRIO_KEYS[1];
  const due = fmtDue(task.due_at, t);
  const isDone = task.status === "done";

  if (pending) return (
    <div className="planner-card pending-invite">
      <div className="planner-card-left">
        <div className="planner-type-dot" style={{ background: typeInfo.color }}>{typeInfo.icon}</div>
      </div>
      <div className="planner-card-body">
        <div className="planner-card-title">{task.title}</div>
        {task.body && <div className="planner-card-body-text">{task.body}</div>}
        <div className="planner-card-meta">
          <span className="planner-from">{t("planner.from", { handle: task.shared_by_handle })}</span>
          {due && <span className={`planner-due ${due.warn ? "warn" : due.urgent ? "urgent" : ""}`}>🕐 {due.text}</span>}
        </div>
        <div className="planner-invite-actions">
          <button className="btn accent planner-accept" onClick={() => onAccept(task.id)}>{t("planner.accept")}</button>
          <button className="btn ghost" onClick={() => onDecline(task.id)}>{t("planner.decline")}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`planner-card ${isDone ? "done" : ""} ${task.priority === "high" ? "high-prio" : ""}`}>
      <button className={`planner-check ${isDone ? "checked" : ""}`} onClick={() => onDone(task.id)} title={isDone ? t("planner.markActive") : t("planner.markDone")}>
        {isDone ? "✓" : ""}
      </button>
      <div className="planner-card-body">
        <div className="planner-card-header">
          <span className="planner-type-tag" style={{ color: typeInfo.color, borderColor: typeInfo.color + "44", background: typeInfo.color + "12" }}>{typeInfo.icon} {t(typeInfo.labelKey)}</span>
          {task.category && <span className="planner-cat-tag">{task.category}</span>}
          {task.priority === "high" && <span className="planner-prio-tag" style={{ color: p.color }}>{t("planner.prio.highLabel")}</span>}
          {shared && task.shared_with_handle && <span className="planner-shared-tag">👤 @{task.shared_with_handle}</span>}
          {shared && task.shared_by_handle && <span className="planner-shared-tag">{t("planner.from", { handle: task.shared_by_handle })}</span>}
        </div>
        <div className={`planner-card-title ${isDone ? "strike" : ""}`}>{task.title}</div>
        {task.body && <div className="planner-card-body-text">{task.body}</div>}
        {due && (
          <div className={`planner-due ${due.warn ? "warn" : due.urgent ? "urgent" : ""}`}>
            🕐 {due.text}
          </div>
        )}
      </div>
      <div className="planner-card-actions">
        {!shared && <Tip content={t("planner.tip.share")} pos="top"><button className="planner-act-btn" onClick={() => onShare(task)}>↗</button></Tip>}
        <Tip content={t("planner.tip.edit")} pos="top"><button className="planner-act-btn" onClick={() => onEdit(task)}>✎</button></Tip>
        <Tip content={t("planner.tip.delete")} pos="top"><button className="planner-act-btn del" onClick={() => onDelete(task.id)}>✕</button></Tip>
      </div>
    </div>
  );
}

function TaskForm({ initial, onSave, onCancel }) {
  const t = useT();
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [type, setType] = useState(initial?.type || "task");
  const [priority, setPriority] = useState(initial?.priority || "normal");
  const [dueAt, setDueAt] = useState(initial?.due_at || "");
  const [remindAt, setRemindAt] = useState(initial?.remind_at || "");
  const [category, setCategory] = useState(initial?.category || "");

  return (
    <div className="planner-form">
      <div className="planner-form-types">
        {TYPE_KEYS.map(tp => (
          <button key={tp.value} type="button" className={`planner-type-btn ${type === tp.value ? "on" : ""}`}
            style={type === tp.value ? { borderColor: tp.color, color: tp.color, background: tp.color + "12" } : {}}
            onClick={() => setType(tp.value)}>
            {tp.icon} {t(tp.labelKey)}
          </button>
        ))}
      </div>
      <input className="planner-input" placeholder={t("planner.form.titleLabel")} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
      <textarea className="planner-textarea" placeholder={t("planner.form.descLabel")} value={body} onChange={e => setBody(e.target.value)} rows={2} maxLength={1000} />
      <div className="planner-form-row">
        <div className="planner-form-col">
          <label className="planner-label">{t("planner.form.dueLabel")}</label>
          <DateTimePicker value={dueAt} onChange={setDueAt} placeholder={t("planner.form.noDue")} />
        </div>
        <div className="planner-form-col">
          <label className="planner-label">{t("planner.form.remindLabel")}</label>
          <DateTimePicker value={remindAt} onChange={setRemindAt} placeholder={t("planner.form.noRemind")} />
        </div>
      </div>
      <div className="planner-prio-row">
        <span className="planner-label">{t("planner.form.priority")}</span>
        {PRIO_KEYS.map(p => (
          <button key={p.value} type="button" className={`planner-prio-btn ${priority === p.value ? "on" : ""}`}
            style={priority === p.value ? { borderColor: p.color, color: p.color, background: p.color + "15" } : {}}
            onClick={() => setPriority(p.value)}>{t(p.labelKey)}</button>
        ))}
      </div>
      <div className="planner-prio-row">
        <span className="planner-label">{t("planner.form.category")}</span>
        {CAT_KEYS.map(ck => (
          <button key={ck} type="button" className={`planner-prio-btn ${category === t(ck) ? "on" : ""}`}
            onClick={() => setCategory(category === t(ck) ? "" : t(ck))}>{t(ck)}</button>
        ))}
      </div>
      <div className="planner-form-footer">
        <button className="btn ghost" type="button" onClick={onCancel}>{t("common.cancel")}</button>
        <button className="btn accent" type="button" onClick={() => onSave({ title, body, type, priority, dueAt, remindAt, category })} disabled={!title.trim()}>
          {initial ? t("planner.form.save") : t("planner.form.create")}
        </button>
      </div>
    </div>
  );
}

function ShareModal({ task, token, onClose }) {
  const t = useT();
  const [tab, setTab] = useState("link");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [linkToken, setLinkToken] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api(`/planner/${task.id}/link`, { method: "POST", token })
      .then(r => setLinkToken(r.token))
      .catch(() => {});
  }, [task.id, token]);

  const link = linkToken ? `${window.location.origin}?dates&task=${linkToken}` : t("planner.share.generating");
  const qrUrl = linkToken ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(link)}&size=180x180&margin=10` : null;

  const copyLink = () => {
    if (!linkToken) return;
    navigator.clipboard?.writeText(link);
    toast(t("planner.share.copied"), { type: "success" });
  };

  const send = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    try {
      await api(`/planner/${task.id}/share`, { method: "POST", token, body: { handle: handle.replace(/^@/, "") } });
      setSent(true);
      toast(t("planner.share.sent", { handle }), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(false); }
  };

  return (
    <div className="planner-share-overlay" onClick={onClose}>
      <div className="planner-share-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="share-modal-head">
          <span className="share-modal-title">{t("planner.share.title")}</span>
          <button className="share-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="planner-share-task">«{task.title}»</div>

        <div className="share-modal-tabs">
          <button className={`share-modal-tab ${tab === "link" ? "active" : ""}`} onClick={() => setTab("link")}>{t("planner.share.byLink")}</button>
          <button className={`share-modal-tab ${tab === "username" ? "active" : ""}`} onClick={() => setTab("username")}>{t("planner.share.byUsername")}</button>
          <button className={`share-modal-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>{t("planner.share.byQr")}</button>
        </div>

        {tab === "link" && (
          <div className="share-modal-body">
            <div className="share-modal-link-row">
              <span className="share-modal-link-text">{link}</span>
              <button className="btn accent" onClick={copyLink}><Copy size={14} /> {t("planner.share.copy")}</button>
            </div>
          </div>
        )}
        {tab === "username" && (
          <div className="share-modal-body">
            {sent ? (
              <div className="share-modal-sent">{t("planner.share.sent", { handle })}</div>
            ) : (
              <>
                <input className="planner-input" placeholder={t("planner.share.handlePh")} value={handle}
                  onChange={e => setHandle(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} autoFocus />
                <button className="btn accent" style={{ marginTop: 10, width: "100%" }} onClick={send} disabled={busy || !handle.trim()}>
                  {busy ? t("planner.share.sending") : t("planner.share.send")}
                </button>
              </>
            )}
          </div>
        )}
        {tab === "qr" && (
          <div className="share-modal-body" style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            {qrUrl
              ? <img src={qrUrl} alt="QR" width={160} height={160} style={{ borderRadius: 8 }} />
              : <div style={{ width: 160, height: 160, display: "grid", placeItems: "center", color: "var(--ink-faint)" }}>{t("common.loading")}</div>
            }
            <p style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>{t("planner.share.qrHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({ data }) {
  const t = useT();
  const { locale } = useLocale();
  const dateLocale = DATE_LOCALES[locale] || "ru-RU";
  const all = [...(data?.own || []), ...(data?.sharedWithMe || [])].filter(tk => tk.due_at);
  const byDay = {};
  all.forEach(tk => {
    const day = tk.due_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(tk);
  });
  const days = Object.keys(byDay).sort();
  if (days.length === 0) return <div className="planner-empty"><div className="planner-empty-ico">📅</div><div>{t("planner.empty.noDate")}</div></div>;
  return (
    <div className="planner-calendar">
      {days.map(day => {
        const d = new Date(day);
        const label = d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" });
        return (
          <div key={day} className="planner-cal-day">
            <div className="planner-cal-day-label">{label}</div>
            {byDay[day].map(tk => {
              const type = TYPE_MAP[tk.type] || TYPE_KEYS[0];
              const isDone = tk.status === "done";
              return (
                <div key={tk.id} className={`planner-cal-item ${isDone ? "done" : ""}`}>
                  <span className="planner-cal-time">{tk.due_at.slice(11, 16)}</span>
                  <span className="planner-cal-dot" style={{ background: type.color }}>{type.icon}</span>
                  <span className={`planner-cal-title ${isDone ? "strike" : ""}`}>{tk.title}</span>
                  {tk.category && <span className="planner-cat-tag">{tk.category}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function Planner({ token }) {
  const t = useT();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("active");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [shareTask, setShareTask] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    api("/planner", { token }).then(setData).catch(() => {});
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.own) return;
    const now = new Date();
    data.own.forEach(tk => {
      if (!tk.remind_at || tk.status === "done") return;
      const remindTime = new Date(tk.remind_at.replace(" ", "T"));
      const diff = remindTime - now;
      if (diff > 0 && diff < 3600000) {
        setTimeout(() => toast(t("planner.remind", { title: tk.title }), { type: "info" }), diff);
      }
    });
  }, [data]);

  const create = async (fields) => {
    try {
      const result = await api("/planner", { method: "POST", token, body: fields });
      setData(result); setShowForm(false);
      toast(t("planner.created"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const update = async (fields) => {
    try {
      const result = await api(`/planner/${editTask.id}`, { method: "PATCH", token, body: fields });
      setData(result); setEditTask(null);
      toast(t("planner.updated"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const toggleDone = async (id) => {
    const result = await api(`/planner/${id}/done`, { method: "POST", token });
    setData(result);
  };

  const remove = async (id) => {
    if (!(await confirm({ title: t("planner.delete.title"), danger: true, okText: t("common.delete") }))) return;
    const result = await api(`/planner/${id}`, { method: "DELETE", token });
    setData(result);
  };

  const respond = async (id, accept) => {
    const result = await api(`/planner/${id}/respond`, { method: "POST", token, body: { accept } });
    setData(result);
    toast(accept ? t("planner.taskAccepted") : t("planner.taskDeclined"), { type: accept ? "success" : "info" });
  };

  const own = data?.own || [];
  const active = own.filter(tk => tk.status === "active");
  const done = own.filter(tk => tk.status === "done");
  const sharedWithMe = data?.sharedWithMe || [];
  const pendingForMe = data?.pendingForMe || [];
  const pendingCount = pendingForMe.length;

  return (
    <div className="screen planner-screen">
      <HeroHeader
        icon={<CalendarDays size={32} />}
        title={t("planner.title")}
        subtitle={t("planner.subtitle")}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Tip content={t("planner.exportIcs")} pos="bottom">
              <button className="btn ghost" onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/planner/export.ics`, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "xalle-planner.ics"; a.click();
                  URL.revokeObjectURL(url);
                } catch { toast(t("planner.exportError"), { type: "error" }); }
              }}>
                <Download size={16} />
              </button>
            </Tip>
            <button className="btn accent" onClick={() => setShowForm(v => !v)}>
              {showForm ? t("planner.cancelNew") : t("planner.newTask")}
            </button>
          </div>
        }
      />

      {showForm && !editTask && (
        <div className="planner-form-card card">
          <TaskForm onSave={create} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editTask && (
        <div className="planner-form-card card">
          <div className="planner-form-heading">{t("planner.editTask")}</div>
          <TaskForm initial={editTask} onSave={update} onCancel={() => setEditTask(null)} />
        </div>
      )}

      <div className="planner-tabs">
        <button className={`planner-tab ${tab === "active" ? "on" : ""}`} onClick={() => setTab("active")}>
          {t("planner.tab.active")} <span className="planner-tab-count">{active.length}</span>
        </button>
        <button className={`planner-tab ${tab === "calendar" ? "on" : ""}`} onClick={() => setTab("calendar")}>
          {t("planner.tab.calendar")}
        </button>
        <button className={`planner-tab ${tab === "shared" ? "on" : ""}`} onClick={() => setTab("shared")}>
          {t("planner.tab.shared")}
          {pendingCount > 0 && <span className="planner-tab-badge">{pendingCount}</span>}
        </button>
        <button className={`planner-tab ${tab === "done" ? "on" : ""}`} onClick={() => setTab("done")}>
          {t("planner.tab.done")} <span className="planner-tab-count">{done.length}</span>
        </button>
      </div>

      {tab === "calendar" && <CalendarView data={data} />}

      {tab === "active" && (
        <div className="planner-list">
          {active.length === 0 ? (
            <div className="planner-empty">
              <div className="planner-empty-ico">✓</div>
              <div>{t("planner.empty.active")}</div>
              <button className="btn accent" onClick={() => setShowForm(true)}>{t("planner.createFirst")}</button>
            </div>
          ) : active.map(tk => (
            <TaskCard key={tk.id} task={tk} onDone={toggleDone} onDelete={remove}
              onEdit={(task) => { setEditTask(task); setShowForm(false); }}
              onShare={setShareTask} />
          ))}
        </div>
      )}

      {tab === "shared" && (
        <div className="planner-list">
          {pendingCount > 0 && (
            <div className="planner-section-label">{t("planner.incoming")} ({pendingCount})</div>
          )}
          {pendingForMe.map(tk => (
            <TaskCard key={tk.id} task={tk} pending onAccept={(id) => respond(id, true)} onDecline={(id) => respond(id, false)} />
          ))}
          {sharedWithMe.length > 0 && (
            <>
              <div className="planner-section-label">{t("planner.acceptedShared")}</div>
              {sharedWithMe.map(tk => (
                <TaskCard key={tk.id} task={tk} shared onDone={toggleDone} onDelete={remove}
                  onEdit={(task) => { setEditTask(task); setShowForm(false); }}
                  onShare={() => {}} />
              ))}
            </>
          )}
          {own.filter(tk => tk.shared_with_id).length > 0 && (
            <>
              <div className="planner-section-label">{t("planner.mySent")}</div>
              {own.filter(tk => tk.shared_with_id).map(tk => (
                <TaskCard key={tk.id} task={tk} shared onDone={toggleDone} onDelete={remove}
                  onEdit={(task) => { setEditTask(task); setShowForm(false); }}
                  onShare={setShareTask} />
              ))}
            </>
          )}
          {pendingCount === 0 && sharedWithMe.length === 0 && own.filter(tk => tk.shared_with_id).length === 0 && (
            <div className="planner-empty"><div className="planner-empty-ico">👥</div><div>{t("planner.empty.shared")}</div></div>
          )}
        </div>
      )}

      {tab === "done" && (
        <div className="planner-list">
          {done.length === 0 ? (
            <div className="planner-empty"><div className="planner-empty-ico">🎯</div><div>{t("planner.empty.done")}</div></div>
          ) : done.map(tk => (
            <TaskCard key={tk.id} task={tk} onDone={toggleDone} onDelete={remove}
              onEdit={(task) => { setEditTask(task); setShowForm(false); }}
              onShare={setShareTask} />
          ))}
        </div>
      )}

      {shareTask && <ShareModal task={shareTask} token={token} onClose={() => setShareTask(null)} />}
    </div>
  );
}
