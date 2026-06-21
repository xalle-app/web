import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { EMOJI_CATEGORIES } from "../../lib/format.js";

export default function EmojiPicker({ anchorRef, onPick, onClose }) {
  const ref = useRef(null);
  const searchRef = useRef(null);
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState({ visibility: "hidden" });

  useEffect(() => {
    const place = () => {
      const a = anchorRef?.current, el = ref.current;
      if (!a || !el) return;
      const ar = a.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      const margin = 8, vw = window.innerWidth, vh = window.innerHeight;
      let top = ar.top - h - margin;
      if (top < margin) top = Math.min(ar.bottom + margin, vh - h - margin);
      let left = ar.left;
      if (left + w > vw - margin) left = vw - w - margin;
      if (left < margin) left = margin;
      setStyle({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchorRef]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", key); };
  }, [onClose, anchorRef]);

  // Do not auto-focus search — on mobile this opens the keyboard immediately

  const activeCat = EMOJI_CATEGORIES.find((c) => c.id === cat) || EMOJI_CATEGORIES[0];

  const displayEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => {
        const q = search.toLowerCase();
        return e.includes(q);
      }).slice(0, 60)
    : activeCat.emojis;

  const catLabel = search.trim() ? `Результаты: ${displayEmojis.length}` : `${activeCat.name} · ${activeCat.emojis.length}`;

  return createPortal(
    <div className="emoji-pop pop-in" ref={ref} style={style}>
      <div className="emoji-search-row">
        <Search size={13} className="emoji-search-ico" />
        <input
          ref={searchRef}
          className="emoji-search"
          placeholder="Поиск…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="emoji-search-clear" onClick={() => setSearch("")}>✕</button>}
      </div>
      {!search && (
        <div className="emoji-tabs">
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`emoji-tab ${cat === c.id ? "on" : ""}`}
              onClick={() => setCat(c.id)}
              title={c.name}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-cat-label">{catLabel}</div>
      <div className="emoji-grid">
        {displayEmojis.length === 0
          ? <div className="emoji-empty">Ничего не найдено</div>
          : displayEmojis.map((e, idx) => (
              <button key={e + idx} className="emoji-cell" onClick={() => onPick(e)}>{e}</button>
            ))
        }
      </div>
      <div className="emoji-footer">
        <button className="emoji-done" onClick={onClose}>Готово</button>
      </div>
    </div>,
    document.body
  );
}
