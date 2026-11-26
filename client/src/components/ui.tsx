/**
 * Componentes de interface reutilizáveis do SunHost.
 */
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/context/AppContext";
import { initials } from "@/lib/format";
import { Link, navigate } from "@/lib/router";
import { Icon } from "./Icon";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · SunHost Floripa` : "SunHost Floripa — Hospedagens com propósito";
  }, [title]);
}

// -----------------------------------------------------------------------------
// Modal acessível (Esc fecha, foco preso, rolagem da página travada)
// -----------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  footer?: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
    const focusFirst = window.setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, button:not(.modal-close)");
      (target || panel.current)?.focus();
    }, 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex='-1'])"));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-root" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div ref={panel} className={`modal modal-${size} ${className}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}>
        {title !== undefined && (
          <header className="modal-header">
            <h2 id={titleId}>{title}</h2>
            <button className="icon-btn modal-close" onClick={onClose} aria-label="Fechar">
              <Icon name="x" />
            </button>
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

// -----------------------------------------------------------------------------
// Diálogo de confirmação (com campo opcional de observação)
// -----------------------------------------------------------------------------
type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
};
type ConfirmState = ConfirmOptions & { resolve: (value: { note: string } | null) => void };

let openConfirm: ((state: ConfirmState) => void) | null = null;
export function confirmDialog(options: ConfirmOptions): Promise<{ note: string } | null> {
  return new Promise(resolve => {
    if (!openConfirm) return resolve(window.confirm(options.title) ? { note: "" } : null);
    openConfirm({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    openConfirm = next => {
      setNote("");
      setState(next);
    };
    return () => {
      openConfirm = null;
    };
  }, []);
  const close = (value: { note: string } | null) => {
    state?.resolve(value);
    setState(null);
  };
  return (
    <Modal
      open={Boolean(state)}
      onClose={() => close(null)}
      title={state?.title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => close(null)}>
            Voltar
          </button>
          <button className={`btn ${state?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close({ note: note.trim() })} data-autofocus>
            {state?.confirmLabel || "Confirmar"}
          </button>
        </>
      }
    >
      {state?.message && <div className="confirm-message">{state.message}</div>}
      {state?.noteLabel && (
        <label className="field">
          <span className="field-label">{state.noteLabel}</span>
          <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder={state.notePlaceholder} maxLength={500} />
        </label>
      )}
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Avisos (toasts)
// -----------------------------------------------------------------------------
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(item => (
        <div className={`toast toast-${item.kind}`} key={item.id}>
          <Icon name={item.kind === "error" ? "alert" : item.kind === "info" ? "info" : "check-circle"} size={18} />
          <span>{item.text}</span>
          <button className="toast-close" onClick={() => dismissToast(item.id)} aria-label="Fechar aviso">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Estrelas
// -----------------------------------------------------------------------------
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} de 5 estrelas`} role="img">
      {[1, 2, 3, 4, 5].map(star => {
        const fill = Math.max(0, Math.min(1, value - star + 1));
        return (
          <span className="star" key={star} style={{ width: size, height: size }}>
            <Icon name="star" size={size} strokeWidth={1.5} className="star-empty" />
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
              <Icon name="star" size={size} filled strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

const RATING_LABELS = ["", "Ruim", "Regular", "Boa", "Muito boa", "Excelente"];
export function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-input" role="radiogroup" aria-label="Sua nota" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          type="button"
          key={star}
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"} — ${RATING_LABELS[star]}`}
          className={star <= shown ? "on" : ""}
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(star)}
        >
          <Icon name="star" size={30} filled={star <= shown} strokeWidth={1.4} />
        </button>
      ))}
      <span className="star-input-label">{shown ? RATING_LABELS[shown] : "Toque para avaliar"}</span>
    </div>
  );
}

export function RatingBadge({ rating, count, compact = false }: { rating: number | null; count: number; compact?: boolean }) {
  if (rating === null || !count) return <span className="rating-badge is-new">Novo</span>;
  return (
    <span className="rating-badge">
      <Icon name="star" size={14} filled />
      <strong>{rating.toFixed(1).replace(".", ",")}</strong>
      {!compact && <span>({count})</span>}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Diversos
// -----------------------------------------------------------------------------
export function Avatar({ name, url, size = 40 }: { name: string; url?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : initials(name || "?")}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite" aria-label={label}>
        {value}
      </output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "compass", title, text, action }: { icon?: string; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Publicado",
  rejected: "Recusado",
  paused: "Pausado",
  confirmed: "Confirmada",
  upcoming: "Confirmada",
  ongoing: "Em andamento",
  completed: "Concluída",
  declined: "Recusada",
  cancelled: "Cancelada",
  published: "Publicada",
  hidden: "Oculta",
  open: "Aberta",
  resolved: "Resolvida",
  active: "Ativo",
  blocked: "Bloqueado",
  available: "Disponível",
  used: "Usado",
};
const STATUS_TONES: Record<string, string> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  paused: "gray",
  confirmed: "green",
  upcoming: "green",
  ongoing: "orange",
  completed: "gray",
  declined: "red",
  cancelled: "gray",
  published: "green",
  hidden: "gray",
  open: "amber",
  resolved: "green",
  active: "green",
  blocked: "red",
  available: "green",
  used: "gray",
};
export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`pill pill-${STATUS_TONES[status] || "gray"}`}>{label || STATUS_LABELS[status] || status}</span>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(item => (
        <button key={item.value} role="tab" aria-selected={value === item.value} className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}>
          {item.label}
          {item.count !== undefined && item.count > 0 && <span className="tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="listing-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

/** Exibe o conteúdo só para quem está logado (e, se preciso, é admin). */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useApp();
  useEffect(() => {
    if (ready && !user) navigate(`/entrar?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
  }, [ready, user]);
  if (!ready || !user) return <Spinner />;
  if (admin && user.role !== "admin")
    return (
      <div className="page container">
        <EmptyState icon="lock" title="Área restrita" text="Esta página é exclusiva da equipe de administração." action={<Link className="btn btn-primary" to="/">Voltar ao início</Link>} />
      </div>
    );
  return <>{children}</>;
}

export function PageHeader({ eyebrow, title, text, actions }: { eyebrow?: string; title: ReactNode; text?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
