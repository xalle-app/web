import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { useToast } from "../shared/ui.jsx";

const REASONS = ["Спам", "Оскорбления", "Дезинформация", "Неприемлемый контент", "Другое"];

export default function ReportDialog({ targetType, targetId, token, onClose }) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    const finalReason = reason === "Другое" ? custom.trim() : reason;
    if (!finalReason) { toast("Укажи причину", { type: "warn" }); return; }
    setBusy(true);
    try {
      const r = await api("/report", { method: "POST", token, body: { targetType, targetId, reason: finalReason } });
      toast(r.duplicate ? "Вы уже жаловались на это" : "Жалоба отправлена модераторам", { type: r.duplicate ? "info" : "success" });
      onClose();
    } catch (e) { toast(e.message, { type: "error" }); setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal report-modal pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Пожаловаться</h3><button className="btn ghost" onClick={onClose}>✕</button></div>
        <p className="hint">Расскажи, что не так с этим {targetType === "post" ? "постом" : "комментарием"}. Жалобу рассмотрят модераторы.</p>
        <div className="report-reasons">
          {REASONS.map((r) => (
            <button key={r} className={`report-reason ${reason === r ? "on" : ""}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        {reason === "Другое" && (
          <input className="report-custom" placeholder="Опиши причину" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} autoFocus />
        )}
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn danger-solid" onClick={submit} disabled={busy || !reason}>Отправить</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
