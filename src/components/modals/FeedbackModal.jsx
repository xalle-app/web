import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { api, uploadImages } from "../../lib/api.js";
import { useToast } from "../shared/ui.jsx";

const KINDS = [["bug", "🐞 Баг"], ["idea", "💡 Идея"], ["other", "💬 Другое"]];

export default function FeedbackModal({ token, onClose }) {
  const [kind, setKind] = useState("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [where, setWhere] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const addFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(Array.from(files).slice(0, 4 - images.length), token);
      setImages((cur) => [...cur, ...urls].slice(0, 4));
    } catch (e) { toast("Не удалось загрузить фото", { type: "error" }); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!body.trim()) { toast("Опиши, что случилось", { type: "warn" }); return; }
    setBusy(true);
    try {
      await api("/feedback", { method: "POST", token, body: { kind, title, body, where, images } });
      toast("Спасибо! Сообщение отправлено команде", { type: "success" });
      onClose();
    } catch (e) { toast(e.message, { type: "error" }); setBusy(false); }
  };

  const bodyHint = kind === "bug"
    ? "Что произошло? Что ожидалось? Шаги для воспроизведения…"
    : kind === "idea" ? "Опиши свою идею — что и зачем улучшить" : "Расскажи подробнее";

  return createPortal(
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal feedback-modal pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Сообщить о проблеме</h3><button className="btn ghost" onClick={onClose}>✕</button></div>
        <p className="hint">Нашёл баг или есть идея? Опиши подробно — это помогает делать Xalle лучше.</p>

        <div className="fb-kinds">
          {KINDS.map(([v, l]) => <button key={v} className={`fb-kind ${kind === v ? "on" : ""}`} onClick={() => setKind(v)}>{l}</button>)}
        </div>

        <label className="fb-label">Кратко</label>
        <input className="fb-input" placeholder="Например: не отправляется коммент" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />

        <label className="fb-label">Где это произошло</label>
        <input className="fb-input" placeholder="Например: лента / профиль / настройки" value={where} onChange={(e) => setWhere(e.target.value)} maxLength={120} />

        <label className="fb-label">Подробное описание</label>
        <textarea className="fb-textarea" placeholder={bodyHint} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} />

        <div className="fb-media">
          {images.map((src, i) => (
            <div key={i} className="fb-thumb"><img src={src} alt="" /><button onClick={() => setImages((c) => c.filter((_, idx) => idx !== i))}>✕</button></div>
          ))}
          {images.length < 4 && (
            <button className="fb-add" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "…" : "+ фото"}</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>

        <div className="confirm-actions">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn accent" onClick={submit} disabled={busy || !body.trim()}>Отправить</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
