import { useRef, useState, useCallback } from "react";

/**
 * Bottom sheet с поддержкой свайпа вниз для закрытия.
 * На десктопе рендерит как обычный positioned popup.
 * На мобиле — полноэкранный лист снизу с drag-to-dismiss.
 */
export default function BottomSheet({ children, onClose, style }) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ active: false, startY: 0, currentY: 0 });
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = useCallback((e) => {
    dragRef.current = { active: true, startY: e.touches[0].clientY, currentY: 0 };
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.startY);
    dragRef.current.currentY = dy;
    setTranslateY(dy);
  }, []);

  const onTouchEnd = useCallback(() => {
    const { currentY } = dragRef.current;
    dragRef.current.active = false;
    setDragging(false);
    if (currentY > 100) {
      onClose();
    } else {
      setTranslateY(0);
    }
  }, [onClose]);

  return (
    <>
      <div className="post-ctx-overlay" onClick={onClose} />
      <div
        ref={sheetRef}
        className="post-ctx-menu"
        style={{
          ...style,
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </>
  );
}
