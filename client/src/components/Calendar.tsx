/**
 * Calendário de intervalo (check-in → check-out) com datas ocupadas bloqueadas.
 */
import { useMemo, useState } from "react";
import { MONTH_NAMES, toISODate, todayISO } from "@/lib/format";
import { Icon } from "./Icon";

type Range = { checkIn: string; checkOut: string };
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= total; day++) cells.push(toISODate(new Date(year, month, day)));
  return cells;
}

export function Calendar({
  value,
  onChange,
  booked = [],
  months = 2,
  minNights = 1,
}: {
  value: Range;
  onChange: (range: Range) => void;
  booked?: Range[];
  months?: number;
  minNights?: number;
}) {
  const today = todayISO();
  const initial = value.checkIn ? new Date(`${value.checkIn}T12:00:00`) : new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [hover, setHover] = useState("");

  const isBookedNight = useMemo(() => {
    return (date: string) => booked.some(range => date >= range.checkIn && date < range.checkOut);
  }, [booked]);
  const rangeIsFree = (start: string, end: string) => !booked.some(range => start < range.checkOut && range.checkIn < end);

  const pick = (date: string) => {
    const { checkIn, checkOut } = value;
    if (!checkIn || checkOut || date <= checkIn) {
      if (isBookedNight(date)) return;
      onChange({ checkIn: date, checkOut: "" });
      return;
    }
    if (!rangeIsFree(checkIn, date)) {
      if (!isBookedNight(date)) onChange({ checkIn: date, checkOut: "" });
      return;
    }
    onChange({ checkIn, checkOut: date });
  };

  const end = value.checkOut || (value.checkIn && hover > value.checkIn && rangeIsFree(value.checkIn, hover) ? hover : "");
  const shift = (delta: number) =>
    setCursor(current => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  const now = new Date();
  const atStart = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  return (
    <div className="calendar" onMouseLeave={() => setHover("")}>
      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} disabled={atStart} aria-label="Mês anterior">
          <Icon name="chevron-left" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
      <div className="calendar-months" style={{ gridTemplateColumns: `repeat(${months}, minmax(0, 1fr))` }}>
        {Array.from({ length: months }).map((_, offset) => {
          const date = new Date(cursor.year, cursor.month + offset, 1);
          const year = date.getFullYear();
          const month = date.getMonth();
          return (
            <div className="calendar-month" key={`${year}-${month}`}>
              <strong className="calendar-title">
                {MONTH_NAMES[month]} {year}
              </strong>
              <div className="calendar-grid">
                {WEEKDAYS.map((day, index) => (
                  <span className="calendar-weekday" key={index}>
                    {day}
                  </span>
                ))}
                {monthDays(year, month).map((day, index) => {
                  if (!day) return <span key={`e${index}`} />;
                  const past = day < today;
                  const bookedNight = isBookedNight(day);
                  const isStart = day === value.checkIn;
                  const isEnd = day === end;
                  const inRange = value.checkIn && end && day > value.checkIn && day < end;
                  const tooShort = value.checkIn && !value.checkOut && day > value.checkIn && minNights > 1 && Math.round((Date.parse(day) - Date.parse(value.checkIn)) / 86400000) < minNights;
                  const disabled = past || (bookedNight && !(value.checkIn && !value.checkOut && day > value.checkIn && rangeIsFree(value.checkIn, day)));
                  return (
                    <button
                      type="button"
                      key={day}
                      className={`calendar-day${isStart ? " is-start" : ""}${isEnd ? " is-end" : ""}${inRange ? " in-range" : ""}${bookedNight ? " is-booked" : ""}${tooShort ? " too-short" : ""}`}
                      disabled={Boolean(disabled || tooShort)}
                      onClick={() => pick(day)}
                      onMouseEnter={() => setHover(day)}
                      aria-pressed={isStart || isEnd}
                      aria-label={`${Number(day.slice(8))} de ${MONTH_NAMES[month]}${bookedNight ? " (ocupado)" : ""}`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
