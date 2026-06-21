import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { useToast } from "../shared/ui.jsx";
import Tip from "../shared/Tip.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
}

function yearsSince(dateStr) {
  return new Date().getFullYear() - Number(dateStr.slice(0, 4));
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function ruPlural(n, t, key1, key24, keyN) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t(keyN);
  if (mod10 === 1) return t(key1);
  if (mod10 >= 2 && mod10 <= 4) return t(key24);
  return t(keyN);
}

function PersonField({ value, onChange, token }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const handles = value ? value.split(",").map(h => h.trim()).filter(Boolean) : [];
  const timerRef = useRef(null);

  const searchUsers = (q) => {
    const raw = q.replace(/^@/, "").trim();
    if (!raw) { setSuggestions([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const results = await api(`/users/search?q=${encodeURIComponent(raw)}`, { token });
        setSuggestions(results.filter(u => !handles.includes(u.handle)));
      } catch {}
    }, 220);
  };

  const addHandle = (handle) => {
    const next = [...handles, handle].join(", ");
    onChange(next);
    setQuery("");
    setSuggestions([]);
    setShowSug(false);
  };

  const removeHandle = (h) => {
    onChange(handles.filter(x => x !== h).join(", "));
  };

  return (
    <div className="md2-person-field">
      <div className="md2-pf-tags">
        {handles.map(h => (
          <span key={h} className="md2-pf-tag">@{h}<button className="md2-pf-rm" onClick={() => removeHandle(h)}>✕</button></span>
        ))}
        <div className="md2-pf-input-wrap" style={{ position: "relative" }}>
          <input
            placeholder={t("dates.field.handle.placeholder")}
            value={query}
            onChange={e => { setQuery(e.target.value); searchUsers(e.target.value); setShowSug(true); }}
            onFocus={() => { if (query) setShowSug(true); }}
            onBlur={() => setTimeout(() => setShowSug(false), 180)}
          />
          {showSug && suggestions.length > 0 && (
            <div className="md2-pf-dropdown">
              {suggestions.map(u => (
                <button key={u.handle} className="md2-pf-option" onMouseDown={() => addHandle(u.handle)}>
                  <b>@{u.handle}</b><span>{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function nowMinDT() {
  const now = new Date();
  return now.toISOString().slice(0, 16);
}

export default function MemorableDates({ token, onMention, onGoFeed }) {
  const t = useT();
  const [dates, setDates] = useState(null);
  const [form, setForm] = useState({ date: "", label: "", type: "custom", personHandle: "" });
  const [editId, setEditId] = useState(null);
  const [dateError, setDateError] = useState("");
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const TYPES = [
    { value: "custom", label: t("dates.type.custom"), icon: "⭐", accent: "#d99a2b" },
    { value: "friend", label: t("dates.type.friend"), icon: "👥", accent: "#5b9e6e" },
    { value: "first_post", label: t("dates.type.first_post"), icon: "📝", accent: "#5fa8d3" },
    { value: "birthday", label: t("dates.type.birthday"), icon: "🎂", accent: "#f472b6" },
  ];

  useEffect(() => {
    api("/memorable-dates", { token }).then(setDates).catch(() => setDates([]));
  }, [token]);

  const validateDate = (dateVal) => {
    if (!dateVal) return t("dates.validate.noDate");
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return t("dates.validate.badDate");
    return "";
  };

  const add = async () => {
    if (!form.date || !form.label.trim()) return toast(t("dates.validate.noDateLabel"), { type: "error" });
    const err = validateDate(form.date);
    if (err) { setDateError(err); return; }
    setDateError("");
    const dateOnly = form.date.includes("T") ? form.date.split("T")[0] : form.date;
    try {
      const body = { ...form, date: dateOnly };
      let result;
      if (editId) {
        result = await api(`/memorable-dates/${editId}`, { method: "PATCH", token, body });
        toast(t("dates.updated.toast"), { type: "success" });
      } else {
        result = await api("/memorable-dates", { method: "POST", token, body });
        toast(t("dates.added.toast"), { type: "success" });
      }
      setDates(result);
      setForm({ date: "", label: "", type: "custom", personHandle: "" });
      setEditId(null);
      setAddOpen(false);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const startEdit = (date) => {
    setForm({ date: date.date, label: date.label, type: date.type, personHandle: date.person_handle || "" });
    setEditId(date.id);
    setDateError("");
    setAddOpen(true);
  };

  const cancelEdit = () => {
    setForm({ date: "", label: "", type: "custom", personHandle: "" });
    setEditId(null);
    setDateError("");
  };

  const del = async (id) => {
    try {
      const result = await api(`/memorable-dates/${id}`, { method: "DELETE", token });
      setDates(result);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const typeInfo = (type) => TYPES.find(ty => ty.value === type) || TYPES[0];

  const today = (dates || []).filter(d => daysUntil(d.date) === 0);
  const upcoming = (dates || []).filter(d => { const n = daysUntil(d.date); return n > 0 && n <= 14; });
  const rest = (dates || []).filter(d => daysUntil(d.date) > 14).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const past = (dates || []).filter(d => daysUntil(d.date) < 0).sort((a, b) => daysUntil(b.date) - daysUntil(a.date));

  const Card = ({ date }) => {
    const days = daysUntil(date.date);
    const isToday = days === 0;
    const years = yearsSince(date.date);
    const typeData = typeInfo(date.type);
    const daysWord = ruPlural(Math.abs(days), t, "fmt.day.1", "fmt.day.24", "fmt.day.n");
    const yearsWord = ruPlural(years, t, "dates.year.1", "dates.year.24", "dates.year.n");
    const handles = date.person_handle ? date.person_handle.split(",").map(h => h.trim()).filter(Boolean) : [];

    let countdownText;
    if (isToday) countdownText = t("dates.today");
    else if (days > 0) countdownText = t("dates.in", { n: days, w: daysWord });
    else countdownText = t("dates.ago", { n: Math.abs(days), w: daysWord });

    return (
      <div className="md3-card card" style={{ "--md3-accent": typeData.accent }}>
        <div className="md3-card-icon-col">
          <div className="md3-icon-circle">{typeData.icon}</div>
        </div>
        <div className="md3-card-body">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="md3-title">{date.label}</div>
            <div className={`md3-countdown${isToday ? " today" : ""}`}>{countdownText}</div>
          </div>
          <div className="md3-meta">
            {formatDate(date.date)}
            {years > 0 && <> · {years} {yearsWord}</>}
          </div>
          {handles.length > 0 && (
            <div className="md3-person-chips">
              {handles.map(h => (
                <span key={h} className="md3-person-chip" onClick={() => onMention?.(h)}>@{h}</span>
              ))}
            </div>
          )}
          {isToday && (
            <div className="md3-today-banner">
              <span>🎊 {t("dates.today.ann")} {years > 0 ? t("dates.today.years", { n: years, w: yearsWord }) : t("dates.today.first")}</span>
              <div className="md3-today-acts">
                <button className="btn accent" onClick={onGoFeed}>{t("dates.today.post.btn")}</button>
                {handles.length > 0 && <button className="btn ghost" onClick={() => onMention?.(handles[0])}>{t("dates.today.profile.btn")}</button>}
              </div>
            </div>
          )}
        </div>
        <div className="md3-card-actions">
          <Tip content={t("dates.edit.tip")} pos="top">
            <button className="md3-edit" onClick={() => startEdit(date)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Tip>
          <Tip content={t("dates.delete.tip")} pos="top">
            <button className="md3-del" onClick={() => del(date.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
            </button>
          </Tip>
        </div>
      </div>
    );
  };

  return (
    <div className="screen md2-screen">
      <div className="rp-head">
        <div>
          <h2>{t("dates.title")}</h2>
          <p className="hint" style={{ margin: 0 }}>{t("dates.subtitle")}</p>
        </div>
      </div>

      <div className="card md3-add-card" style={{ padding: 0 }}>
        <div className="md3-add-card-header" onClick={() => { setAddOpen(v => !v); if (addOpen) cancelEdit(); }}>
          <div className="md3-add-card-title"><span>✦</span> {editId ? t("dates.edit.open") : t("dates.add.open")}</div>
          <span className={`md3-add-card-chevron ${addOpen ? "open" : ""}`}>▼</span>
        </div>
        {addOpen && (
          <div className="md3-add-card-body">
            <div className="md3-type-grid">
              {TYPES.map(ty => (
                <button key={ty.value} className={`md3-type-btn ${form.type === ty.value ? "on" : ""}`} onClick={() => setForm(f => ({ ...f, type: ty.value }))}>
                  <div className="md3-type-icon" style={{ "--md3-accent": ty.accent }}>{ty.icon}</div>
                  <span>{ty.label}</span>
                </button>
              ))}
            </div>
            <div className="md3-field">
              <label>{t("dates.field.label")}</label>
              <input placeholder={t("dates.field.label.placeholder")} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="md3-field">
              <label>{t("dates.field.date")} <span className="hint">{t("dates.field.date.hint")}</span></label>
              <input
                type="datetime-local"
                value={form.date.includes("T") ? form.date : form.date ? form.date + "T00:00" : ""}
                min={nowMinDT()}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setDateError(""); }}
              />
              {dateError && <div className="md3-date-error">{dateError}</div>}
            </div>
            <div className="md3-field">
              <label>{t("dates.field.people")} <span className="hint">{t("dates.field.people.hint")}</span></label>
              <PersonField value={form.personHandle} onChange={v => setForm(f => ({ ...f, personHandle: v }))} token={token} />
            </div>
            <div className="md3-add-footer">
              {editId && <button className="btn ghost" onClick={cancelEdit}>{t("common.cancel")}</button>}
              <button className="btn accent" onClick={add} disabled={!form.date || !form.label.trim()}>
                {editId ? t("dates.save.btn") : t("dates.add.btn")}
              </button>
            </div>
          </div>
        )}
      </div>

      {dates === null ? (
        <div className="empty">{t("common.loading")}</div>
      ) : dates.length === 0 ? (
        <div className="md3-empty-state">
          <div className="md3-empty-ico">🗓️</div>
          <div className="md3-empty-title">{t("dates.empty.title")}</div>
          <div className="md3-empty-sub">{t("dates.empty.hint")}</div>
          <button className="btn accent md3-empty-btn" onClick={() => setAddOpen(true)}>{t("dates.empty.btn")}</button>
        </div>
      ) : (
        <div className="md2-list">
          {today.length > 0 && (
            <div className="md3-group">
              <div className="md3-group-header"><span className="md3-group-title">{t("dates.group.today")}</span><div className="md3-group-line"/></div>
              {today.map(d => <Card key={d.id} date={d} />)}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="md3-group">
              <div className="md3-group-header"><span className="md3-group-title">{t("dates.group.upcoming")}</span><div className="md3-group-line"/></div>
              {upcoming.map(d => <Card key={d.id} date={d} />)}
            </div>
          )}
          {rest.length > 0 && (
            <div className="md3-group">
              <div className="md3-group-header"><span className="md3-group-title">{t("dates.group.future")}</span><div className="md3-group-line"/></div>
              {rest.map(d => <Card key={d.id} date={d} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="md3-group">
              <div className="md3-group-header"><span className="md3-group-title">{t("dates.group.past")}</span><div className="md3-group-line"/></div>
              {past.map(d => <Card key={d.id} date={d} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
