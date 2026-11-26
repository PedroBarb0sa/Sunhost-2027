/**
 * Dados iniciais da demonstração: anfitriã e hóspede de exemplo e as seis
 * acomodações do catálogo original. Nenhuma avaliação é inventada; a conta de
 * hóspede já tem uma estadia concluída para que o fluxo de avaliação possa ser
 * apresentado na hora.
 */
import { pointsForPrice } from "../shared/catalog";

export const DEMO_PASSWORD = "Floripa@2026";

export const DEMO_HOST = {
  name: "Marina Costa",
  email: "anfitria@sunhost.local",
  phone: "48999990001",
  bio: "Nascida em Florianópolis, recebo viajantes na Lagoa e no Leste da Ilha desde 2019. Adoro indicar trilhas, cafés e o melhor horário para ver o pôr do sol.",
};

export const DEMO_GUEST = {
  name: "Lucas Andrade",
  email: "hospede@sunhost.local",
  phone: "48999990002",
  bio: "Viajo a trabalho e a lazer. Gosto de lugares silenciosos e perto do mar.",
};

type SeedListing = {
  title: string;
  district: string;
  category: string;
  price: number;
  cleaningFee: number;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minNights: number;
  description: string;
  amenities: string[];
  houseRules: string;
  localNote: string;
  featured: boolean;
  photos: string[];
};

