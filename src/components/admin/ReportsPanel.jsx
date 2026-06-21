import { useState, useEffect, useCallback } from "react";
import { BookAlert } from "lucide-react";
import { api } from "../../lib/api.js";
import { timeAgo } from "../../lib/format.js";
import Md from "../shared/Markdown.jsx";
import { useToast } from "../shared/ui.jsx";
import { HeroHeader } from "../shared/HeroHeader.jsx";

const REASON_TABS = [["pending", "Новые"], ["resolved", "Принятые"], ["dismissed", "Отклонённые"]];

export default function ReportsPanel({ token, onOpenPost, onPendingChange }) {
  const [status, setStatus] = useState("pending");
  const [reports, setReports] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const toast = useToast();

  const load = useCallback(() => {
    api(`/mod/reports?status=${status}`, { token })
      .then((d) => { setReports(d.reports); onPendingChange?.(d.pending); })
      .catch(() => setReports([]));
  }, [status, token, onPendingChange]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    try {
      const d = await api(`/mod/reports/${id}/resolve`, { method: "POST", token, body: { action, resolution } });
      toast(action === "resolve" ? "Жалоба удовлетворена" : "Жалоба отклонена", { type: "info" });
      setResolving(null); setResolution("");
      onPendingChange?.(d.pending);
      load();
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  return (
    <div className="screen reports-screen">

      <HeroHeader
        icon={<BookAlert size={32} />}
        title="Жалобы"
        subtitle="Модерация жалоб на пользователей, посты и комментарии"
      />

      <div className="panel-filters">
        <div className="panel-filters-row">
          <div className="seg">
            {REASON_TABS.map(([v, l]) => (
              <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
          <div className="panel-type-seg">
            <button className={!typeFilter ? "on" : ""} onClick={() => setTypeFilter("")}>Все</button>
            <button className={typeFilter === "post" ? "on" : ""} onClick={() => setTypeFilter("post")}>📄 Посты</button>
            <button className={typeFilter === "comment" ? "on" : ""} onClick={() => setTypeFilter("comment")}>💬 Комменты</button>
            <button className={typeFilter === "user" ? "on" : ""} onClick={() => setTypeFilter("user")}>👤 Юзеры</button>
            <button className={typeFilter === "group" ? "on" : ""} onClick={() => setTypeFilter("group")}>🏠 Беседы</button>
            <button className={typeFilter === "group_message" ? "on" : ""} onClick={() => setTypeFilter("group_message")}>📨 Сообщения</button>
          </div>
        </div>
        <input className="panel-search" placeholder="🔍 Поиск по причине, нику, содержимому…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {reports === null ? (
        <div className="empty">Загрузка…</div>
      ) : (() => {
        const q = search.toLowerCase();
        const filtered = reports.filter(r => {
          if (typeFilter && r.target_type !== typeFilter) return false;
          if (!q) return true;
          return (r.reason || "").toLowerCase().includes(q)
            || (r.reporter_handle || "").toLowerCase().includes(q)
            || (r.target?.author_handle || "").toLowerCase().includes(q)
            || (r.target?.body || "").toLowerCase().includes(q);
        });
        return filtered.length === 0 ? (
          <div className="empty">{status === "pending" ? "Новых жалоб нет ✦" : "Здесь пусто"}</div>
        ) : (
        <div className="reports-list">
          {filtered.map((r) => (
            <div key={r.id} className="report-card card">
              <div className="rc-head">
                <span className={`rc-icon t-${r.target_type}`}>
                  {r.target_type === "post" ? "📄" : r.target_type === "user" ? "👤" : r.target_type === "group" ? "🏠" : r.target_type === "group_message" ? "📨" : "💬"}
                </span>
                <div className="rc-headinfo">
                  <div className="rc-title">{r.reason || "Без причины"}</div>
                  <div className="rc-sub">
                    {r.target_type === "post" ? "Жалоба на пост"
                      : r.target_type === "user" ? "Жалоба на пользователя"
                      : r.target_type === "group" ? "Жалоба на беседу"
                      : r.target_type === "group_message" ? "Жалоба на сообщение в беседе"
                      : "Жалоба на комментарий"} · {timeAgo(r.created_at)}
                  </div>
                </div>
                {r.status === "pending" && <span className="rc-pill pending">новая</span>}
                {r.status === "resolved" && <span className="rc-pill resolved">принята</span>}
                {r.status === "dismissed" && <span className="rc-pill dismissed">отклонена</span>}
              </div>

              <div className="rc-quote">
                {r.target.gone ? (
                  <div className="rc-gone">⊘ Контент уже удалён</div>
                ) : (
                  <>
                    <div className="rc-author"><span className="rc-ava">{(r.target.author_name || "?")[0]?.toUpperCase()}</span>@{r.target.author_handle}</div>
                    <div className="rc-content"><Md className="md">{r.target.body || "(пусто)"}</Md></div>
                  </>
                )}
              </div>

              <div className="rc-foot">
                <span className="rc-reporter">⚑ от @{r.reporter_handle}</span>
                {r.status !== "pending" && r.resolution && <span className="rc-resolution">«{r.resolution}»</span>}
                {r.status === "pending" && !r.target.gone && r.target.post_id && (
                  <button className="rc-open" onClick={() => onOpenPost(r.target.post_id, r.target.comment_id)}>Открыть →</button>
                )}
              </div>

              {r.status === "pending" && (
                resolving === r.id ? (
                  <div className="rc-resolve">
                    <input placeholder="Комментарий к решению (необязательно)" value={resolution} onChange={(e) => setResolution(e.target.value)} autoFocus />
                    <div className="rc-actions">
                      <button className="btn ghost" onClick={() => { setResolving(null); setResolution(""); }}>Отмена</button>
                      <button className="btn ghost rc-dismiss" onClick={() => resolve(r.id, "dismiss")}>Отклонить</button>
                      <button className="btn danger-solid" onClick={() => resolve(r.id, "resolve")}>Удовлетворить</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn accent rc-review" onClick={() => setResolving(r.id)}>Разобрать жалобу</button>
                )
              )}
            </div>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
