/**
 * Cartão de reserva (visão do hóspede ou do anfitrião) e conversa da reserva.
 */
import { type FormEvent, useEffect, useRef, useState } from "react";
import { setActiveChat, useApp, useRealtime } from "@/context/AppContext";
import { api, errorMessage } from "@/lib/api";
import { brl, clockTime, dateRange, formatPhone, longDate, plural, timeAgo, whatsappLink } from "@/lib/format";
import { Link } from "@/lib/router";
import type { Message, RealtimeMessage, Reservation } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Modal, StarInput, StatusPill, confirmDialog } from "./ui";

export function ReservationCard({ reservation, onChanged }: { reservation: Reservation; onChanged: (next: Reservation) => void }) {
  const { toast, refreshHostPending, refreshUnread } = useApp();
  const [chatOpen, setChatOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const asHost = reservation.role === "host";
  const other = asHost ? reservation.guest : reservation.host;
  const confirmed = reservation.status === "confirmed";

  const act = async (action: "accept" | "decline" | "cancel") => {
    const copy = {
      accept: { title: "Aceitar esta reserva?", message: "As datas ficam bloqueadas e os contatos de vocês dois são liberados para combinar o pagamento.", confirmLabel: "Aceitar reserva", danger: false, noteLabel: "Mensagem de boas-vindas (opcional)" },
      decline: { title: "Recusar esta solicitação?", message: "O hóspede será avisado e poderá escolher outras datas.", confirmLabel: "Recusar", danger: true, noteLabel: "Motivo (opcional)" },
      cancel: { title: "Cancelar esta reserva?", message: "Esta ação não pode ser desfeita. Se houver cupom aplicado, ele volta a ficar disponível.", confirmLabel: "Cancelar reserva", danger: true, noteLabel: "Motivo (opcional)" },
    }[action];
    const result = await confirmDialog(copy);
    if (!result) return;
    setBusy(true);
    try {
      const next = await api<Reservation>(`/api/reservations/${reservation.id}`, { method: "PATCH", body: { action, note: result.note } });
      if (action === "accept" && result.note) await api(`/api/reservations/${reservation.id}/messages`, { method: "POST", body: { body: result.note } }).catch(() => undefined);
      onChanged(next);
      refreshHostPending();
      toast(action === "accept" ? "Reserva confirmada! Os contatos foram liberados." : action === "decline" ? "Solicitação recusada." : "Reserva cancelada.", action === "accept" ? "success" : "info");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`reservation-card stage-${reservation.stage}`}>
      <Link to={reservation.listing ? `/acomodacao/${reservation.listing.id}` : "#"} className="reservation-thumb">
        {reservation.listing?.image ? <img src={reservation.listing.image} alt="" loading="lazy" /> : <Icon name="image" size={28} />}
      </Link>
      <div className="reservation-body">
        <div className="reservation-top">
          <StatusPill status={reservation.stage} />
          <span className="muted small">Pedido {timeAgo(reservation.createdAt)}</span>
        </div>
        <h3>
          <Link to={reservation.listing ? `/acomodacao/${reservation.listing.id}` : "#"}>{reservation.listing?.title || "Anúncio removido"}</Link>
        </h3>
        <p className="reservation-meta">
          <span>
            <Icon name="calendar" size={15} /> {dateRange(reservation.checkIn, reservation.checkOut)} · {plural(reservation.nights, "noite", "noites")}
          </span>
          <span>
            <Icon name="users" size={15} /> {plural(reservation.guests, "hóspede", "hóspedes")}
          </span>
          <span>
            <Icon name="ticket" size={15} /> {brl(reservation.total)}
            {reservation.coupon && <em className="coupon-tag">cupom {reservation.coupon.code} −{brl(reservation.coupon.amount)}</em>}
          </span>
        </p>

        <div className="reservation-person">
          <Avatar name={other.name} url={other.avatarUrl} size={36} />
          <div>
            <small>{asHost ? "Hóspede" : "Anfitrião"}</small>
            <strong>{other.name}</strong>
          </div>
          {confirmed && (other.phone || other.email) && (
            <div className="contact-links">
              {other.phone && (
                <a className="btn btn-sm btn-whatsapp" href={whatsappLink(other.phone, `Olá, ${other.name.split(" ")[0]}! Sobre a reserva SunHost de ${dateRange(reservation.checkIn, reservation.checkOut)}.`)} target="_blank" rel="noreferrer">
                  <Icon name="phone" size={15} /> {formatPhone(other.phone)}
                </a>
              )}
              {other.email && (
                <a className="btn btn-sm btn-ghost" href={`mailto:${other.email}`}>
                  <Icon name="mail" size={15} /> E-mail
                </a>
              )}
            </div>
          )}
        </div>

        {confirmed && (
          <p className="reservation-hint">
            <Icon name="info" size={15} />
            {asHost
              ? `Combine o pagamento de ${brl(reservation.total)} diretamente com o hóspede.${reservation.coupon ? ` Desconto do cupom ${reservation.coupon.code} já incluso.` : ""}`
              : `Combine o pagamento de ${brl(reservation.total)} diretamente com o anfitrião. Check-in a partir das ${reservation.listing?.checkInTime || "14:00"}.`}
          </p>
        )}
        {reservation.status === "pending" && (
          <p className="reservation-hint">
            <Icon name="clock" size={15} /> {asHost ? "Responda logo: o hóspede está aguardando." : "Aguardando a resposta do anfitrião. Os contatos são liberados após a confirmação."}
          </p>
        )}
        {reservation.statusNote && ["declined", "cancelled"].includes(reservation.status) && <p className="reservation-note">“{reservation.statusNote}”</p>}

        <div className="reservation-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => setChatOpen(true)}>
            <Icon name="message" size={16} /> Conversa
            {reservation.unreadCount > 0 ? (
              <span className="count-badge" aria-label={`${reservation.unreadCount} mensagens não lidas`}>
                {reservation.unreadCount}
              </span>
            ) : (
              reservation.messageCount > 0 && <span className="count-muted">{reservation.messageCount}</span>
            )}
          </button>
          {reservation.canRespond && (
            <>
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act("accept")}>
                <Icon name="check" size={16} /> Aceitar
              </button>
              <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => act("decline")}>
                Recusar
              </button>
            </>
          )}
          {reservation.canReview && (
            <button className="btn btn-sm btn-primary" onClick={() => setReviewOpen(true)}>
              <Icon name="star" size={16} /> Avaliar estadia
            </button>
          )}
          {reservation.canCancel && (
            <button className="btn btn-sm btn-ghost danger" disabled={busy} onClick={() => act("cancel")}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      <ChatModal
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          onChanged({ ...reservation, unreadCount: 0 });
          refreshUnread();
        }}
        onCount={count => count !== reservation.messageCount && onChanged({ ...reservation, messageCount: count, unreadCount: 0 })}
        reservation={reservation}
      />
      {reservation.listing && <QuickReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} listingId={reservation.listing.id} title={reservation.listing.title} onDone={() => onChanged({ ...reservation, canReview: false })} />}
    </article>
  );
}