export const SEED_LISTINGS: SeedListing[] = [
  {
    title: "Apartamento aberto para a Lagoa",
    district: "Lagoa da Conceição",
    category: "Apartamento inteiro",
    price: 280,
    cleaningFee: 60,
    guests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    minNights: 2,
    description:
      "Uma estadia iluminada, feita para dias sem pressa entre cafés na Lagoa, caminhadas e o encontro com o pôr do sol. A varanda dá para a água e a mesa de trabalho fica de frente para a janela.",
    amenities: ["Wi‑Fi", "Varanda", "Cozinha equipada", "Espaço de trabalho", "Vista para o mar", "Máquina de lavar"],
    houseRules: "Não é permitido fumar dentro do apartamento.\nSilêncio após as 22h.\nNão são permitidas festas.",
    localNote: "Roteiro da Lagoa",
    featured: true,
    photos: [
      "/assets/sunhost-lagoa-apartment_26ce4478.jpg",
      "/assets/sunhost-lagoa-bedroom_7c607e34.jpg",
      "/assets/sunhost-lagoa-veranda_a1bc7f2e.jpg",
    ],
  },
  {
    title: "Casa de madeira entre morro e mar",
    district: "Praia Mole",
    category: "Casa inteira",
    price: 320,
    cleaningFee: 90,
    guests: 5,
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    minNights: 2,
    description:
      "Para acordar perto da praia, abrir as portas para a brisa e fazer da natureza parte do roteiro da viagem. Deck amplo, chuveiro externo para depois do mar e trilha para a Galheta a poucos minutos.",
    amenities: ["Wi‑Fi", "Chuveiro externo", "Cozinha equipada", "Estacionamento", "Churrasqueira", "Varanda"],
    houseRules: "Animais de estimação sob consulta.\nRecolha o lixo reciclável separado.\nSilêncio após as 22h.",
    localNote: "Trilha e mar perto",
    featured: true,
    photos: [
      "/assets/sunhost-praia-mole-home_87796aad.jpg",
      "/assets/sunhost-praia-mole-living_57e96078.jpg",
      "/assets/sunhost-praia-mole-deck_86704beb.jpg",
    ],
  },
  {
    title: "Estúdio com ritmo de cidade",
    district: "Centro",
    category: "Estúdio/Loft",
    price: 200,
    cleaningFee: 40,
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    minNights: 1,
    description:
      "Um ponto de partida leve e bem pensado para quem quer circular a pé por museus, mercados, cafés e história. Fica a duas quadras do Mercado Público e perto dos ônibus para as praias.",
    amenities: ["Wi‑Fi", "Ar-condicionado", "Cozinha equipada", "Máquina de lavar", "TV", "Espaço de trabalho"],
    houseRules: "Check-in autônomo com senha.\nNão é permitido fumar.\nMáximo de 2 hóspedes.",
    localNote: "Centro histórico a pé",
    featured: true,
    photos: ["/assets/sunhost-centro-studio_3becdd2b.jpg", "/assets/sunhost-centro-kitchen_c9ad79a4.jpg"],
  },
  {
    title: "Refúgio com varanda para o mar",
    district: "Barra da Lagoa",
    category: "Casa inteira",
    price: 260,
    cleaningFee: 70,
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    minNights: 2,
    description:
      "Um refúgio arejado para desacelerar perto do mar e dos caminhos da ilha. A vila de pescadores, a piscina natural e o canal ficam a uma caminhada curta.",
    amenities: ["Wi‑Fi", "Varanda", "Cozinha equipada", "Vista para o mar", "Pé na areia", "Aceita pets"],
    houseRules: "Pets de pequeno porte são bem-vindos.\nSilêncio após as 22h.",
    localNote: "Mar e trilhas por perto",
    featured: false,
    photos: [
      "/assets/floripa-praia-mole_9e90ce3d.jpg",
      "/assets/sunhost-praia-mole-deck_86704beb.jpg",
      "/assets/sunhost-lagoa-veranda_a1bc7f2e.jpg",
    ],
  },
  {
    title: "Loft solar no Campeche",
    district: "Campeche",
    category: "Estúdio/Loft",
    price: 240,
    cleaningFee: 50,
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    minNights: 1,
    description:
      "Loft compacto com luz natural para quem quer trabalhar e explorar o sul da ilha. A praia do Campeche fica a 600 metros e a padaria da esquina abre às 6h.",
    amenities: ["Wi‑Fi", "Espaço de trabalho", "Ar-condicionado", "Cozinha equipada", "Estacionamento"],
    houseRules: "Não é permitido fumar.\nNão são permitidas festas.",
    localNote: "Café e praia a pé",
    featured: false,
    photos: [
      "/assets/sunhost-centro-studio_3becdd2b.jpg",
      "/assets/floripa-lagoa-amanhecer_e0cb2e0a.jpg",
      "/assets/sunhost-centro-kitchen_c9ad79a4.jpg",
    ],
  },
  {
    title: "Casa jardim na Lagoa",
    district: "Lagoa da Conceição",
    category: "Casa inteira",
    price: 390,
    cleaningFee: 120,
    guests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    minNights: 3,
    description:
      "Casa ampla para reunir a família, cozinhar sem pressa e viver a Lagoa. Jardim com rede, churrasqueira e espaço para as crianças brincarem.",
    amenities: ["Jardim", "Cozinha equipada", "Wi‑Fi", "Estacionamento", "Churrasqueira", "Máquina de lavar", "TV"],
    houseRules: "Ideal para famílias.\nSilêncio após as 22h.\nNão são permitidas festas.",
    localNote: "Dias longos na ilha",
    featured: false,
    photos: [
      "/assets/sunhost-lagoa-veranda_a1bc7f2e.jpg",
      "/assets/sunhost-lagoa-apartment_26ce4478.jpg",
      "/assets/sunhost-lagoa-bedroom_7c607e34.jpg",
    ],
  },
];

export function seedListingRow(listing: SeedListing, ownerId: string) {
  return {
    owner_id: ownerId,
    title: listing.title,
    district: listing.district,
    category: listing.category,
    price: listing.price,
    cleaning_fee: listing.cleaningFee,
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    min_nights: listing.minNights,
    description: listing.description,
    amenities: listing.amenities,
    house_rules: listing.houseRules,
    check_in_time: "14:00",
    check_out_time: "11:00",
    local_note: listing.localNote,
    points: pointsForPrice(listing.price),
    featured: listing.featured,
    status: "approved",
    moderation_note: "Anúncio de demonstração aprovado.",
  };
}
