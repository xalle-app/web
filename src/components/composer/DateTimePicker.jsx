import { useState, useEffect, useRef } from "react";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function parseValue(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DateTimePicker({ value, onChange, minDate, placeholder = "Выбрать дату и время" }) {
  const selected = parseValue(value);
  const now = new Date();
  const min = minDate ? new Date(minDate) : new Date(now.getTime() + 60000);

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((selected || min).getMonth());
  const [year, setYear] = useState((selected || min).getFullYear());
  const [pickDate, setPickDate] = useState(selected ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()) : null);
  const [hour, setHour] = useState(selected ? selected.getHours() : min.getHours());
  const [minute, setMinute] = useState(selected ? Math.ceil(selected.getMinutes() / 5) * 5 % 60 : Math.ceil(min.getMinutes() / 5) * 5 % 60);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const confirm = (d, h, m) => {
    const result = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    onChange(result.toISOString());
    setOpen(false);
  };

  const selectDay = (day) => {
    const d = new Date(year, month, day);
    setPickDate(d);
    // auto-confirm if we already have time
    confirm(d, hour, minute);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const isDisabled = (day) => {
    const d = new Date(year, month, day, 23, 59);
    return d < min;
  };

  const isSelected = (day) => pickDate && pickDate.getFullYear() === year && pickDate.getMonth() === month && pickDate.getDate() === day;
  const isToday = (day) => now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const updateTime = (h, m) => {
    setHour(h); setMinute(m);
    if (pickDate) confirm(pickDate, h, m);
  };

  return (
    <div className="dtp-wrap" ref={wrapRef}>
      <button type="button" className={`dtp-trigger ${open ? "open" : ""} ${selected ? "has-val" : ""}`} onClick={() => setOpen(v => !v)}>
        <span className="dtp-cal-ico">📅</span>
        <span className="dtp-display">{selected ? formatDisplay(selected) : <span className="dtp-placeholder">{placeholder}</span>}</span>
        {selected && (
          <button className="dtp-clear" type="button" onClick={e => { e.stopPropagation(); onChange(""); setPickDate(null); }}>✕</button>
        )}
        <span className="dtp-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="dtp-dropdown pop-in">
          {/* Calendar */}
          <div className="dtp-calendar">
            <div className="dtp-cal-head">
              <button className="dtp-nav" onClick={prevMonth}>‹</button>
              <span className="dtp-month-label">{MONTHS[month]} {year}</span>
              <button className="dtp-nav" onClick={nextMonth}>›</button>
            </div>
            <div className="dtp-days-header">
              {DAYS_SHORT.map(d => <span key={d} className="dtp-day-name">{d}</span>)}
            </div>
            <div className="dtp-grid">
              {Array.from({ length: firstDow }, (_, i) => <span key={"e"+i} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dis = isDisabled(day);
                const sel = isSelected(day);
                const tod = isToday(day);
                return (
                  <button
                    key={day} type="button"
                    className={`dtp-day ${sel ? "sel" : ""} ${tod && !sel ? "today" : ""} ${dis ? "dis" : ""}`}
                    onClick={() => !dis && selectDay(day)}
                    disabled={dis}
                  >{day}</button>
                );
              })}
            </div>
          </div>

          {/* Time selector — spinner style */}
          <div className="dtp-time">
            <span className="dtp-time-label">Время</span>
            <div className="dtp-time-spin">
              <div className="dtp-spin-col">
                <button type="button" className="dtp-spin-arrow" onClick={() => updateTime((hour + 23) % 24, minute)}>▲</button>
                <div className="dtp-spin-val">{String(hour).padStart(2, "0")}</div>
                <button type="button" className="dtp-spin-arrow" onClick={() => updateTime((hour + 1) % 24, minute)}>▼</button>
              </div>
              <span className="dtp-colon">:</span>
              <div className="dtp-spin-col">
                <button type="button" className="dtp-spin-arrow" onClick={() => updateTime(hour, (minute + 55) % 60)}>▲</button>
                <div className="dtp-spin-val">{String(minute).padStart(2, "0")}</div>
                <button type="button" className="dtp-spin-arrow" onClick={() => updateTime(hour, (minute + 5) % 60)}>▼</button>
              </div>
            </div>
          </div>

          {pickDate && (
            <div className="dtp-footer">
              <button className="btn accent dtp-confirm-btn" type="button" onClick={() => confirm(pickDate, hour, minute)}>
                Подтвердить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
