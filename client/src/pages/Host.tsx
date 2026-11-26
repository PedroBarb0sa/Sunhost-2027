/**
 * Painel do anfitrião e formulário de anúncio.
 */
import { type FormEvent, useEffect, useState } from "react";
import { AMENITIES, CATEGORIES, DISTRICTS, pointsForPrice } from "@shared/catalog";
import { AMENITY_ICONS, CATEGORY_ICONS, Icon } from "@/components/Icon";
import { ReservationCard } from "@/components/Reservations";
import { EmptyState, PageHeader, RatingBadge, Spinner, Stars, StatusPill, Stepper, Tabs, confirmDialog, useDocumentTitle } from "@/components/ui";
import { useApp, useRealtime } from "@/context/AppContext";
import { api, errorMessage } from "@/lib/api";
import { brl, longDate, plural, todayISO } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { Link, navigate } from "@/lib/router";
import type { HostListing, Listing, Reservation, Review } from "@/lib/types";

type HostTab = "reservations" | "listings" | "reviews";

export function HostDashboard() {
  useDocumentTitle("Painel do anfitrião");
  const { user, toast, refreshHostPending } = useApp();
  const [tab, setTab] = useState<HostTab>("reservations");
  const [filter, setFilter] = useState<"pending" | "confirmed" | "history">("pending");
  const [listings, setListings] = useState<HostListing[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = () => {
    api<HostListing[]>("/api/host/listings").then(setListings).catch(err => toast(errorMessage(err), "error"));
    api<Reservation[]>("/api/host/reservations").then(setReservations).catch(() => setReservations([]));
    api<Review[]>("/api/host/reviews").then(setReviews).catch(() => undefined);
    refreshHostPending();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  // Novos pedidos, cancelamentos e mensagens aparecem sem recarregar a página.
  useRealtime("reservation", () => {
    api<Reservation[]>("/api/host/reservations").then(setReservations).catch(() => undefined);
    api<HostListing[]>("/api/host/listings").then(setListings).catch(() => undefined);
  });
  useRealtime("message", () => {
    api<Reservation[]>("/api/host/reservations").then(setReservations).catch(() => undefined);
  });

  if (user?.role === "admin")
    return (
      <div className="page container">
        <EmptyState icon="shield" title="Conta de administração" text="Administradores moderam a plataforma. Para anunciar, use uma conta comum." action={<Link to="/admin" className="btn btn-primary">Ir para o painel admin</Link>} />
      </div>
    );
  if (!listings || !reservations) return <Spinner />;

  const today = todayISO();
  const pending = reservations.filter(row => row.status === "pending");
  const confirmed = reservations.filter(row => row.status === "confirmed" && row.checkOut > today).sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1));
  const history = reservations.filter(row => !pending.includes(row) && !confirmed.includes(row));
  const revenue = confirmed.reduce((sum, row) => sum + row.total, 0);
  const rated = listings.filter(item => item.rating !== null);
  const average = rated.length ? rated.reduce((sum, item) => sum + (item.rating || 0) * item.reviewCount, 0) / rated.reduce((sum, item) => sum + item.reviewCount, 0) : null;
  const shown = filter === "pending" ? pending : filter === "confirmed" ? confirmed : history;
  const updateReservation = (next: Reservation) => {
    setReservations(current => (current || []).map(row => (row.id === next.id ? next : row)));
    if (next.status === "confirmed") load();
  };

  const setStatus = async (listing: HostListing, status: "paused" | "approved") => {
    try {
      const next = await api<Listing>(`/api/host/listings/${listing.id}/status`, { method: "PATCH", body: { status } });
      setListings(current => (current || []).map(item => (item.id === listing.id ? { ...item, ...next } : item)));
      toast(status === "paused" ? "Anúncio pausado: ele não aparece nas buscas." : "Anúncio reativado.", "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const remove = async (listing: HostListing) => {
    if (!(await confirmDialog({ title: `Excluir “${listing.title}”?`, message: "Fotos, avaliações e histórico de reservas deste espaço também serão removidos.", confirmLabel: "Excluir anúncio", danger: true }))) return;
    try {
      await api(`/api/host/listings/${listing.id}`, { method: "DELETE" });
      setListings(current => (current || []).filter(item => item.id !== listing.id));
      toast("Anúncio excluído.", "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="page container">
      <PageHeader
        eyebrow="Modo anfitrião"
        title={`Olá, ${user?.name.split(" ")[0]}`}
        text="Gerencie seus espaços, responda pedidos e acompanhe as avaliações."
        actions={
          <Link to="/anfitriao/novo" className="btn btn-primary">
            <Icon name="plus" size={18} /> Novo anúncio
          </Link>
        }
      />
      <div className="stat-grid">
        <button className={`stat-card${pending.length ? " stat-alert" : ""}`} onClick={() => { setTab("reservations"); setFilter("pending"); }}>
          <Icon name="bell" size={22} />
          <strong>{pending.length}</strong>
          <span>{pending.length === 1 ? "pedido pendente" : "pedidos pendentes"}</span>
        </button>
        <button className="stat-card" onClick={() => { setTab("reservations"); setFilter("confirmed"); }}>
          <Icon name="calendar" size={22} />
          <strong>{confirmed.length}</strong>
          <span>próximas estadias</span>
        </button>
        <div className="stat-card">
          <Icon name="ticket" size={22} />
          <strong>{brl(revenue)}</strong>
          <span>a receber (confirmadas)</span>
        </div>
        <button className="stat-card" onClick={() => setTab("listings")}>
          <Icon name="home" size={22} />
          <strong>
            {listings.filter(item => item.status === "approved").length}/{listings.length}
          </strong>
          <span>anúncios publicados</span>
        </button>
        <button className="stat-card" onClick={() => setTab("reviews")}>
          <Icon name="star" size={22} />
          <strong>{average ? average.toFixed(1).replace(".", ",") : "—"}</strong>
          <span>nota média ({reviews.length})</span>
        </button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "reservations", label: "Reservas", count: pending.length },
          { value: "listings", label: "Meus anúncios", count: listings.length },
          { value: "reviews", label: "Avaliações", count: reviews.length },
        ]}
      />

      {tab === "reservations" && (
        <>
          <div className="segmented">
            {(
              [
                ["pending", `Pendentes (${pending.length})`],
                ["confirmed", `Confirmadas (${confirmed.length})`],
                ["history", `Histórico (${history.length})`],
              ] as const
            ).map(([value, label]) => (
              <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          {shown.length ? (
            <div className="reservation-list">
              {shown.map(row => (
                <ReservationCard key={row.id} reservation={row} onChanged={updateReservation} />
              ))}
            </div>
          ) : (
            <EmptyState icon="calendar" title={filter === "pending" ? "Nenhum pedido aguardando" : filter === "confirmed" ? "Nenhuma estadia confirmada à frente" : "Sem histórico ainda"} text={listings.length ? "Quando um viajante solicitar uma reserva, ela aparece aqui." : "Publique seu primeiro espaço para começar a receber pedidos."} />
          )}
        </>
      )}

      {tab === "listings" &&
        (listings.length ? (
          <div className="host-listings">
            {listings.map(listing => (
              <article className="host-listing" key={listing.id}>
                <Link to={`/acomodacao/${listing.id}`} className="host-listing-thumb">
                  {listing.images[0] ? <img src={listing.images[0]} alt="" /> : <Icon name="image" size={28} />}
                </Link>
                <div className="host-listing-body">
                  <div className="reservation-top">
                    <StatusPill status={listing.status} label={listing.status === "pending" ? "Em análise" : undefined} />
                    {listing.featured && <span className="pill pill-orange">Destaque</span>}
                    <RatingBadge rating={listing.rating} count={listing.reviewCount} />
                  </div>
                  <h3>
                    <Link to={`/acomodacao/${listing.id}`}>{listing.title}</Link>
                  </h3>
                  <p className="muted small">
                    {listing.district} · {brl(listing.price)}/noite · {plural(listing.guests, "hóspede", "hóspedes")} · {plural(listing.images.length, "foto", "fotos")}
                  </p>
                  {listing.moderationNote && listing.status !== "approved" && <p className="moderation-note">{listing.moderationNote}</p>}
                  <p className="muted small">
                    {plural(listing.pendingRequests, "pedido pendente", "pedidos pendentes")} · {plural(listing.upcomingStays, "estadia futura", "estadias futuras")}
                  </p>
                </div>
                <div className="host-listing-actions">
                  <Link to={`/anfitriao/editar/${listing.id}`} className="btn btn-sm btn-outline">
                    <Icon name="edit" size={16} /> Editar
                  </Link>
                  {listing.status === "approved" && (
                    <button className="btn btn-sm btn-ghost" onClick={() => setStatus(listing, "paused")}>
                      <Icon name="pause" size={16} /> Pausar
                    </button>
                  )}
                  {listing.status === "paused" && (
                    <button className="btn btn-sm btn-ghost" onClick={() => setStatus(listing, "approved")}>
                      <Icon name="play" size={16} /> Reativar
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost danger" onClick={() => remove(listing)}>
                    <Icon name="trash" size={16} /> Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon="home" title="Você ainda não tem anúncios" text="Cadastre seu espaço em poucos minutos. A equipe revisa e publica." action={<Link to="/anfitriao/novo" className="btn btn-primary">Criar primeiro anúncio</Link>} />
        ))}

      {tab === "reviews" &&
        (reviews.length ? (
          <div className="review-list host-review-list">
            {reviews.map(review => (
              <article className="review-item" key={review.id}>
                <header>
                  <div>
                    <strong>{review.user.name}</strong>
                    <span>
                      {review.listingTitle} · {longDate(review.createdAt)}
                    </span>
                  </div>
                  <Stars value={review.rating} />
                </header>
                <p>{review.body}</p>
                {review.hostReply ? (
                  <div className="host-reply">
                    <strong>Sua resposta</strong>
                    <p>{review.hostReply}</p>
                  </div>
                ) : (
                  <Link to={`/acomodacao/${review.listingId}#avaliacoes`} className="link-btn">
                    <Icon name="message" size={15} /> Responder no anúncio
                  </Link>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon="star" title="Nenhuma avaliação ainda" text="As avaliações dos hóspedes aparecem aqui para você acompanhar e responder." />
        ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Formulário de anúncio (criar e editar)
// -----------------------------------------------------------------------------
type FormState = {
  title: string;
  district: string;
  category: string;
  description: string;
  price: string;
  cleaningFee: string;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minNights: number;
  amenities: string[];
  houseRules: string;
  checkInTime: string;
  checkOutTime: string;
  localNote: string;
  photos: string[];
};

const EMPTY: FormState = {
  title: "",
  district: "",
  category: "",
  description: "",
  price: "",
  cleaningFee: "0",
  guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  minNights: 1,
  amenities: [],
  houseRules: "",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  localNote: "",
  photos: [],
};

export function HostListingForm({ id }: { id?: string }) {
  useDocumentTitle(id ? "Editar anúncio" : "Novo anúncio");
  const { user, toast } = useApp();
  const [form, setForm] = useState<FormState | null>(id ? null : EMPTY);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    if (!id) return;
    api<Listing>(`/api/host/listings/${id}`)
      .then(listing => {
        setStatus(listing.status);
        setForm({
          title: listing.title,
          district: listing.district,
          category: listing.category,
          description: listing.description,
          price: String(listing.price),
          cleaningFee: String(listing.cleaningFee),
          guests: listing.guests,
          bedrooms: listing.bedrooms,
          beds: listing.beds,
          bathrooms: listing.bathrooms,
          minNights: listing.minNights,
          amenities: listing.amenities,
          houseRules: listing.houseRules,
          checkInTime: listing.checkInTime,
          checkOutTime: listing.checkOutTime,
          localNote: listing.localNote,
          photos: listing.images,
        });
      })
      .catch(err => {
        toast(errorMessage(err), "error");
        navigate("/anfitriao");
      });
  }, [id, toast]);

  if (user?.role === "admin" && !id)
    return (
      <div className="page container">
        <EmptyState icon="shield" title="Use uma conta comum para anunciar" text="Administradores moderam os anúncios, mas não publicam espaços próprios." action={<Link to="/admin" className="btn btn-primary">Ir para o painel admin</Link>} />
      </div>
    );
  if (!form) return <Spinner />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => (current ? { ...current, [key]: value } : current));
  const price = Number(form.price) || 0;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 12 - form.photos.length);
    if (!list.length) return toast("Limite de 12 fotos atingido.", "error");
    setUploading(list.length);
    for (const file of list) {
      try {
        const url = await uploadImage(file);
        setForm(current => (current ? { ...current, photos: [...current.photos, url] } : current));
      } catch (err) {
        toast(errorMessage(err), "error");
      } finally {
        setUploading(current => current - 1);
      }
    }
  };
  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+$/.test(url)) return toast("Cole um link de imagem começando com https://", "error");
    set("photos", [...form.photos, url].slice(0, 12));
    setLinkUrl("");
  };
  const movePhoto = (index: number, delta: number) => {
    const next = [...form.photos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("photos", next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.category) return toast("Escolha o tipo de espaço.", "error");
    if (!form.photos.length) return toast("Adicione pelo menos uma foto.", "error");
    setSaving(true);
    try {
      const body = { ...form, price: Number(form.price), cleaningFee: Number(form.cleaningFee || 0) };
      if (id) await api(`/api/host/listings/${id}`, { method: "PUT", body });
      else await api("/api/host/listings", { method: "POST", body });
      toast(id ? "Alterações enviadas para revisão." : "Anúncio enviado! A equipe vai revisar e publicar.");
      navigate("/anfitriao");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page container narrow">
      <PageHeader
        eyebrow={id ? "Editar anúncio" : "Novo anúncio"}
        title={id ? form.title || "Editar anúncio" : "Conte a história do seu canto"}
        text={id && status === "approved" ? "Ao salvar, o anúncio passa por uma nova revisão rápida antes de voltar às buscas." : "Anunciar é gratuito. Depois do envio, a equipe SunHost revisa as informações e publica."}
      />
      <form className="listing-form" onSubmit={submit}>
        <section className="panel">
          <h2 className="block-title">
            <span>1</span> Tipo de espaço
          </h2>
          <div className="category-picker">
            {CATEGORIES.map(category => (
              <label key={category} className={`category-option${form.category === category ? " checked" : ""}`}>
                <input type="radio" name="category" value={category} checked={form.category === category} onChange={() => set("category", category)} />
                <Icon name={CATEGORY_ICONS[category] || "home"} size={26} />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>2</span> Título e localização
          </h2>
          <label className="field">
            <span className="field-label">Título do anúncio</span>
            <input value={form.title} onChange={event => set("title", event.target.value)} required minLength={6} maxLength={80} placeholder="Ex.: Casa com deck e vista para a Lagoa" />
            <small className="field-hint">{form.title.length}/80</small>
          </label>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Bairro</span>
              <input value={form.district} onChange={event => set("district", event.target.value)} list="host-districts" required minLength={2} maxLength={60} placeholder="Ex.: Campeche" />
              <datalist id="host-districts">
                {DISTRICTS.map(district => (
                  <option key={district} value={district} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">
                Destaque local <em>opcional</em>
              </span>
              <input value={form.localNote} onChange={event => set("localNote", event.target.value)} maxLength={40} placeholder="Ex.: Praia a 5 min a pé" />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>3</span> Capacidade
          </h2>
          <div className="capacity-grid">
            {(
              [
                ["guests", "Hóspedes", 1, 20],
                ["bedrooms", "Quartos", 0, 20],
                ["beds", "Camas", 1, 30],
                ["bathrooms", "Banheiros", 1, 20],
              ] as const
            ).map(([key, label, min, max]) => (
              <div className="capacity-row" key={key}>
                <span>{label}</span>
                <Stepper value={form[key]} onChange={value => set(key, value)} min={min} max={max} label={label.toLowerCase()} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>4</span> Fotos <em className="muted small">({form.photos.length}/12 · a primeira é a capa)</em>
          </h2>
          <div className="photo-grid">
            {form.photos.map((photo, index) => (
              <div className="photo-tile" key={`${photo}-${index}`}>
                <img src={photo} alt={`Foto ${index + 1}`} />
                {index === 0 && <span className="cover-tag">Capa</span>}
                <div className="photo-tools">
                  <button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label="Mover para a esquerda">
                    <Icon name="chevron-left" size={16} />
                  </button>
                  <button type="button" onClick={() => movePhoto(index, 1)} disabled={index === form.photos.length - 1} aria-label="Mover para a direita">
                    <Icon name="chevron-right" size={16} />
                  </button>
                  <button type="button" onClick={() => set("photos", form.photos.filter((_, item) => item !== index))} aria-label="Remover foto">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, index) => (
              <div className="photo-tile is-loading" key={`up-${index}`}>
                <span className="spinner" />
              </div>
            ))}
            {form.photos.length + uploading < 12 && (
              <label className="photo-add">
                <Icon name="upload" size={26} />
                <strong>Enviar fotos</strong>
                <small>Do computador ou celular</small>
                <input type="file" accept="image/*" multiple hidden onChange={event => { addFiles(event.target.files); event.target.value = ""; }} />
              </label>
            )}
          </div>
          <div className="inline-form">
            <input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="Ou cole o link de uma imagem (https://…)" aria-label="Link de imagem" />
            <button type="button" className="btn btn-outline" onClick={addLink}>
              Adicionar link
            </button>
          </div>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>5</span> Descrição
          </h2>
          <label className="field">
            <span className="field-label">Sobre o espaço</span>
            <textarea rows={6} value={form.description} onChange={event => set("description", event.target.value)} required minLength={30} maxLength={3000} placeholder="O que torna este espaço especial? Fale da vista, da vizinhança, do que fica perto e do que o hóspede vai encontrar." />
            <small className="field-hint">{form.description.length}/3000 · mínimo de 30 caracteres</small>
          </label>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>6</span> Comodidades
          </h2>
          <div className="amenity-picker">
            {AMENITIES.map(amenity => {
              const checked = form.amenities.includes(amenity);
              return (
                <label key={amenity} className={`amenity-option${checked ? " checked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => set("amenities", checked ? form.amenities.filter(item => item !== amenity) : [...form.amenities, amenity])} />
                  <Icon name={AMENITY_ICONS[amenity] || "check"} size={18} />
                  <span>{amenity}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>7</span> Preço e estadia mínima
          </h2>
          <div className="form-grid three">
            <label className="field">
              <span className="field-label">Diária (R$)</span>
              <input type="number" min={30} max={20000} step="1" inputMode="numeric" value={form.price} onChange={event => set("price", event.target.value)} required placeholder="280" />
            </label>
            <label className="field">
              <span className="field-label">Taxa de limpeza (R$)</span>
              <input type="number" min={0} max={3000} step="1" inputMode="numeric" value={form.cleaningFee} onChange={event => set("cleaningFee", event.target.value)} />
            </label>
            <div className="field">
              <span className="field-label">Mínimo de noites</span>
              <Stepper value={form.minNights} onChange={value => set("minNights", value)} min={1} max={30} label="noites mínimas" />
            </div>
          </div>
          {price >= 30 && (
            <p className="points-preview">
              <Icon name="sparkles" size={16} />
              <span>
                Hóspedes ganham <strong>{pointsForPrice(price)} Pontos Cívicos</strong> por estadia neste espaço. Sem comissão: você recebe o valor combinado diretamente.
              </span>
            </p>
          )}
        </section>

        <section className="panel">
          <h2 className="block-title">
            <span>8</span> Horários e regras
          </h2>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Check-in a partir de</span>
              <input type="time" value={form.checkInTime} onChange={event => set("checkInTime", event.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Check-out até</span>
              <input type="time" value={form.checkOutTime} onChange={event => set("checkOutTime", event.target.value)} required />
            </label>
          </div>
          <label className="field">
            <span className="field-label">
              Regras da casa <em>uma por linha</em>
            </span>
            <textarea rows={4} value={form.houseRules} onChange={event => set("houseRules", event.target.value)} maxLength={1500} placeholder={"Não é permitido fumar\nSilêncio após as 22h\nPets sob consulta"} />
          </label>
        </section>

        <div className="form-submit-bar">
          <Link to="/anfitriao" className="btn btn-ghost">
            Cancelar
          </Link>
          <button className="btn btn-primary btn-lg" disabled={saving || uploading > 0}>
            {saving ? "Enviando…" : uploading ? "Aguardando fotos…" : id ? "Salvar e enviar para revisão" : "Enviar anúncio para revisão"}
          </button>
        </div>
      </form>
    </div>
  );
}
