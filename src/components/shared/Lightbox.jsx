import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Tip from "./Tip.jsx";
import { isVideoUrl } from "../../lib/api.js";
import VideoPlayer from "./VideoPlayer.jsx";
import { assetUrl } from "../../lib/config.js";

function Lightbox({ images, index, onClose }) {
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const pinch = useRef(null);

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const go = (delta) => { setI((p) => (p + delta + images.length) % images.length); reset(); };
  const zoomBy = (f) => setScale((s) => Math.min(5, Math.max(1, +(s * f).toFixed(2))));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && images.length > 1) go(1);
      else if (e.key === "ArrowLeft" && images.length > 1) go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onWheel = (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 0.87); };
  const onDown = (e) => { if (scale <= 1) return; e.preventDefault(); drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = (e) => { if (!drag.current) return; setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), s: scale };
    else if (e.touches.length === 1 && scale > 1) drag.current = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y };
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const f = dist(e.touches) / pinch.current.d;
      setScale(Math.min(5, Math.max(1, +(pinch.current.s * f).toFixed(2))));
    } else if (e.touches.length === 1 && drag.current) {
      setPos({ x: e.touches[0].clientX - drag.current.x, y: e.touches[0].clientY - drag.current.y });
    }
  };
  const onTouchEnd = () => { pinch.current = null; drag.current = null; };

  return createPortal(
    <div className="lightbox fade-in" onClick={onClose} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
      <div className="lb-toolbar" onClick={(e) => e.stopPropagation()}>
        <Tip content="Отдалить (−)" pos="bottom"><button onClick={() => zoomBy(0.8)}>−</button></Tip>
        <span className="lb-zoom">{Math.round(scale * 100)}%</span>
        <Tip content="Приблизить (+)" pos="bottom"><button onClick={() => zoomBy(1.25)}>+</button></Tip>
        <Tip content="Сбросить (0)" pos="bottom"><button onClick={reset}>⤢</button></Tip>
        <Tip content="Закрыть (Esc)" pos="bottom"><button onClick={onClose}>✕</button></Tip>
      </div>
      {images.length > 1 && (
        <>
          <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Назад">‹</button>
          <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Вперёд">›</button>
          <div className="lb-counter" onClick={(e) => e.stopPropagation()}>{i + 1} / {images.length}</div>
        </>
      )}
      <img
        className="lb-img" src={images[i]} alt="" draggable="false"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel} onMouseDown={onDown}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={() => (scale > 1 ? reset() : zoomBy(2))}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in" }}
      />
    </div>,
    document.body
  );
}

function imgUrl(item) { return assetUrl(typeof item === "string" ? item : item?.url || ""); }
function imgIsVideo(item) { return typeof item === "string" ? isVideoUrl(item) : item?.type === "video"; }

export default function Gallery({ images }) {
  const [lbIndex, setLbIndex] = useState(null);
  if (!images?.length) return null;
  const photoUrls = images.filter(i => !imgIsVideo(i)).map(imgUrl);
  let photoIdx = -1;
  return (
    <>
      <div className={`gallery g-${Math.min(images.length, 4)}`}>
        {images.map((item, i) => {
          const src = imgUrl(item);
          const isVid = imgIsVideo(item);
          if (!isVid) photoIdx++;
          const pi = photoIdx;
          return isVid
            ? <VideoPlayer key={i} src={src} className="gallery-video-wrap" />
            : <img key={i} src={src} alt="" loading="lazy" onClick={() => setLbIndex(pi)} />;
        })}
      </div>
      {lbIndex !== null && <Lightbox images={photoUrls} index={lbIndex} onClose={() => setLbIndex(null)} />}
    </>
  );
}
