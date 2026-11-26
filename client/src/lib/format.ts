const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const brl = (value: number) => currency.format(value).replace(/ /g, " ");

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** 'AAAA-MM-DD' → '12 de nov' */
export function shortDate(date: string) {
  if (!date) return "";
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const current = new Date().getFullYear();
  return `${day} ${MONTHS[month - 1]}${year !== current ? ` ${year}` : ""}`;
}

export function dateRange(checkIn: string, checkOut: string) {
  if (!checkIn) return "";
  if (!checkOut) return shortDate(checkIn);
  return `${shortDate(checkIn)} – ${shortDate(checkOut)}`;
}

export function longDate(iso: string) {
  if (!iso) return "";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function monthYear(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return longDate(iso);
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Data local no formato AAAA-MM-DD. */
export function toISODate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export const todayISO = () => toISODate(new Date());
export function addDaysISO(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return toISODate(value);
}
export function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86400000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

export function formatPhone(digits: string) {
  const value = digits.replace(/\D/g, "");
  const local = value.length > 11 ? value.slice(-11) : value;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function whatsappLink(digits: string, message: string) {
  const value = digits.replace(/\D/g, "");
  const full = value.length <= 11 ? `55${value}` : value;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}
