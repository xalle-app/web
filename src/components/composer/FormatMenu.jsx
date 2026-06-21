import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Tip from "../shared/Tip.jsx";

// Оборачивает выделенный текст в Markdown-разметку, при повторном применении — снимает её
export function wrapSelection(el, before, after, setValue) {
  const start = el.selectionStart, end = el.selectionEnd;
  const val = el.value;
  if (start === end) return;
  const sel = val.slice(start, end);

  // Check if the selection itself is already wrapped (e.g. **bold** selected as **text**)
  const selWrapped = sel.startsWith(before) && (after ? sel.endsWith(after) : true);
  // Check if the text around the selection is wrapped
  const outerWrapped =
    val.slice(start - before.length, start) === before &&
    (after ? val.slice(end, end + after.length) === after : true);

  if (selWrapped && !outerWrapped) {
    // Selection includes the markers — strip them from inside
    const inner = sel.slice(before.length, after ? sel.length - after.length : undefined);
    setValue(val.slice(0, start) + inner + val.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = start + inner.length;
    });
  } else if (outerWrapped) {
    // Markers are outside the selection — remove them
    const newStart = start - before.length;
    const newEnd = end + (after ? after.length : 0);
    setValue(val.slice(0, newStart) + sel + val.slice(newEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = newStart;
      el.selectionEnd = newStart + sel.length;
    });
  } else {
    // Apply formatting
    const next = val.slice(0, start) + before + sel + after + val.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = end + before.length;
    });
  }
}

export default function FormatMenu({ x, y, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const items = [
    ["Ж", "Жирный", "**", "**", { fontWeight: 700 }],
    ["К", "Курсив", "*", "*", { fontStyle: "italic" }],
    ["S", "Зачёркнутый", "~~", "~~", { textDecoration: "line-through" }],
    ["</>", "Код", "```", "```", { fontFamily: "var(--font-mono)", fontSize: 12 }],
    ["❝", "Цитата", "> ", "", {}],
    ["👁", "Спойлер", "||", "||", {}],
  ];
  return createPortal(
    <div className="format-menu pop-in" ref={ref} style={{ left: x, top: y }}>
      {items.map(([label, title, b, a, st]) => (
        <Tip key={title} content={title} pos="top">
          <button onMouseDown={(e) => { e.preventDefault(); onPick(b, a); }} style={st}>{label}</button>
        </Tip>
      ))}
    </div>,
    document.body
  );
}

// Хук: подключает контекстное меню форматирования к полю (textarea/input)
export function useFormatMenu(setValue) {
  const fieldRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const onContextMenu = (e) => {
    const el = fieldRef.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };
  // Длинное нажатие на сенсорных экранах
  const lpTimer = useRef(null);
  const onTouchStart = (e) => {
    lpTimer.current = setTimeout(() => {
      const el = fieldRef.current;
      if (!el || el.selectionStart === el.selectionEnd) return;
      const t = e.touches?.[0];
      setMenu({ x: t ? t.clientX : window.innerWidth / 2, y: t ? t.clientY - 50 : 200 });
    }, 500);
  };
  const cancelLong = () => { clearTimeout(lpTimer.current); };
  const pick = (before, after) => {
    if (fieldRef.current) wrapSelection(fieldRef.current, before, after, setValue);
    // menu stays open so user can apply multiple formats in sequence
  };
  const formatMenu = menu ? <FormatMenu x={menu.x} y={menu.y} onPick={pick} onClose={() => setMenu(null)} /> : null;
  return { fieldRef, onContextMenu, onTouchStart, onTouchEnd: cancelLong, onTouchMove: cancelLong, formatMenu };
}
