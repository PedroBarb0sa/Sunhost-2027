/**
 * Painel de administração: visão geral, moderação de anúncios e fotos,
 * usuários, reservas, avaliações e denúncias.
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { ChatModal } from "@/components/Reservations";
import { Avatar, EmptyState, Modal, PageHeader, RatingBadge, Spinner, Stars, StatusPill, Tabs, confirmDialog, useDocumentTitle } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { api, errorMessage } from "@/lib/api";
import { brl, dateRange, formatPhone, longDate, plural, timeAgo } from "@/lib/format";
import { Link, useSearchParams } from "@/lib/router";
import type { AdminListing, AdminOverview, AdminUser, Report, Reservation, Review } from "@/lib/types";

type AdminTab = "overview" | "listings" | "users" | "reservations" | "reviews" | "reports";

export default function AdminPage() {
  useDocumentTitle("Administração");
  const [params, setParams] = useSearchParams();
  const tab = (params.get("aba") as AdminTab) || "overview";
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const reload = () => api<AdminOverview>("/api/admin/overview").then(setOverview).catch(() => undefined);
  useEffect(() => {
    reload();
  }, [tab]);

  return (
    <div className="page container admin-page">
      <PageHeader eyebrow="Equipe SunHost" title="Painel de administração" text={overview ? `Banco de dados: ${overview.database === "postgresql" ? "PostgreSQL" : "modo demonstração (arquivo local)"}` : undefined} />
      <Tabs
        value={tab}
        onChange={value => setParams({ aba: value === "overview" ? "" : value })}
        items={[
          { value: "overview", label: "Visão geral" },
          { value: "listings", label: "Anúncios", count: overview?.listings.pending },
          { value: "users", label: "Usuários" },
          { value: "reservations", label: "Reservas" },
          { value: "reviews", label: "Avaliações" },
          { value: "reports", label: "Denúncias", count: overview?.reports.open },
        ]}
      />
      {tab === "overview" && <Overview data={overview} go={value => setParams({ aba: value })} />}
      {tab === "listings" && <ListingsAdmin onChanged={reload} />}
      {tab === "users" && <UsersAdmin />}
      {tab === "reservations" && <ReservationsAdmin />}
      {tab === "reviews" && <ReviewsAdmin />}
      {tab === "reports" && <ReportsAdmin onChanged={reload} />}
    </div>
  );
}

function Overview({ data, go }: { data: AdminOverview | null; go: (tab: AdminTab) => void }) {
  if (!data) return <Spinner />;
  const cards = [
    { icon: "bell", value: data.listings.pending, label: "anúncios aguardando análise", tab: "listings" as AdminTab, alert: data.listings.pending > 0 },
    { icon: "flag", value: data.reports.open, label: "denúncias abertas", tab: "reports" as AdminTab, alert: data.reports.open > 0 },
    { icon: "home", value: data.listings.approved, label: `publicados de ${data.listings.total} anúncios`, tab: "listings" as AdminTab },
    { icon: "users", value: data.users.total, label: `usuários · ${data.users.hosts} anfitriões`, tab: "users" as AdminTab },
    { icon: "calendar", value: data.reservations.confirmed, label: `reservas confirmadas · ${data.reservations.pending} pendentes`, tab: "reservations" as AdminTab },
    { icon: "star", value: data.reviews.average ? data.reviews.average.toFixed(1).replace(".", ",") : "—", label: `nota média · ${data.reviews.total} avaliações`, tab: "reviews" as AdminTab },
  ];
  return (
    <>
      <div className="stat-grid">
        {cards.map(card => (
          <button key={card.label} className={`stat-card${card.alert ? " stat-alert" : ""}`} onClick={() => go(card.tab)}>
            <Icon name={card.icon} size={22} />
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </button>
        ))}
      </div>
      <div className="admin-breakdown">
        <div className="panel">
          <h2 className="block-title">Anúncios por status</h2>
          {(
            [
              ["pending", data.listings.pending],
              ["approved", data.listings.approved],
              ["paused", data.listings.paused],
              ["rejected", data.listings.rejected],
            ] as const
          ).map(([status, value]) => (
            <div className="bar-row wide" key={status}>
              <StatusPill status={status} />
              <span className="bar">
                <i style={{ width: `${data.listings.total ? (value / data.listings.total) * 100 : 0}%` }} />
              </span>
              <span className="bar-count">{value}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2 className="block-title">Reservas por status</h2>
          {(
            [
              ["pending", data.reservations.pending],
              ["confirmed", data.reservations.confirmed],
              ["declined", data.reservations.declined],
              ["cancelled", data.reservations.cancelled],
            ] as const
          ).map(([status, value]) => (
            <div className="bar-row wide" key={status}>
              <StatusPill status={status} />
              <span className="bar">
                <i style={{ width: `${data.reservations.total ? (value / data.reservations.total) * 100 : 0}%` }} />
              </span>
              <span className="bar-count">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ListingsAdmin({ onChanged }: { onChanged: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<AdminListing[] | null>(null);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<AdminListing | null>(null);

  const load = () => api<AdminListing[]>("/api/admin/listings").then(setRows).catch(err => toast(errorMessage(err), "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => (rows || []).filter(row => (status === "all" || row.status === status) && `${row.title} ${row.district} ${row.owner.name}`.toLowerCase().includes(query.toLowerCase())), [rows, status, query]);

  const moderate = async (row: AdminListing, next: string) => {
    const result = await confirmDialog({
      title: next === "approved" ? "Aprovar e publicar?" : next === "rejected" ? "Recusar este anúncio?" : "Pausar este anúncio?",
      message: `“${row.title}” de ${row.owner.name}.`,
      confirmLabel: next === "approved" ? "Aprovar" : next === "rejected" ? "Recusar" : "Pausar",
      danger: next !== "approved",
      noteLabel: next === "approved" ? undefined : "Observação para o anfitrião",
      notePlaceholder: "Ex.: as fotos não mostram o espaço anunciado.",
    });
    if (!result) return;
    try {
      const updated = await api<AdminListing>(`/api/admin/listings/${row.id}`, { method: "PATCH", body: { status: next, note: result.note } });
      setRows(current => (current || []).map(item => (item.id === row.id ? { ...item, ...updated } : item)));
      setPreview(null);
      onChanged();
      toast(next === "approved" ? "Anúncio publicado." : "Status atualizado.", "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const feature = async (row: AdminListing) => {
    const updated = await api<AdminListing>(`/api/admin/listings/${row.id}`, { method: "PATCH", body: { featured: !row.featured } });
    setRows(current => (current || []).map(item => (item.id === row.id ? { ...item, ...updated } : item)));
    toast(updated.featured ? "Marcado como destaque na página inicial." : "Destaque removido.", "info");
  };
  const remove = async (row: AdminListing) => {
    if (!(await confirmDialog({ title: `Excluir “${row.title}” definitivamente?`, message: "Reservas, avaliações e fotos deste anúncio também serão removidas.", confirmLabel: "Excluir", danger: true }))) return;
    await api(`/api/admin/listings/${row.id}`, { method: "DELETE" });
    setRows(current => (current || []).filter(item => item.id !== row.id));
    setPreview(null);
    onChanged();
    toast("Anúncio excluído.", "info");
  };
  const removePhoto = async (row: AdminListing, photoId: number) => {
    if (!(await confirmDialog({ title: "Remover esta foto do anúncio?", confirmLabel: "Remover foto", danger: true }))) return;
    await api(`/api/admin/photos/${photoId}`, { method: "DELETE" });
    const update = (item: AdminListing) => ({ ...item, photos: item.photos.filter(photo => photo.id !== photoId), images: item.photos.filter(photo => photo.id !== photoId).map(photo => photo.url) });
    setRows(current => (current || []).map(item => (item.id === row.id ? update(item) : item)));
    setPreview(current => (current ? update(current) : current));
    toast("Foto removida.", "info");
  };

  if (!rows) return <Spinner />;
  const counts = (value: string) => rows.filter(row => value === "all" || row.status === value).length;

  return (
    <>
      <div className="admin-toolbar">
        <div className="segmented">
          {[
            ["pending", "Em análise"],
            ["approved", "Publicados"],
            ["paused", "Pausados"],
            ["rejected", "Recusados"],
            ["all", "Todos"],
          ].map(([value, label]) => (
            <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>
              {label} ({counts(value)})
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título, bairro ou anfitrião" />
        </label>
      </div>
      {filtered.length ? (
        <div className="admin-list">
          {filtered.map(row => (
            <article className="admin-row" key={row.id}>
              <button className="admin-thumb" onClick={() => setPreview(row)} aria-label={`Ver detalhes de ${row.title}`}>
                {row.images[0] ? <img src={row.images[0]} alt="" /> : <Icon name="image" size={24} />}
                <span>{row.images.length}</span>
              </button>
              <div className="admin-row-body">
                <div className="reservation-top">
                  <StatusPill status={row.status} />
                  {row.featured && <span className="pill pill-orange">Destaque</span>}
                  {row.openReports > 0 && <span className="pill pill-red">{plural(row.openReports, "denúncia", "denúncias")}</span>}
                  <RatingBadge rating={row.rating} count={row.reviewCount} />
                </div>
                <strong>{row.title}</strong>
                <span className="muted small">
                  {row.owner.name} · {row.district} · {brl(row.price)}/noite · enviado {timeAgo(row.createdAt)}
                </span>
              </div>
              <div className="admin-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setPreview(row)}>
                  <Icon name="eye" size={16} /> Revisar
                </button>
                {row.status !== "approved" && (
                  <button className="btn btn-sm btn-primary" onClick={() => moderate(row, "approved")}>
                    <Icon name="check" size={16} /> Aprovar
                  </button>
                )}
                {row.status === "pending" && (
                  <button className="btn btn-sm btn-outline" onClick={() => moderate(row, "rejected")}>
                    Recusar
                  </button>
                )}
                {row.status === "approved" && (
                  <button className="btn btn-sm btn-outline" onClick={() => feature(row)}>
                    <Icon name="sparkles" size={16} /> {row.featured ? "Tirar destaque" : "Destacar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="check-circle" title="Nada por aqui" text={status === "pending" ? "Nenhum anúncio aguardando análise. Bom trabalho!" : "Nenhum anúncio com esse filtro."} />
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title} size="lg">
        {preview && (
          <div className="admin-preview">
            <div className="reservation-top">
              <StatusPill status={preview.status} />
              <span className="muted small">{preview.moderationNote}</span>
            </div>
            <div className="admin-photos">
              {preview.photos.map(photo => (
                <div className="photo-tile" key={photo.id}>
                  <img src={photo.url} alt="" />
                  <div className="photo-tools">
                    <button onClick={() => removePhoto(preview, photo.id)} aria-label="Remover foto">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {!preview.photos.length && <p className="muted">Sem fotos.</p>}
            </div>
            <dl className="admin-facts">
              <div>
                <dt>Anfitrião</dt>
                <dd>
                  {preview.owner.name} · {preview.owner.email} {preview.owner.phone && `· ${formatPhone(preview.owner.phone)}`}
                </dd>
              </div>
              <div>
                <dt>Tipo e local</dt>
                <dd>
                  {preview.category} · {preview.district}
                </dd>
              </div>
              <div>
                <dt>Capacidade</dt>
                <dd>
                  {plural(preview.guests, "hóspede", "hóspedes")} · {plural(preview.bedrooms, "quarto", "quartos")} · {plural(preview.beds, "cama", "camas")} · {plural(preview.bathrooms, "banheiro", "banheiros")}
                </dd>
              </div>
              <div>
                <dt>Preço</dt>
                <dd>
                  {brl(preview.price)}/noite · limpeza {brl(preview.cleaningFee)} · mínimo {plural(preview.minNights, "noite", "noites")}
                </dd>
              </div>
              <div>
                <dt>Comodidades</dt>
                <dd>{preview.amenities.join(", ") || "—"}</dd>
              </div>
            </dl>
            <p className="prose">{preview.description}</p>
            {preview.houseRules && <p className="prose muted">{preview.houseRules}</p>}
            <div className="form-actions">
              <Link to={`/acomodacao/${preview.id}`} className="btn btn-ghost">
                <Icon name="external" size={16} /> Abrir página
              </Link>
              <button className="btn btn-ghost danger" onClick={() => remove(preview)}>
                <Icon name="trash" size={16} /> Excluir
              </button>
              {preview.status === "approved" && (
                <button className="btn btn-outline" onClick={() => moderate(preview, "paused")}>
                  Pausar
                </button>
              )}
              {preview.status !== "rejected" && preview.status !== "approved" && (
                <button className="btn btn-outline" onClick={() => moderate(preview, "rejected")}>
                  Recusar
                </button>
              )}
              {preview.status !== "approved" && (
                <button className="btn btn-primary" onClick={() => moderate(preview, "approved")}>
                  Aprovar e publicar
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function UsersAdmin() {
  const { toast, user: me } = useApp();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    api<AdminUser[]>("/api/admin/users").then(setRows).catch(err => toast(errorMessage(err), "error"));
  }, [toast]);
  const toggle = async (row: AdminUser) => {
    const next = row.status === "active" ? "blocked" : "active";
    if (!(await confirmDialog({ title: next === "blocked" ? `Bloquear ${row.name}?` : `Desbloquear ${row.name}?`, message: next === "blocked" ? "A pessoa perde o acesso imediatamente e os anúncios dela saem das buscas." : "A conta volta a funcionar normalmente.", confirmLabel: next === "blocked" ? "Bloquear" : "Desbloquear", danger: next === "blocked" }))) return;
    try {
      const updated = await api<AdminUser>(`/api/admin/users/${row.id}`, { method: "PATCH", body: { status: next } });
      setRows(current => (current || []).map(item => (item.id === row.id ? { ...item, ...updated } : item)));
      toast(next === "blocked" ? "Usuário bloqueado." : "Usuário desbloqueado.", "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  if (!rows) return <Spinner />;
  const filtered = rows.filter(row => `${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <div className="admin-toolbar">
        <span className="muted">{plural(rows.length, "usuário", "usuários")}</span>
        <label className="search-input">
          <Icon name="search" size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" />
        </label>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Contato</th>
              <th>Anúncios</th>
              <th>Viagens</th>
              <th>Desde</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id}>
                <td>
                  <span className="table-user">
                    <Avatar name={row.name} url={row.avatarUrl} size={32} />
                    <span>
                      <strong>{row.name}</strong>
                      {row.role === "admin" && <small className="pill pill-orange">admin</small>}
                    </span>
                  </span>
                </td>
                <td>
                  <small>{row.email}</small>
                  {row.phone && <small className="block">{formatPhone(row.phone)}</small>}
                </td>
                <td>{row.listingsCount}</td>
                <td>{row.tripsCount}</td>
                <td>
                  <small>{longDate(row.createdAt)}</small>
                </td>
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td>
                  {row.role !== "admin" && row.id !== me?.id && (
                    <button className={`btn btn-sm ${row.status === "active" ? "btn-ghost danger" : "btn-outline"}`} onClick={() => toggle(row)}>
                      {row.status === "active" ? "Bloquear" : "Desbloquear"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ReservationsAdmin() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [chat, setChat] = useState<Reservation | null>(null);
  const load = () => api<Reservation[]>("/api/admin/reservations").then(setRows).catch(err => toast(errorMessage(err), "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cancel = async (row: Reservation) => {
    const result = await confirmDialog({ title: "Cancelar esta reserva?", confirmLabel: "Cancelar reserva", danger: true, noteLabel: "Motivo" });
    if (!result) return;
    try {
      await api(`/api/reservations/${row.id}`, { method: "PATCH", body: { action: "cancel", note: result.note || "Cancelada pela administração." } });
      load();
      toast("Reserva cancelada.", "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState icon="calendar" title="Nenhuma reserva ainda" />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Acomodação</th>
            <th>Hóspede</th>
            <th>Anfitrião</th>
            <th>Datas</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.listing ? <Link to={`/acomodacao/${row.listing.id}`}>{row.listing.title}</Link> : "—"}</td>
              <td>{row.guest.name}</td>
              <td>{row.host.name}</td>
              <td>
                <small>{dateRange(row.checkIn, row.checkOut)}</small>
              </td>
              <td>{brl(row.total)}</td>
              <td>
                <StatusPill status={row.stage} />
              </td>
              <td className="nowrap">
                <button className="icon-btn" onClick={() => setChat(row)} aria-label="Ver conversa">
                  <Icon name="message" size={18} />
                </button>
                {row.canCancel && (
                  <button className="icon-btn danger" onClick={() => cancel(row)} aria-label="Cancelar reserva">
                    <Icon name="x-circle" size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {chat && <ChatModal open onClose={() => setChat(null)} reservation={chat} />}
    </div>
  );
}

function ReviewsAdmin() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Review[] | null>(null);
  useEffect(() => {
    api<Review[]>("/api/admin/reviews").then(setRows).catch(err => toast(errorMessage(err), "error"));
  }, [toast]);
  const setStatus = async (row: Review, status: "published" | "hidden") => {
    const updated = await api<Review>(`/api/admin/reviews/${row.id}`, { method: "PATCH", body: { status } });
    setRows(current => (current || []).map(item => (item.id === row.id ? updated : item)));
    toast(status === "hidden" ? "Avaliação ocultada." : "Avaliação publicada.", "info");
  };
  const remove = async (row: Review) => {
    if (!(await confirmDialog({ title: "Excluir esta avaliação?", confirmLabel: "Excluir", danger: true }))) return;
    await api(`/api/reviews/${row.id}`, { method: "DELETE" });
    setRows(current => (current || []).filter(item => item.id !== row.id));
    toast("Avaliação excluída.", "info");
  };
  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState icon="star" title="Nenhuma avaliação publicada ainda" />;
  return (
    <div className="review-list">
      {rows.map(row => (
        <article className={`review-item${row.status === "hidden" ? " is-hidden" : ""}`} key={row.id}>
          <header>
            <Avatar name={row.user.name} url={row.user.avatarUrl} size={40} />
            <div>
              <strong>{row.user.name}</strong>
              <span>
                <Link to={`/acomodacao/${row.listingId}`}>{row.listingTitle}</Link> · {longDate(row.createdAt)}
                {row.verified && (
                  <em className="verified">
                    <Icon name="check-circle" size={13} /> verificado
                  </em>
                )}
              </span>
            </div>
            <Stars value={row.rating} />
          </header>
          <p>{row.body}</p>
          <div className="review-actions">
            <StatusPill status={row.status} />
            {row.status === "published" ? (
              <button className="link-btn" onClick={() => setStatus(row, "hidden")}>
                <Icon name="eye-off" size={15} /> Ocultar
              </button>
            ) : (
              <button className="link-btn" onClick={() => setStatus(row, "published")}>
                <Icon name="eye" size={15} /> Publicar
              </button>
            )}
            <button className="link-btn danger" onClick={() => remove(row)}>
              <Icon name="trash" size={15} /> Excluir
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportsAdmin({ onChanged }: { onChanged: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    api<Report[]>("/api/admin/reports").then(setRows).catch(err => toast(errorMessage(err), "error"));
  }, [toast]);
  const setStatus = async (row: Report, status: "open" | "resolved") => {
    await api(`/api/admin/reports/${row.id}`, { method: "PATCH", body: { status } });
    setRows(current => (current || []).map(item => (item.id === row.id ? { ...item, status } : item)));
    onChanged();
    toast(status === "resolved" ? "Denúncia marcada como resolvida." : "Denúncia reaberta.", "info");
  };
  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState icon="shield" title="Nenhuma denúncia recebida" text="Quando alguém denunciar um anúncio, ele aparece aqui para análise." />;
  return (
    <div className="admin-list">
      {rows.map(row => (
        <article className="admin-row" key={row.id}>
          <span className="report-icon">
            <Icon name="flag" size={20} />
          </span>
          <div className="admin-row-body">
            <div className="reservation-top">
              <StatusPill status={row.status} />
              <span className="muted small">{timeAgo(row.createdAt)}</span>
            </div>
            <strong>{row.reason}</strong>
            <span className="muted small">
              Anúncio: <Link to={`/acomodacao/${row.listing.id}`}>{row.listing.title || `#${row.listing.id}`}</Link> · por {row.user.name} ({row.user.email})
            </span>
            {row.details && <p className="report-details">“{row.details}”</p>}
          </div>
          <div className="admin-actions">
            <Link to={`/admin?aba=listings`} className="btn btn-sm btn-ghost">
              Moderar anúncios
            </Link>
            {row.status === "open" ? (
              <button className="btn btn-sm btn-primary" onClick={() => setStatus(row, "resolved")}>
                <Icon name="check" size={16} /> Resolver
              </button>
            ) : (
              <button className="btn btn-sm btn-outline" onClick={() => setStatus(row, "open")}>
                Reabrir
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
