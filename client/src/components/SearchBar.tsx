/**
 * Barra de busca: destino, datas (calendário) e número de hóspedes.
 */
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { DISTRICTS } from "@shared/catalog";
import { dateRange, shortDate } from "@/lib/format";
import { navigate } from "@/lib/router";
import { Calendar } from "./Calendar";
import { Icon } from "./Icon";
import { Stepper } from "./ui";

export function Popover({ open, onClose, children, className = "", anchor }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; anchor: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);
  if (!open) return null;
  return (
    <div ref={ref} className={`popover ${className}`}>
      {children}
    </div>
  );
}

export function useIsMobile(breakpoint = 760) {
  const [mobile, setMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}

export type SearchValues = { q: string; checkIn: string; checkOut: string; guests: number };

export function SearchBar({ initial, variant = "hero", onSearch }: { initial?: Partial<SearchValues>; variant?: "hero" | "compact"; onSearch?: (values: SearchValues) => void }) {
  const [values, setValues] = useState<SearchValues>({ q: "", checkIn: "", checkOut: "", guests: 0, ...initial });
  const [open, setOpen] = useState<"" | "dates" | "guests">("");
  const datesRef = useRef<HTMLButtonElement>(null);
  const guestsRef = useRef<HTMLButtonElement>(null);
  const mobile = useIsMobile();

  useEffect(() => {
    if (initial) setValues(current => ({ ...current, ...initial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.q, initial?.checkIn, initial?.checkOut, initial?.guests]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setOpen("");
    if (onSearch) return onSearch(values);
    const params = new URLSearchParams();
    if (values.q.trim()) params.set("q", values.q.trim());
    if (values.checkIn && values.checkOut) {
      params.set("checkIn", values.checkIn);
      params.set("checkOut", values.checkOut);
    }
    if (values.guests) params.set("guests", String(values.guests));
    navigate(`/explorar${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <form className={`searchbar searchbar-${variant}`} onSubmit={submit} role="search">
      <label className="search-seg search-where">
        <Icon name="pin" size={20} />
        <span>
          <small>Destino</small>
          <input value={values.q} onChange={event => setValues({ ...values, q: event.target.value })} placeholder="Bairro, praia ou tipo de espaço" list="sunhost-districts" aria-label="Destino" />
        </span>
      </label>
      <datalist id="sunhost-districts">
        {DISTRICTS.map(district => (
          <option value={district} key={district} />
        ))}
      </datalist>
      <span className="search-divider" />
      <div className="search-seg-wrap">
        <button type="button" ref={datesRef} className="search-seg search-when" onClick={() => setOpen(open === "dates" ? "" : "dates")} aria-expanded={open === "dates"}>
          <Icon name="calendar" size={20} />
          <span>
            <small>Datas</small>
            <strong className={values.checkIn ? "" : "placeholder"}>{values.checkIn ? dateRange(values.checkIn, values.checkOut) || shortDate(values.checkIn) : "Quando?"}</strong>
          </span>
        </button>
        <Popover open={open === "dates"} onClose={() => setOpen("")} anchor={datesRef} className="popover-dates">
          <Calendar value={values} months={mobile ? 1 : 2} onChange={range => {
            setValues({ ...values, ...range });
            if (range.checkOut) window.setTimeout(() => setOpen(""), 180);
          }} />
          <div className="popover-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValues({ ...values, checkIn: "", checkOut: "" })}>
              Limpar datas
            </button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen("")}>
              Pronto
            </button>
          </div>
        </Popover>
      </div>
      <span className="search-divider" />
      <div className="search-seg-wrap">
        <button type="button" ref={guestsRef} className="search-seg search-who" onClick={() => setOpen(open === "guests" ? "" : "guests")} aria-expanded={open === "guests"}>
          <Icon name="users" size={20} />
          <span>
            <small>Hóspedes</small>
            <strong className={values.guests ? "" : "placeholder"}>{values.guests ? `${values.guests} ${values.guests === 1 ? "hóspede" : "hóspedes"}` : "Quantos?"}</strong>
          </span>
        </button>
        <Popover open={open === "guests"} onClose={() => setOpen("")} anchor={guestsRef} className="popover-guests">
          <div className="guest-row">
            <div>
              <strong>Hóspedes</strong>
              <small>Adultos e crianças</small>
            </div>
            <Stepper value={values.guests} onChange={guests => setValues({ ...values, guests })} min={0} max={16} label="hóspedes" />
          </div>
        </Popover>
      </div>
      <button className="search-submit" type="submit" aria-label="Buscar acomodações">
        <Icon name="search" size={20} strokeWidth={2.2} />
        <span>Buscar</span>
      </button>
    </form>
  );
}
