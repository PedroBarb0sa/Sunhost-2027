/**
 * Página inicial: carrossel de Floripa, busca, destaques, bairros,
 * como funciona, Pontos Cívicos e chamada para anfitriões.
 */
import { useEffect, useState } from "react";
import { CATEGORIES, REWARDS, WELCOME_POINTS } from "@shared/catalog";
import { CATEGORY_ICONS, Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState, SkeletonCards, useDocumentTitle } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Link } from "@/lib/router";
import type { Listing } from "@/lib/types";

const HERO_SLIDES = [
  { image: "/assets/floripa-lagoa-amanhecer_e0cb2e0a.jpg", place: "Lagoa da Conceição", caption: "o amanhecer encontra a ilha" },
  { image: "/assets/floripa-ponte-hercilio-luz_d11d4d11.jpg", place: "Ponte Hercílio Luz", caption: "um símbolo que liga histórias" },
  { image: "/assets/floripa-praia-mole_9e90ce3d.jpg", place: "Praia Mole", caption: "mar aberto e Mata Atlântica" },
];

const NEIGHBORHOODS = [
  { name: "Lagoa da Conceição", image: "/assets/floripa-lagoa-amanhecer_e0cb2e0a.jpg", text: "Cafés, esportes na água e o melhor pôr do sol." },
  { name: "Praia Mole", image: "/assets/floripa-praia-mole_9e90ce3d.jpg", text: "Mar aberto, trilhas e Mata Atlântica." },
  { name: "Centro", image: "/assets/floripa-ponte-hercilio-luz_d11d4d11.jpg", text: "História, mercado público e vida urbana." },
  { name: "Barra da Lagoa", image: "/assets/sunhost-praia-mole-deck_86704beb.jpg", text: "Vila de pescadores e piscinas naturais." },
  { name: "Campeche", image: "/assets/sunhost-lagoa-veranda_a1bc7f2e.jpg", text: "Sul da ilha, ondas e ritmo tranquilo." },
];

