import { useState, useEffect, useCallback } from "react";
import { Lightbulb } from "lucide-react";
import { api } from "../../lib/api.js";
import { timeAgo } from "../../lib/format.js";
import Gallery from "../shared/Lightbox.jsx";
import { useToast } from "../shared/ui.jsx";
import { HeroHeader } from "../shared/HeroHeader.jsx";

const TABS = [["open", "Новые"], ["resolved", "Решённые"], ["dismissed", "Отклонённые"]];
const KIND = { bug: ["🐞", "Баг"], idea: ["💡", "Идея"], other: ["💬", "Другое"] };

export default function FeedbackPanel({ token, onOpenChange }) {
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const toast = useToast();

  const load = useCallback(() => {
    api(`/feedback?status=${status}`, { token })
      .then((d) => { setItems(d.items); onOpenChange?.(d.open); })
      .catch(() => setItems([]));
  }, [status, token, onOpenChange]);
  useEffect(() => { load(); }, [load]);

  const setItemStatus = async (id, s) => {
    try {
      const d = await api(`/feedback/${id}/status`, { method: "POST", token, body: { status: s } });
      toast(s === "resolved" ? "Отмечено решённым" : s === "dismissed" ? "Отклонено" : "Возвращено в новые", { type: "info" });
      onOpenChange?.(d.open); load();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  return (
    <div className="screen reports-screen">

      <HeroHeader
        icon={<Lightbulb size={32} />}
        title="Фидбэк"
        subtitle="Панель для просмотра и обработки пользовательских отзывов и предложений"
      />

      <div className="panel-filters">
        <div className="panel-filters-row">
          <div className="seg">
            {TABS.map(([v, l]) => (
              <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
          <div className="panel-type-seg">
            <button className={!kindFilter ? "on" : ""} onClick={() => setKindFilter("")}>Все</button>
            <button className={kindFilter === "bug" ? "on" : ""} onClick={() => setKindFilter("bug")}>🐞 Баги</button>
            <button className={kindFilter === "idea" ? "on" : ""} onClick={() => setKindFilter("idea")}>💡 Идеи</button>
            <button className={kindFilter === "other" ? "on" : ""} onClick={() => setKindFilter("other")}>💬 Другое</button>
          </div>
        </div>
        <input className="panel-search" placeholder="🔍 Поиск по тексту, заголовку, нику…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {items === null ? (
        <div className="empty">Загрузка…</div>
      ) : (() => {
        const q = search.toLowerCase();
        const filtered = items.filter(f => {
          if (kindFilter && f.kind !== kindFilter) return false;
          if (!q) return true;
          return (f.title || "").toLowerCase().includes(q)
            || (f.body || "").toLowerCase().includes(q)
            || (f.author_handle || "").toLowerCase().includes(q);
        });
        return filtered.length === 0 ? (
          <div className="empty">{status === "open" ? "Новых сообщений нет ✦" : "Здесь пусто"}</div>
        ) : (
        <div className="reports-list">
          {filtered.map((f) => {
            const [emoji, label] = KIND[f.kind] || KIND.other;
            return (
              <div key={f.id} className="report-card card">
                <div className="rc-head">
                  <span className={`rc-icon fb-${f.kind}`}>{emoji}</span>
                  <div className="rc-headinfo">
                    <div className="rc-title">{f.title || label}</div>
                    <div className="rc-sub">{label}{f.where_at ? ` · ${f.where_at}` : ""} · {timeAgo(f.created_at)}</div>
                  </div>
                  {f.status === "open" && <span className="rc-pill pending">новое</span>}
                  {f.status === "resolved" && <span className="rc-pill resolved">решено</span>}
                  {f.status === "dismissed" && <span className="rc-pill dismissed">отклонено</span>}
                </div>

                <div className="rc-quote">
                  <div className="rc-author"><span className="rc-ava">{(f.author_name || "?")[0]?.toUpperCase()}</span>@{f.author_handle}</div>
                  <div className="rc-content fb-body">{f.body}</div>
                  {f.images?.length > 0 && <div className="fb-shots"><Gallery images={f.images} /></div>}
                </div>

                {f.status === "open" ? (
                  <div className="rc-actions">
                    <button className="btn ghost rc-dismiss" onClick={() => setItemStatus(f.id, "dismissed")}>Отклонить</button>
                    <button className="btn accent" onClick={() => setItemStatus(f.id, "resolved")}>Отметить решённым</button>
                  </div>
                ) : (
                  <div className="rc-actions"><button className="btn ghost" onClick={() => setItemStatus(f.id, "open")}>Вернуть в новые</button></div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}
