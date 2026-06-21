import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);
export const useConfirm = () => useContext(UIContext).confirm;
export const useToast = () => useContext(UIContext).toast;

let TOAST_ID = 0;
const ANIM_OUT = 350;

function Toast({ t, onRemove }) {
  const [phase, setPhase] = useState("in"); // in | visible | out
  const timerRef = useRef(null);

  useEffect(() => {
    // Start exit animation before removal
    timerRef.current = setTimeout(() => {
      setPhase("out");
      setTimeout(() => onRemove(t.id), ANIM_OUT);
    }, t.duration - ANIM_OUT);
    return () => clearTimeout(timerRef.current);
  }, []);

  const ico = t.type === "success" ? "✓" : t.type === "error" ? "!" : t.type === "warn" ? "⚠" : "✦";

  return (
    <div
      className={`toast toast-${t.type} toast-${phase}`}
      style={{ "--dur": `${t.duration}ms` }}
      onClick={() => { clearTimeout(timerRef.current); setPhase("out"); setTimeout(() => onRemove(t.id), ANIM_OUT); }}
    >
      <span className="toast-ico">{ico}</span>
      <span className="toast-msg">{t.message}</span>
      <div className="toast-bar" />
    </div>
  );
}

export function UIProvider({ children, toastPosition = "bottom-center" }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialog({ okText: "Да", cancelText: "Отмена", ...opts });
    });
  }, []);
  const close = (val) => { setDialog(null); resolver.current?.(val); resolver.current = null; };

  const toast = useCallback((message, { type = "info", duration = 3500 } = {}) => {
    const id = ++TOAST_ID;
    setToasts((cur) => [...cur, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  return (
    <UIContext.Provider value={{ confirm, toast }}>
      {children}

      {dialog && createPortal(
        <div className="confirm-overlay fade-in" onClick={() => close(false)}>
          <div className={`confirm-box pop-in ${dialog.danger ? "danger" : ""}`} onClick={(e) => e.stopPropagation()}>
            {dialog.title && <h3>{dialog.title}</h3>}
            {dialog.message && <p>{dialog.message}</p>}
            <div className="confirm-actions">
              <button className="btn ghost" onClick={() => close(false)}>{dialog.cancelText}</button>
              <button className={`btn ${dialog.danger ? "danger-solid" : "accent"}`} onClick={() => close(true)}>{dialog.okText}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {createPortal(
        <div className={`toast-stack ${toastPosition}`}>
          {toasts.map((t) => (
            <Toast key={t.id} t={t} onRemove={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </UIContext.Provider>
  );
}
