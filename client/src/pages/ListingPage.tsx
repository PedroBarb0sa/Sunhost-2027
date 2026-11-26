/**
 * Página da acomodação: galeria, detalhes, comodidades, regras, disponibilidade,
 * avaliações com estrelas, anfitrião, denúncia e solicitação de reserva.
 */
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { REPORT_REASONS } from "@shared/catalog";
import { Calendar } from "@/components/Calendar";
import { AMENITY_ICONS, Icon } from "@/components/Icon";
import { Popover, useIsMobile } from "@/components/SearchBar";
import { Avatar, EmptyState, Modal, RatingBadge, Spinner, StarInput, Stars, StatusPill, Stepper, confirmDialog, useDocumentTitle } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { api, errorMessage } from "@/lib/api";
import { brl, dateRange, longDate, monthYear, nightsBetween, plural, shortDate } from "@/lib/format";
import { Link, navigate, useSearchParams } from "@/lib/router";
import type { Coupon, ListingDetail, PointsSummary, Review } from "@/lib/types";

export default function ListingPage({ id }: { id: string }) {
  const { user, isFavorite, toggleFavorite, toast } = useApp();
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const bookingRef = useRef<HTMLDivElement>(null);
  useDocumentTitle(detail?.listing.title || "Acomodação");

  const load = useCallback(async () => {
    try {
      const [data, list] = await Promise.all([api<ListingDetail>(`/api/listings/${id}`), api<Review[]>(`/api/listings/${id}/reviews`)]);
      setDetail(data);
      setReviews(list);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    setDetail(null);
    load();
  }, [load, user?.id]);

  if (error)
    return (
      <div className="page container">
        <EmptyState icon="alert" title="Acomodação indisponível" text={error} action={<Link to="/explorar" className="btn btn-primary">Explorar outras estadias</Link>} />
      </div>
    );
  if (!detail) return <Spinner />;

  const { listing, viewer } = detail;
  const saved = isFavorite(listing.id);
  const photos = listing.images.length ? listing.images : [];
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 6);

  const share = async () => {
    const url = window.location.origin + `/acomodacao/${listing.id}`;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copiado para a área de transferência.", "info");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  return (
    <div className="page listing-page">
      <div className="container">
        {(viewer?.isOwner || user?.role === "admin") && listing.status !== "approved" && (
          <div className={`notice-banner notice-${listing.status}`}>
            <Icon name="info" size={18} />
            <span>
              Este anúncio está <StatusPill status={listing.status} /> {listing.moderationNote && `— ${listing.moderationNote}`}
            </span>
          </div>
        )}
        {viewer?.isOwner && (
          <div className="notice-banner notice-owner">
            <Icon name="home" size={18} />
            <span>Você é o anfitrião deste espaço.</span>
            <Link to={`/anfitriao/editar/${listing.id}`} className="btn btn-sm btn-outline">
              <Icon name="edit" size={16} /> Editar anúncio
            </Link>
          </div>
        )}

        <div className="listing-head">
          <div>
            <h1>{listing.title}</h1>
            <div className="listing-sub">
              <RatingBadge rating={listing.rating} count={listing.reviewCount} />
              <a href="#avaliacoes" className="link-muted">
                {plural(listing.reviewCount, "avaliação", "avaliações")}
              </a>
              <span>·</span>
              <span>
                <Icon name="pin" size={15} /> {listing.location}
              </span>
            </div>
          </div>
          <div className="listing-actions">
            <button className="btn btn-ghost btn-sm" onClick={share}>
              <Icon name="share" size={17} /> Compartilhar
            </button>
            <button className={`btn btn-ghost btn-sm${saved ? " is-saved" : ""}`} onClick={() => toggleFavorite(listing)} aria-pressed={saved}>
              <Icon name="heart" size={17} filled={saved} /> {saved ? "Salvo" : "Salvar"}
            </button>
          </div>
        </div>

        <div className={`gallery gallery-${Math.min(photos.length, 5)}`}>
          {photos.slice(0, 5).map((image, index) => (
            <button key={`${image}-${index}`} className={`gallery-item${index === 0 ? " gallery-main" : ""}`} onClick={() => setLightbox(index)} aria-label={`Abrir foto ${index + 1}`}>
              <img src={image} alt={index === 0 ? listing.title : ""} />
            </button>
          ))}
          {!photos.length && (
            <div className="gallery-empty">
              <Icon name="image" size={36} /> Sem fotos
            </div>
          )}
          {photos.length > 1 && (
            <button className="btn btn-light btn-sm gallery-all" onClick={() => setLightbox(0)}>
              <Icon name="grid" size={16} /> Ver todas as {photos.length} fotos
            </button>
          )}
        </div>

        <div className="listing-layout">
          <div className="listing-main">
            <section className="listing-section listing-intro">
              <div>
                <h2>
                  {listing.category} em {listing.district}
                </h2>
                <p className="facts">
                  {plural(listing.guests, "hóspede", "hóspedes")} · {plural(listing.bedrooms, "quarto", "quartos")} · {plural(listing.beds, "cama", "camas")} · {plural(listing.bathrooms, "banheiro", "banheiros")}
                </p>
              </div>
              <Avatar name={listing.host.name} url={listing.host.avatarUrl} size={56} />
            </section>

            <section className="listing-section highlights">
              <div className="highlight">
                <Icon name="user" size={22} />
                <div>
                  <strong>Anfitrião: {listing.host.name}</strong>
                  <span>Na SunHost desde {monthYear(listing.host.createdAt || "")}</span>
                </div>
              </div>
              <div className="highlight">
                <Icon name="clock" size={22} />
                <div>
                  <strong>
                    Check-in a partir das {listing.checkInTime} · check-out até {listing.checkOutTime}
                  </strong>
                  <span>Mínimo de {plural(listing.minNights, "noite", "noites")}</span>
                </div>
              </div>
              <div className="highlight">
                <Icon name="sparkles" size={22} />
                <div>
                  <strong>{listing.points} Pontos Cívicos por estadia</strong>
                  <span>Creditados quando a estadia é concluída</span>
                </div>
              </div>
            </section>

            <section className="listing-section">
              <h2>Sobre este espaço</h2>
              <p className="prose">{listing.description}</p>
              {listing.localNote && (
                <p className="local-tag">
                  <Icon name="waves" size={16} /> {listing.localNote}
                </p>
              )}
            </section>

            <section className="listing-section">
              <h2>O que este lugar oferece</h2>
              {listing.amenities.length ? (
                <div className="amenity-list">
                  {listing.amenities.map(amenity => (
                    <span key={amenity}>
                      <Icon name={AMENITY_ICONS[amenity] || "check"} size={22} /> {amenity}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">O anfitrião ainda não listou as comodidades.</p>
              )}
            </section>

            <section className="listing-section">
              <h2>Disponibilidade</h2>
              {detail.bookedRanges.length ? (
                <>
                  <p className="muted">Períodos já reservados (as demais datas estão livres):</p>
                  <div className="booked-list">
                    {detail.bookedRanges.map(range => (
                      <span key={range.checkIn} className="pill pill-gray">
                        <Icon name="calendar" size={14} /> {dateRange(range.checkIn, range.checkOut)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">Nenhuma data reservada no momento. Escolha o seu período no quadro de reserva.</p>
              )}
            </section>

            <section className="listing-section">
              <h2>Regras da casa</h2>
              <ul className="rules">
                <li>
                  <Icon name="clock" size={18} /> Check-in: a partir das {listing.checkInTime}
                </li>
                <li>
                  <Icon name="clock" size={18} /> Check-out: até as {listing.checkOutTime}
                </li>
                <li>
                  <Icon name="users" size={18} /> Máximo de {plural(listing.guests, "hóspede", "hóspedes")}
                </li>
                {listing.houseRules
                  .split("\n")
                  .map(rule => rule.trim())
                  .filter(Boolean)
                  .map(rule => (
                    <li key={rule}>
                      <Icon name="info" size={18} /> {rule}
                    </li>
                  ))}
              </ul>
            </section>

            <section className="listing-section" id="avaliacoes">
              <ReviewsBlock detail={detail} reviews={visibleReviews} total={reviews.length} onChanged={load} />
              {reviews.length > 6 && !showAllReviews && (
                <button className="btn btn-outline" onClick={() => setShowAllReviews(true)}>
                  Mostrar todas as {reviews.length} avaliações
                </button>
              )}
            </section>

            <section className="listing-section host-section">
              <h2>Conheça o anfitrião</h2>
              <div className="host-card">
                <div className="host-card-top">
                  <Avatar name={listing.host.name} url={listing.host.avatarUrl} size={72} />
                  <div>
                    <strong>{listing.host.name}</strong>
                    <span>Anfitrião desde {monthYear(listing.host.createdAt || "")}</span>
                  </div>
                </div>
                <div className="host-stats">
                  <span>
                    <strong>{listing.host.reviewCount}</strong> avaliações
                  </span>
                  <span>
                    <strong>{listing.host.rating ? listing.host.rating.toFixed(1).replace(".", ",") : "—"}</strong> nota média
                  </span>
                  <span>
                    <strong>{listing.host.listingsCount}</strong> {listing.host.listingsCount === 1 ? "espaço" : "espaços"}
                  </span>
                </div>
                {listing.host.bio && <p className="prose">{listing.host.bio}</p>}
                <p className="host-note">
                  <Icon name="lock" size={16} />
                  <span>
                    Telefone e e-mail do anfitrião aparecem em <Link to="/viagens">Minhas viagens</Link> assim que a reserva for confirmada. Antes disso, converse pela própria solicitação.
                  </span>
                </p>
              </div>
              {user && !viewer?.isOwner && (
                <button className="link-btn report-link" onClick={() => setReportOpen(true)}>
                  <Icon name="flag" size={16} /> Denunciar este anúncio
                </button>
              )}
            </section>
          </div>

          <aside className="listing-aside" ref={bookingRef} id="reservar">
            <BookingCard detail={detail} />
          </aside>
        </div>
      </div>

      <div className="mobile-book-bar">
        <div>
          <strong>{brl(listing.price)}</strong> <span>noite</span>
          <RatingBadge rating={listing.rating} count={listing.reviewCount} compact />
        </div>
        <button className="btn btn-primary" onClick={() => bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          Escolher datas
        </button>
      </div>

      <Lightbox images={photos} index={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} title={listing.title} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} listingId={listing.id} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Quadro de reserva
// -----------------------------------------------------------------------------
function BookingCard({ detail }: { detail: ListingDetail }) {
  const { listing, viewer } = detail;
  const { user, toast } = useApp();
  const [params] = useSearchParams();
  const mobile = useIsMobile();
  const [range, setRange] = useState(() => {
    const checkIn = params.get("checkIn") || "";
    const checkOut = params.get("checkOut") || "";
    const free = !detail.bookedRanges.some(item => checkIn < item.checkOut && item.checkIn < checkOut);
    return checkIn && checkOut && free ? { checkIn, checkOut } : { checkIn: "", checkOut: "" };
  });
  const [guests, setGuests] = useState(() => Math.min(listing.guests, Math.max(1, Number(params.get("guests") || 1))));
  const [message, setMessage] = useState("");
  const [couponId, setCouponId] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!user) return setCoupons([]);
    api<PointsSummary>("/api/points")
      .then(data => setCoupons(data.coupons.filter(item => item.status === "available")))
      .catch(() => undefined);
  }, [user]);

  const nights = nightsBetween(range.checkIn, range.checkOut);
  const subtotal = nights * listing.price;
  const coupon = coupons.find(item => String(item.id) === couponId);
  const discount = coupon && nights ? Math.min(coupon.amount, subtotal + listing.cleaningFee) : 0;
  const total = nights ? subtotal + listing.cleaningFee - discount : 0;
  const tooShort = nights > 0 && nights < listing.minNights;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      navigate(`/entrar?voltar=${encodeURIComponent(`/acomodacao/${listing.id}?checkIn=${range.checkIn}&checkOut=${range.checkOut}&guests=${guests}`)}`);
      return;
    }
    if (!nights) {
      setCalendarOpen(true);
      return;
    }
    const ok = await confirmDialog({
      title: "Enviar solicitação de reserva?",
      message: (
        <p>
          {listing.title}
          <br />
          <strong>{dateRange(range.checkIn, range.checkOut)}</strong> · {plural(guests, "hóspede", "hóspedes")} · total estimado <strong>{brl(total)}</strong>.
          <br />
          Nada é cobrado agora: o pagamento é combinado com o anfitrião depois da confirmação.
        </p>
      ),
      confirmLabel: "Enviar solicitação",
    });
    if (!ok) return;
    setSending(true);
    try {
      await api("/api/reservations", { method: "POST", body: { listingId: listing.id, checkIn: range.checkIn, checkOut: range.checkOut, guests, message: message.trim(), couponId: couponId || undefined } });
      toast("Solicitação enviada! O anfitrião vai responder em breve.");
      navigate("/viagens");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  if (viewer?.isOwner)
    return (
      <div className="booking-card">
        <div className="booking-price">
          <strong>{brl(listing.price)}</strong> <span>noite</span>
        </div>
        <p className="muted">Este é o seu anúncio. Os pedidos de reserva aparecem no painel do anfitrião.</p>
        <Link to="/anfitriao" className="btn btn-dark btn-block">
          Abrir painel do anfitrião
        </Link>
      </div>
    );

  return (
    <form className="booking-card" onSubmit={submit}>
      <div className="booking-price">
        <strong>{brl(listing.price)}</strong> <span>noite</span>
        <RatingBadge rating={listing.rating} count={listing.reviewCount} />
      </div>
      <div className="booking-fields">
        <button type="button" ref={anchor} className="booking-dates" onClick={() => setCalendarOpen(!calendarOpen)} aria-expanded={calendarOpen}>
          <span>
            <small>Check-in</small>
            <strong>{range.checkIn ? shortDate(range.checkIn) : "Adicionar"}</strong>
          </span>
          <span>
            <small>Check-out</small>
            <strong>{range.checkOut ? shortDate(range.checkOut) : "Adicionar"}</strong>
          </span>
        </button>
        <Popover open={calendarOpen} onClose={() => setCalendarOpen(false)} anchor={anchor} className="popover-booking">
          <div className="popover-title">
            <strong>{nights ? plural(nights, "noite", "noites") : "Escolha as datas"}</strong>
            <small>{nights ? dateRange(range.checkIn, range.checkOut) : `Mínimo de ${plural(listing.minNights, "noite", "noites")} · datas riscadas estão ocupadas`}</small>
          </div>
          <Calendar
            value={range}
            onChange={next => {
              setRange(next);
              if (next.checkOut) window.setTimeout(() => setCalendarOpen(false), 200);
            }}
            booked={detail.bookedRanges}
            months={mobile ? 1 : 2}
            minNights={listing.minNights}
          />
          <div className="popover-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRange({ checkIn: "", checkOut: "" })}>
              Limpar datas
            </button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => setCalendarOpen(false)}>
              Fechar
            </button>
          </div>
        </Popover>
        <div className="booking-guests">
          <span>
            <small>Hóspedes</small>
            <strong>{plural(guests, "hóspede", "hóspedes")}</strong>
          </span>
          <Stepper value={guests} onChange={setGuests} min={1} max={listing.guests} label="hóspedes" />
        </div>
      </div>

      {coupons.length > 0 && (
        <label className="field coupon-field">
          <span className="field-label">
            <Icon name="ticket" size={16} /> Cupom de Pontos Cívicos
          </span>
          <select value={couponId} onChange={event => setCouponId(event.target.value)}>
            <option value="">Não usar cupom</option>
            {coupons.map(item => (
              <option key={item.id} value={item.id}>
                {item.code} — {brl(item.amount)} de desconto
              </option>
            ))}
          </select>
        </label>
      )}

      {nights > 0 && (
        <label className="field">
          <span className="field-label">Mensagem para o anfitrião (opcional)</span>
          <textarea rows={3} value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} placeholder="Conte quem vem e o motivo da viagem." />
        </label>
      )}

      <button className="btn btn-primary btn-block btn-lg" disabled={sending || tooShort}>
        {sending ? "Enviando…" : !user ? "Entrar para reservar" : nights ? "Solicitar reserva" : "Verificar disponibilidade"}
      </button>
      {tooShort && <p className="form-error">Este espaço exige no mínimo {plural(listing.minNights, "noite", "noites")}.</p>}
      <p className="booking-note">Você ainda não será cobrado. O pagamento é combinado diretamente com o anfitrião.</p>

      {nights > 0 && (
        <div className="price-breakdown">
          <div>
            <span>
              {brl(listing.price)} × {plural(nights, "noite", "noites")}
            </span>
            <span>{brl(subtotal)}</span>
          </div>
          {listing.cleaningFee > 0 && (
            <div>
              <span>Taxa de limpeza</span>
              <span>{brl(listing.cleaningFee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="discount">
              <span>Cupom {coupon?.code}</span>
              <span>− {brl(discount)}</span>
            </div>
          )}
          <div>
            <span>Taxa SunHost</span>
            <span>Grátis</span>
          </div>
          <div className="total">
            <span>Total estimado</span>
            <span>{brl(total)}</span>
          </div>
          <p className="points-earn">
            <Icon name="sparkles" size={15} /> Você ganha {listing.points} Pontos Cívicos ao concluir esta estadia.
          </p>
        </div>
      )}
    </form>
  );
}

// -----------------------------------------------------------------------------
// Avaliações
// -----------------------------------------------------------------------------
function ReviewsBlock({ detail, reviews, total, onChanged }: { detail: ListingDetail; reviews: Review[]; total: number; onChanged: () => void }) {
  const { listing, viewer, breakdown } = detail;
  const { user, toast } = useApp();
  const mine = viewer?.myReview;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(mine?.rating || 0);
  const [body, setBody] = useState(mine?.body || "");
  const [sending, setSending] = useState(false);
  const max = Math.max(1, ...breakdown.map(item => item.count));

  useEffect(() => {
    setRating(mine?.rating || 0);
    setBody(mine?.body || "");
  }, [mine?.rating, mine?.body]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating) return toast("Escolha de 1 a 5 estrelas.", "error");
    setSending(true);
    try {
      await api(`/api/listings/${listing.id}/reviews`, { method: "POST", body: { rating, body } });
      toast(mine ? "Avaliação atualizada." : "Obrigado! Sua avaliação foi publicada.");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!mine || !(await confirmDialog({ title: "Excluir sua avaliação?", confirmLabel: "Excluir", danger: true }))) return;
    try {
      await api(`/api/reviews/${mine.id}`, { method: "DELETE" });
      toast("Avaliação excluída.", "info");
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const showForm = user && !viewer?.isOwner && (!mine || editing);

  return (
    <div className="reviews">
      <div className="reviews-summary">
        <div className="reviews-score">
          <strong>{listing.rating ? listing.rating.toFixed(1).replace(".", ",") : "—"}</strong>
          <Stars value={listing.rating || 0} size={18} />
          <span>{total ? plural(total, "avaliação", "avaliações") : "Ainda sem avaliações"}</span>
        </div>
        <div className="reviews-bars">
          {breakdown.map(item => (
            <div className="bar-row" key={item.stars}>
              <span>{item.stars}</span>
              <Icon name="star" size={12} filled />
              <span className="bar">
                <i style={{ width: `${(item.count / max) * 100}%` }} />
              </span>
              <span className="bar-count">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <form className="review-form" onSubmit={submit}>
          <h3>{mine ? "Editar sua avaliação" : "Avalie esta estadia"}</h3>
          {viewer?.hasCompletedStay ? (
            <p className="verified-hint">
              <Icon name="check-circle" size={16} /> Você se hospedou aqui — sua avaliação terá o selo de hóspede verificado.
            </p>
          ) : (
            <p className="muted small">Avaliações de quem concluiu uma estadia pela SunHost recebem o selo de hóspede verificado.</p>
          )}
          <StarInput value={rating} onChange={setRating} />
          <textarea rows={4} value={body} onChange={event => setBody(event.target.value)} placeholder="Como foi a experiência? Conte sobre limpeza, localização, comunicação…" minLength={5} maxLength={1000} required />
          <div className="form-actions">
            {mine && (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            )}
            <button className="btn btn-primary" disabled={sending}>
              {sending ? "Publicando…" : mine ? "Salvar avaliação" : "Publicar avaliação"}
            </button>
          </div>
        </form>
      )}
      {!user && (
        <div className="review-login">
          <Icon name="star" size={18} />
          <span>Já se hospedou aqui?</span>
          <Link to={`/entrar?voltar=${encodeURIComponent(`/acomodacao/${listing.id}#avaliacoes`)}`} className="btn btn-sm btn-outline">
            Entrar para avaliar
          </Link>
        </div>
      )}

      {reviews.length ? (
        <div className="review-list">
          {reviews.map(review => (
            <ReviewItem key={review.id} review={review} isMine={review.user.id === user?.id} canReply={Boolean(viewer?.isOwner)} onEdit={() => setEditing(true)} onDelete={remove} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <p className="muted">Este espaço ainda não recebeu avaliações. Que tal ser a primeira pessoa a contar como foi?</p>
      )}
    </div>
  );
}

function ReviewItem({ review, isMine, canReply, onEdit, onDelete, onChanged }: { review: Review; isMine: boolean; canReply: boolean; onEdit: () => void; onDelete: () => void; onChanged: () => void }) {
  const { toast } = useApp();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.hostReply);
  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api(`/api/reviews/${review.id}/reply`, { method: "POST", body: { reply } });
      toast(reply.trim() ? "Resposta publicada." : "Resposta removida.");
      setReplying(false);
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  return (
    <article className="review-item">
      <header>
        <Avatar name={review.user.name} url={review.user.avatarUrl} size={44} />
        <div>
          <strong>{review.user.name}</strong>
          <span>
            {longDate(review.createdAt)}
            {review.verified && (
              <em className="verified">
                <Icon name="check-circle" size={13} /> Hóspede verificado
              </em>
            )}
          </span>
        </div>
        <Stars value={review.rating} />
      </header>
      <p>{review.body}</p>
      {review.hostReply && !replying && (
        <div className="host-reply">
          <strong>Resposta do anfitrião</strong>
          <p>{review.hostReply}</p>
        </div>
      )}
      {replying && (
        <form className="reply-form" onSubmit={sendReply}>
          <textarea rows={3} value={reply} onChange={event => setReply(event.target.value)} placeholder="Agradeça e responda com cordialidade." maxLength={1000} autoFocus />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplying(false)}>
              Cancelar
            </button>
            <button className="btn btn-dark btn-sm">Publicar resposta</button>
          </div>
        </form>
      )}
      <div className="review-actions">
        {isMine && (
          <>
            <button className="link-btn" onClick={onEdit}>
              <Icon name="edit" size={15} /> Editar
            </button>
            <button className="link-btn danger" onClick={onDelete}>
              <Icon name="trash" size={15} /> Excluir
            </button>
          </>
        )}
        {canReply && !replying && (
          <button className="link-btn" onClick={() => setReplying(true)}>
            <Icon name="message" size={15} /> {review.hostReply ? "Editar resposta" : "Responder"}
          </button>
        )}
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Galeria em tela cheia e denúncia
// -----------------------------------------------------------------------------
function Lightbox({ images, index, onClose, onChange, title }: { images: string[]; index: number | null; onClose: () => void; onChange: (index: number) => void; title: string }) {
  useEffect(() => {
    if (index === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") onChange((index + 1) % images.length);
      if (event.key === "ArrowLeft") onChange((index - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, images.length, onChange]);
  if (index === null || !images.length) return null;
  return (
    <Modal open onClose={onClose} title={`${title} · foto ${index + 1} de ${images.length}`} size="full" className="lightbox">
      <div className="lightbox-stage">
        <button className="lightbox-arrow left" onClick={() => onChange((index - 1 + images.length) % images.length)} aria-label="Foto anterior">
          <Icon name="chevron-left" size={26} />
        </button>
        <img src={images[index]} alt={`${title}, foto ${index + 1}`} />
        <button className="lightbox-arrow right" onClick={() => onChange((index + 1) % images.length)} aria-label="Próxima foto">
          <Icon name="chevron-right" size={26} />
        </button>
      </div>
      <div className="lightbox-thumbs">
        {images.map((image, thumb) => (
          <button key={`${image}-${thumb}`} className={thumb === index ? "active" : ""} onClick={() => onChange(thumb)} aria-label={`Ver foto ${thumb + 1}`}>
            <img src={image} alt="" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function ReportModal({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: number }) {
  const { toast } = useApp();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const submit = async () => {
    if (!reason) return toast("Escolha um motivo.", "error");
    try {
      await api(`/api/listings/${listingId}/report`, { method: "POST", body: { reason, details } });
      toast("Denúncia enviada. A equipe vai analisar.", "info");
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Denunciar anúncio"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={submit}>
            Enviar denúncia
          </button>
        </>
      }
    >
      <p className="muted">Sua identidade não é mostrada ao anfitrião. Use este canal para golpes, informações falsas ou conteúdo impróprio.</p>
      <div className="radio-list">
        {REPORT_REASONS.map(item => (
          <label key={item} className={`radio-option${reason === item ? " checked" : ""}`}>
            <input type="radio" name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <label className="field">
        <span className="field-label">Detalhes (opcional)</span>
        <textarea rows={3} value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} />
      </label>
    </Modal>
  );
}