export default function Home() {
  useDocumentTitle("");
  const { user } = useApp();
  const [slide, setSlide] = useState(0);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % HERO_SLIDES.length), 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api<{ listings: Listing[] }>("/api/listings")
      .then(data => setListings(data.listings))
      .catch(err => {
        setError(err.message);
        setListings([]);
      });
  }, []);

  const featured = listings ? [...listings.filter(item => item.featured), ...listings.filter(item => !item.featured)].slice(0, 6) : null;
  const countIn = (district: string) => listings?.filter(item => item.district === district).length || 0;
  const active = HERO_SLIDES[slide];

  return (
    <>
      <section className="hero">
        {HERO_SLIDES.map((item, index) => (
          <img key={item.image} className={`hero-bg${index === slide ? " is-active" : ""}`} src={item.image} alt="" aria-hidden="true" />
        ))}
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="eyebrow eyebrow-light">
            <Icon name="sun" size={16} /> Hospedagens com propósito em Florianópolis
          </span>
          <h1>
            Fique perto do que faz <em>Floripa</em> ser única.
          </h1>
          <p>Espaços locais, bairros com personalidade e anfitriões da ilha. Sem taxas de serviço: você combina o pagamento direto com quem recebe.</p>
          <SearchBar variant="hero" />
          <div className="hero-caption" aria-live="off">
            <Icon name="pin" size={15} />
            <strong>{active.place}</strong>
            <span>{active.caption}</span>
            <div className="hero-dots">
              {HERO_SLIDES.map((item, index) => (
                <button key={item.place} className={index === slide ? "active" : ""} onClick={() => setSlide(index)} aria-label={`Mostrar foto: ${item.place}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="category-strip" aria-label="Tipos de espaço">
          {CATEGORIES.map(category => (
            <Link key={category} to={`/explorar?category=${encodeURIComponent(category)}`} className="category-chip">
              <Icon name={CATEGORY_ICONS[category] || "home"} size={22} />
              <span>{category}</span>
            </Link>
          ))}
        </div>

        <div className="section-head">
          <div>
            <span className="eyebrow">Selecionados pela equipe</span>
            <h2>
              Destaques da <em>ilha</em>
            </h2>
          </div>
          <Link to="/explorar" className="btn btn-outline">
            Ver todas as estadias <Icon name="arrow-right" size={18} />
          </Link>
        </div>
        {!featured ? (
          <SkeletonCards count={6} />
        ) : featured.length ? (
          <div className="listing-grid">
            {featured.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState icon="alert" title="Não foi possível carregar as estadias" text={error || "Nenhuma acomodação publicada ainda."} />
        )}
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Escolha pelo bairro</span>
              <h2>
                Cada canto da ilha tem o seu <em>ritmo.</em>
              </h2>
            </div>
            <p className="section-lead">Da Lagoa ao Campeche, encontre o bairro que combina com a sua viagem antes de escolher onde ficar.</p>
          </div>
          <div className="hood-grid">
            {NEIGHBORHOODS.map((hood, index) => (
              <Link key={hood.name} to={`/explorar?q=${encodeURIComponent(hood.name)}`} className={`hood-card${index === 0 ? " hood-large" : ""}`}>
                <img src={hood.image} alt="" loading="lazy" />
                <span className="hood-info">
                  <strong>{hood.name}</strong>
                  <small>{hood.text}</small>
                  <em>{countIn(hood.name) ? `${countIn(hood.name)} ${countIn(hood.name) === 1 ? "estadia" : "estadias"}` : "Ver estadias"}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head centered">
          <div>
            <span className="eyebrow">Simples e transparente</span>
            <h2>
              Como o <em>SunHost</em> funciona
            </h2>
          </div>
        </div>
        <div className="steps">
          <div className="step">
            <span className="step-icon">
              <Icon name="search" size={24} />
            </span>
            <span className="step-number">01</span>
            <h3>Encontre o seu lugar</h3>
            <p>Busque por bairro, datas e número de hóspedes. Veja fotos, comodidades, regras e avaliações com estrelas.</p>
          </div>
          <div className="step">
            <span className="step-icon">
              <Icon name="send" size={24} />
            </span>
            <span className="step-number">02</span>
            <h3>Solicite a reserva</h3>
            <p>Envie as datas e uma mensagem. O anfitrião aceita ou recusa, e vocês conversam pela própria reserva.</p>
          </div>
          <div className="step">
            <span className="step-icon">
              <Icon name="phone" size={24} />
            </span>
            <span className="step-number">03</span>
            <h3>Combine direto com o anfitrião</h3>
            <p>Com a reserva confirmada, os contatos são liberados e o pagamento é acertado diretamente, sem taxa da plataforma.</p>
          </div>
        </div>
        <div className="trust-row">
          <span>
            <Icon name="shield" size={18} /> Anúncios revisados pela equipe
          </span>
          <span>
            <Icon name="star" size={18} /> Avaliações de hóspedes verificados
          </span>
          <span>
            <Icon name="ticket" size={18} /> Sem taxa de serviço
          </span>
          <span>
            <Icon name="flag" size={18} /> Denúncia de anúncios suspeitos
          </span>
        </div>
      </section>

      <section className="points-band" id="pontos">
        <div className="container points-grid">
          <div className="points-copy">
            <span className="eyebrow eyebrow-light">
              <Icon name="sparkles" size={16} /> Pontos Cívicos
            </span>
            <h2>
              Fique na ilha. <em>Volte com desconto.</em>
            </h2>
            <p>Cada estadia concluída rende de 50 a 120 Pontos Cívicos. Troque o saldo por cupons de desconto e apresente o código ao anfitrião na próxima reserva — uma forma de movimentar a economia local e fazer a viagem deixar boas marcas em Florianópolis.</p>
            <div className="points-actions">
              {user ? (
                <Link to="/pontos" className="btn btn-primary btn-lg">
                  Ver meu saldo <Icon name="arrow-right" size={18} />
                </Link>
              ) : (
                <Link to="/cadastro" className="btn btn-primary btn-lg">
                  Criar conta e ganhar {WELCOME_POINTS} pts <Icon name="arrow-right" size={18} />
                </Link>
              )}
            </div>
          </div>
          <div className="reward-tiles">
            {REWARDS.map(reward => (
              <div className="reward-tile" key={reward.id}>
                <span className="reward-pts">
                  <Icon name="sparkles" size={14} /> {reward.points} pts
                </span>
                <strong>R$ {reward.amount}</strong>
                <small>{reward.detail}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="host-cta">
          <div className="host-cta-image">
            <img src="/assets/sunhost-praia-mole-living_57e96078.jpg" alt="" loading="lazy" />
          </div>
          <div className="host-cta-copy">
            <span className="eyebrow">Para anfitriões</span>
            <h2>
              Tem um espaço na ilha? <em>Receba viajantes.</em>
            </h2>
            <ul className="check-list">
              <li>
                <Icon name="check" size={18} /> Anúncio gratuito, com até 12 fotos enviadas do celular
              </li>
              <li>
                <Icon name="check" size={18} /> Você aceita ou recusa cada pedido de reserva
              </li>
              <li>
                <Icon name="check" size={18} /> Pagamento combinado direto com o hóspede, sem comissão
              </li>
            </ul>
            <Link to={user ? "/anfitriao/novo" : "/cadastro?voltar=/anfitriao/novo"} className="btn btn-dark btn-lg">
              Anunciar meu espaço <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