export function ChatModal({ open, onClose, reservation, onCount }: { open: boolean; onClose: () => void; reservation: Reservation; onCount?: (count: number) => void }) {
  const { toast, user, live, refreshUnread } = useApp();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const other = reservation.role === "host" ? reservation.guest : reservation.host;
  const canWrite = reservation.role !== "admin";

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const load = () =>
      api<Message[]>(`/api/reservations/${reservation.id}/messages`)
        .then(rows => alive && setMessages(rows))
        .catch(() => undefined);
    load().then(() => refreshUnread());
    setActiveChat(reservation.id);
    // As mensagens chegam na hora pela conexão em tempo real; esta consulta
    // periódica é só uma garantia caso a conexão caia (rede instável).
    const timer = window.setInterval(load, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      setActiveChat(null);
    };
  }, [open, reservation.id, refreshUnread]);

  useRealtime<RealtimeMessage>("message", data => {
    if (!open || data.reservationId !== reservation.id) return;
    setMessages(current => {
      const list = current || [];
      if (list.some(item => item.id === data.message.id)) return list;
      return [...list, { ...data.message, mine: data.message.sender.id === user?.id }];
    });
    // Mantém a conversa marcada como lida enquanto está aberta.
    if (data.message.sender.id !== user?.id) api(`/api/reservations/${reservation.id}/messages`).catch(() => undefined);
  });

  useEffect(() => {
    if (messages) onCount?.(messages.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const message = await api<Message>(`/api/reservations/${reservation.id}/messages`, { method: "POST", body: { body } });
      setMessages(current => (current || []).some(item => item.id === message.id) ? current : [...(current || []), message]);
    } catch (err) {
      setText(body);
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Conversa com ${other.name}`} size="md" className="chat-modal">
      <p className="chat-context">
        <span>
          {reservation.listing?.title} · {dateRange(reservation.checkIn, reservation.checkOut)}
        </span>
        <span className={`live-pill${live ? " on" : ""}`}>{live ? "Ao vivo" : "Reconectando…"}</span>
      </p>
      <div className="chat-list" ref={listRef}>
        {messages === null ? (
          <p className="muted">Carregando…</p>
        ) : messages.length ? (
          messages.map((message, index) => {
            const showDay = index === 0 || longDate(messages[index - 1].createdAt) !== longDate(message.createdAt);
            return (
              <div key={message.id}>
                {showDay && <span className="chat-day">{longDate(message.createdAt)}</span>}
                <div className={`bubble${message.mine ? " mine" : ""}`}>
                  {!message.mine && <strong>{message.sender.name}</strong>}
                  <p>{message.body}</p>
                  <time>{clockTime(message.createdAt)}</time>
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted chat-empty">Nenhuma mensagem ainda. Diga olá e combine os detalhes da estadia.</p>
        )}
      </div>
      {canWrite && (
        <form className="chat-form" onSubmit={send}>
          <input value={text} onChange={event => setText(event.target.value)} placeholder="Escreva uma mensagem…" maxLength={1000} aria-label="Mensagem" />
          <button className="btn btn-primary" aria-label="Enviar mensagem" disabled={!text.trim()}>
            <Icon name="send" size={18} />
          </button>
        </form>
      )}
      <p className="chat-safety">
        <Icon name="shield" size={14} /> Nunca envie senhas ou dados de cartão. Desconfie de pedidos de pagamento antecipado fora do combinado.
      </p>
    </Modal>
  );
}

export function QuickReviewModal({ open, onClose, listingId, title, onDone }: { open: boolean; onClose: () => void; listingId: number; title: string; onDone: () => void }) {
  const { toast } = useApp();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!rating) return toast("Escolha de 1 a 5 estrelas.", "error");
    if (body.trim().length < 5) return toast("Escreva pelo menos 5 caracteres.", "error");
    setSending(true);
    try {
      await api(`/api/listings/${listingId}/reviews`, { method: "POST", body: { rating, body } });
      toast("Obrigado! Sua avaliação verificada foi publicada.");
      onDone();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Avaliar estadia"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Depois
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={sending}>
            Publicar avaliação
          </button>
        </>
      }
    >
      <p className="muted">{title}</p>
      <StarInput value={rating} onChange={setRating} />
      <label className="field">
        <span className="field-label">Conte como foi</span>
        <textarea rows={4} value={body} onChange={event => setBody(event.target.value)} maxLength={1000} placeholder="Limpeza, localização, comunicação com o anfitrião…" />
      </label>
    </Modal>
  );
}
