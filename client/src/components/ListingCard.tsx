/**
 * Cartão de acomodação: galeria com setas, pontos e deslize no celular,
 * coração de favorito, nota em estrelas, preço e Pontos Cívicos.
 */
import { type TouchEvent, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { brl, plural } from "@/lib/format";
import { Link } from "@/lib/router";
import type { Listing } from "@/lib/types";
import { Icon } from "./Icon";
import { RatingBadge } from "./ui";

export function ListingCard({ listing, nights = 0, query = "" }: { listing: Listing; nights?: number; query?: string }) {
  const { isFavorite, toggleFavorite } = useApp();
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const images = listing.images.length ? listing.images : [""];
  const saved = isFavorite(listing.id);
  const href = `/acomodacao/${listing.id}${query}`;

  const go = (delta: number) => setIndex(current => (current + delta + images.length) % images.length);
  const onTouchStart = (event: TouchEvent) => (touchStart.current = event.touches[0].clientX);
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
    touchStart.current = null;
  };

  return (
    <article className="listing-card">
      <div className="card-media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Link to={href} className="card-media-link" aria-label={`Ver ${listing.title}`} tabIndex={-1}>
          <div className="card-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {images.map((image, imageIndex) =>
              image ? (
                <img key={`${image}-${imageIndex}`} src={image} alt="" loading="lazy" draggable={false} />
              ) : (
                <div key="placeholder" className="card-placeholder">
                  <Icon name="image" size={32} />
                </div>
              )
            )}
          </div>
        </Link>
        <div className="card-badges">
          {listing.featured && (
            <span className="badge badge-light">
              <Icon name="sparkles" size={13} /> Destaque
            </span>
          )}
        </div>
        <button
          className={`card-fav${saved ? " is-saved" : ""}`}
          onClick={() => toggleFavorite(listing)}
          aria-label={saved ? `Remover ${listing.title} dos favoritos` : `Salvar ${listing.title} nos favoritos`}
          aria-pressed={saved}
        >
          <Icon name="heart" size={20} filled={saved} strokeWidth={2} />
        </button>
        {images.length > 1 && (
          <>
            <button className="card-arrow card-arrow-left" onClick={() => go(-1)} aria-label="Foto anterior">
              <Icon name="chevron-left" size={16} strokeWidth={2.4} />
            </button>
            <button className="card-arrow card-arrow-right" onClick={() => go(1)} aria-label="Próxima foto">
              <Icon name="chevron-right" size={16} strokeWidth={2.4} />
            </button>
            <div className="card-dots" aria-hidden="true">
              {images.map((_, dot) => (
                <i key={dot} className={dot === index ? "active" : ""} />
              ))}
            </div>
          </>
        )}
      </div>
      <Link to={href} className="card-body">
        <div className="card-row">
          <span className="card-place">
            <Icon name="pin" size={14} /> {listing.district}
          </span>
          <RatingBadge rating={listing.rating} count={listing.reviewCount} />
        </div>
        <h3 className="card-title">{listing.title}</h3>
        <p className="card-meta">
          {listing.category} · {plural(listing.guests, "hóspede", "hóspedes")} · {plural(listing.bedrooms, "quarto", "quartos")}
        </p>
        <div className="card-row card-bottom">
          <p className="card-price">
            <strong>{brl(listing.price)}</strong> <span>noite</span>
            {nights > 0 && <em>{brl(listing.price * nights + listing.cleaningFee)} no total</em>}
          </p>
          <span className="points-chip" title="Pontos Cívicos ganhos ao concluir a estadia">
            <Icon name="sparkles" size={13} /> {listing.points} pts
          </span>
        </div>
      </Link>
    </article>
  );
}
