/**
 * Explorar: busca com filtros sincronizados na URL (compartilhável).
 */
import { useEffect, useMemo, useState } from "react";
import { AMENITIES, CATEGORIES } from "@shared/catalog";
import { AMENITY_ICONS, CATEGORY_ICONS, Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState, Modal, SkeletonCards, useDocumentTitle } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { dateRange, nightsBetween } from "@/lib/format";
import { useSearchParams } from "@/lib/router";
import type { Listing } from "@/lib/types";

const SORTS = [
  { value: "relevance", label: "Relevância" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "rating", label: "Melhor avaliadas" },
  { value: "newest", label: "Mais recentes" },
];

export default function Explore() {
  useDocumentTitle("Explorar estadias");
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get("q") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = Number(params.get("guests") || 0);
  const category = params.get("category") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const amenities = (params.get("amenities") || "").split(",").filter(Boolean);
  const sort = params.get("sort") || "relevance";
  const queryString = params.toString();
  const nights = nightsBetween(checkIn, checkOut);

  useEffect(() => {
    const controller = new AbortController();
    setListings(null);
    setError("");
    api<{ listings: Listing[] }>(`/api/listings?${queryString}`, { signal: controller.signal })
      .then(data => setListings(data.listings))
      .catch(err => {
        if (err?.name === "AbortError") return;
        setError(errorMessage(err));
        setListings([]);
      });
    return () => controller.abort();
  }, [queryString]);

  const initial = useMemo(() => ({ q, checkIn, checkOut, guests }), [q, checkIn, checkOut, guests]);
  const activeFilters = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + amenities.length;
  const cardQuery = checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}${guests ? `&guests=${guests}` : ""}` : guests ? `?guests=${guests}` : "";
  const clearAll = () => setParams({ q: "", checkIn: "", checkOut: "", guests: "", category: "", minPrice: "", maxPrice: "", amenities: "", sort: "" });

  const summary = [q && `“${q}”`, checkIn && checkOut && dateRange(checkIn, checkOut), guests ? `${guests} ${guests === 1 ? "hóspede" : "hóspedes"}` : "", category].filter(Boolean).join(" · ");

  return (
    <div className="page explore-page">
      <div className="explore-top">
        <div className="container">
          <SearchBar variant="compact" initial={initial} onSearch={values => setParams({ q: values.q.trim(), checkIn: values.checkIn && values.checkOut ? values.checkIn : "", checkOut: values.checkIn && values.checkOut ? values.checkOut : "", guests: values.guests || "" })} />
          <div className="filter-bar">
            <div className="chip-scroll" role="group" aria-label="Tipo de espaço">
              <button className={`chip${!category ? " active" : ""}`} onClick={() => setParams({ category: "" })}>
                <Icon name="grid" size={16} /> Todos
              </button>
              {CATEGORIES.map(item => (
                <button key={item} className={`chip${category === item ? " active" : ""}`} onClick={() => setParams({ category: category === item ? "" : item })} aria-pressed={category === item}>
                  <Icon name={CATEGORY_ICONS[item] || "home"} size={16} /> {item}
                </button>
              ))}
            </div>
            <div className="filter-actions">
              <button className={`chip chip-outline${activeFilters ? " has-count" : ""}`} onClick={() => setFiltersOpen(true)}>
                <Icon name="sliders" size={16} /> Filtros {activeFilters > 0 && <span className="chip-count">{activeFilters}</span>}
              </button>
              <label className="sort-select">
                <span className="sr-only">Ordenar por</span>
                <select value={sort} onChange={event => setParams({ sort: event.target.value === "relevance" ? "" : event.target.value })}>
                  {SORTS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" size={16} />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="results-head">
          <h1>{listings === null ? "Buscando estadias…" : `${listings.length} ${listings.length === 1 ? "estadia encontrada" : "estadias encontradas"}`}</h1>
          {summary && <p>{summary}</p>}
          {(summary || activeFilters > 0) && (
            <button className="link-btn" onClick={clearAll}>
              Limpar busca
            </button>
          )}
        </div>
        {nights > 0 && <p className="results-note"><Icon name="info" size={16} /> Mostrando apenas espaços livres de {dateRange(checkIn, checkOut)} ({nights} {nights === 1 ? "noite" : "noites"}). O total inclui a taxa de limpeza.</p>}
        {listings === null ? (
          <SkeletonCards count={6} />
        ) : listings.length ? (
          <div className="listing-grid">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} nights={nights} query={cardQuery} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={error ? "alert" : "search"}
            title={error ? "Não foi possível buscar" : "Nenhuma estadia com esses critérios"}
            text={error || "Tente outras datas, menos filtros ou um bairro vizinho."}
            action={
              <button className="btn btn-primary" onClick={clearAll}>
                Ver todas as estadias
              </button>
            }
          />
        )}
      </div>

      <FiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initial={{ minPrice, maxPrice, amenities }}
        onApply={values => {
          setParams({ minPrice: values.minPrice, maxPrice: values.maxPrice, amenities: values.amenities.join(",") });
          setFiltersOpen(false);
        }}
      />
    </div>
  );
}

function FiltersModal({ open, onClose, initial, onApply }: { open: boolean; onClose: () => void; initial: { minPrice: string; maxPrice: string; amenities: string[] }; onApply: (values: { minPrice: string; maxPrice: string; amenities: string[] }) => void }) {
  const [values, setValues] = useState(initial);
  useEffect(() => {
    if (open) setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (amenity: string) => setValues(current => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter(item => item !== amenity) : [...current.amenities, amenity] }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtros"
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setValues({ minPrice: "", maxPrice: "", amenities: [] })}>
            Limpar tudo
          </button>
          <button className="btn btn-primary" onClick={() => onApply(values)}>
            Mostrar resultados
          </button>
        </>
      }
    >
      <section className="filter-section">
        <h3>Preço por noite</h3>
        <div className="price-inputs">
          <label className="field">
            <span className="field-label">Mínimo (R$)</span>
            <input type="number" min={0} inputMode="numeric" value={values.minPrice} onChange={event => setValues({ ...values, minPrice: event.target.value })} placeholder="0" />
          </label>
          <span className="price-dash">—</span>
          <label className="field">
            <span className="field-label">Máximo (R$)</span>
            <input type="number" min={0} inputMode="numeric" value={values.maxPrice} onChange={event => setValues({ ...values, maxPrice: event.target.value })} placeholder="Sem limite" />
          </label>
        </div>
        <div className="quick-prices">
          {[200, 300, 400].map(value => (
            <button type="button" key={value} className={`chip${values.maxPrice === String(value) ? " active" : ""}`} onClick={() => setValues({ ...values, minPrice: "", maxPrice: String(value) })}>
              Até R$ {value}
            </button>
          ))}
        </div>
      </section>
      <section className="filter-section">
        <h3>Comodidades</h3>
        <div className="amenity-picker">
          {AMENITIES.map(amenity => (
            <label key={amenity} className={`amenity-option${values.amenities.includes(amenity) ? " checked" : ""}`}>
              <input type="checkbox" checked={values.amenities.includes(amenity)} onChange={() => toggle(amenity)} />
              <Icon name={AMENITY_ICONS[amenity] || "check"} size={18} />
              <span>{amenity}</span>
            </label>
          ))}
        </div>
      </section>
    </Modal>
  );
}
