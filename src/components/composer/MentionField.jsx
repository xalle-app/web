import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { api } from "../../lib/api.js";
import { Name, Avatar } from "../shared/icons.jsx";

// Авторасширяемое текстовое поле с @-автодополнением и опциональным ПКМ-форматированием.
// Используется и в композере, и в комментариях/ответах.
const MentionField = forwardRef(function MentionField(
  { value, onChange, onEnter, token, placeholder, maxLength, minRows = 1, onContextMenu, onTouchStart, onTouchEnd, onTouchMove, className = "", hint },
  outerRef
) {
  const taRef = useRef(null);
  const boxRef = useRef(null);
  const [suggest, setSuggest] = useState(null); // { items, start, query, active }

  useImperativeHandle(outerRef, () => taRef.current, []);

  // авто-высота
  const grow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 260) + "px";
  };
  useEffect(grow, [value]);

  // ищем @слово прямо перед курсором
  const detectMention = () => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const current = ta.value; // берём актуальное значение из DOM, не из устаревшего стейта
    const upto = current.slice(0, caret);
    const m = upto.match(/(^|\s)@([\wа-яёА-ЯЁ]{1,20})$/u);
    if (!m) { setSuggest(null); return; }
    const query = m[2];
    const start = caret - query.length - 1; // позиция символа @
    api(`/users/search?q=${encodeURIComponent(query)}`, { token })
      .then((items) => setSuggest(items.length ? { items, start, query, active: 0 } : null))
      .catch(() => setSuggest(null));
  };

  const applyMention = (handle) => {
    const ta = taRef.current;
    const caret = ta.selectionStart;
    const current = ta.value;
    const next = current.slice(0, suggest.start) + "@" + handle + " " + current.slice(caret);
    onChange(next);
    setSuggest(null);
    const newCaret = suggest.start + handle.length + 2;
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = newCaret; });
  };

  const onKeyDown = (e) => {
    if (suggest) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSuggest((s) => ({ ...s, active: (s.active + 1) % s.items.length })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSuggest((s) => ({ ...s, active: (s.active - 1 + s.items.length) % s.items.length })); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyMention(suggest.items[suggest.active].handle); return; }
      if (e.key === "Escape") { setSuggest(null); return; }
    }
    // Enter отправляет, Shift+Enter — перенос строки
    if (e.key === "Enter" && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); }
  };

  return (
    <div className="mention-field" ref={boxRef}>
      <textarea
        ref={taRef}
        className={className}
        rows={minRows}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => { onChange(e.target.value); detectMention(); }}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onBlur={() => setTimeout(() => setSuggest(null), 120)}
      />
      {hint && <div className="field-hint">{hint}</div>}
      {suggest && (
        <div className="mention-pop">
          {suggest.items.map((u, idx) => (
            <button key={u.handle} className={`mention-item ${idx === suggest.active ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); applyMention(u.handle); }}>
              <Avatar url={u.avatar_url} name={u.name} size="sm" />
              <div className="mi-info">
                <Name className="mi-name" name={u.name} verified={u.verified} role={u.role} />
                <span className="mi-handle">@{u.handle}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default MentionField;
