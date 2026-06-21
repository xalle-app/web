import { useState, useRef } from "react";
import { createPortal } from "react-dom";

let TOOLTIP_ID = 0;

// Estimate tooltip dimensions for pre-render space checks
const EST_W = 160;
const EST_H = 34;
const GAP = 9;   // gap between anchor and tooltip
const MARGIN = 8; // min distance from viewport edge

function pickPos(r, preferred) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const space = {
    top:    r.top    - GAP - EST_H,
    bottom: vh - r.bottom - GAP - EST_H,
    left:   r.left   - GAP - EST_W,
    right:  vw - r.right - GAP - EST_W,
  };

  // If preferred fits, use it
  if (space[preferred] >= MARGIN) return preferred;

  // Otherwise pick the direction with the most room
  const order =
    preferred === "top"    ? ["bottom", "right", "left"] :
    preferred === "bottom" ? ["top",    "right", "left"] :
    preferred === "left"   ? ["right",  "top",   "bottom"] :
                             ["left",   "top",   "bottom"];

  for (const p of order) {
    if (space[p] >= MARGIN) return p;
  }
  // Fallback: most space
  return Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
}

function calcCoords(r, pos) {
  if (pos === "top")    return { x: r.left + r.width / 2,  y: r.top };
  if (pos === "bottom") return { x: r.left + r.width / 2,  y: r.bottom };
  if (pos === "left")   return { x: r.left,                y: r.top + r.height / 2 };
  /* right */           return { x: r.right,               y: r.top + r.height / 2 };
}

export default function Tip({ content, children, pos = "top", className }) {
  const [show, setShow]           = useState(false);
  const [coords, setCoords]       = useState({ x: 0, y: 0 });
  const [actualPos, setActualPos] = useState(pos);
  const ref  = useRef(null);
  const idRef = useRef(`tip-${++TOOLTIP_ID}`);

  const place = () => {
    const el = ref.current;
    if (!el) return;
    let r = el.getBoundingClientRect();
    if (!r.width && el.firstElementChild) r = el.firstElementChild.getBoundingClientRect();

    const best = pickPos(r, pos);
    setActualPos(best);
    setCoords(calcCoords(r, best));
  };

  const open  = () => { place(); setShow(true); };
  const close = () => setShow(false);

  if (!content) return children;
  return (
    <>
      <span ref={ref} className={className} style={{ display: "inline-flex", alignItems: "center" }}
        onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close}
        aria-describedby={show ? idRef.current : undefined}>
        {children}
      </span>
      {show && createPortal(
        <span id={idRef.current} role="tooltip"
          className={`tip tip-${actualPos}`}
          style={{ left: coords.x, top: coords.y }}>
          {content}
        </span>,
        document.body
      )}
    </>
  );
}
