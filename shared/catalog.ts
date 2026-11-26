/**
 * Catálogo compartilhado entre o servidor e a interface: tipos de espaço,
 * comodidades, bairros sugeridos e recompensas de Pontos Cívicos.
 */

export const CATEGORIES = [
  "Casa inteira",
  "Apartamento inteiro",
  "Estúdio/Loft",
  "Chalé/Cabana",
  "Quarto privativo",
  "Pousada",
] as const;

export const AMENITIES = [
  "Wi‑Fi",
  "Cozinha equipada",
  "Ar-condicionado",
  "Estacionamento",
  "Espaço de trabalho",
  "Máquina de lavar",
  "TV",
  "Varanda",
  "Vista para o mar",
  "Pé na areia",
  "Piscina",
  "Churrasqueira",
  "Jardim",
  "Chuveiro externo",
  "Aceita pets",
  "Café da manhã",
  "Acessibilidade",
  "Banheira/ofurô",
] as const;

export const DISTRICTS = [
  "Lagoa da Conceição",
  "Barra da Lagoa",
  "Praia Mole",
  "Joaquina",
  "Campeche",
  "Centro",
  "Jurerê Internacional",
  "Canasvieiras",
  "Ingleses",
  "Santinho",
  "Santo Antônio de Lisboa",
  "Ribeirão da Ilha",
  "Armação",
  "Pântano do Sul",
  "Rio Tavares",
  "Trindade",
  "Coqueiros",
] as const;

export type Reward = { id: number; points: number; amount: number; title: string; detail: string };

export const REWARDS: Reward[] = [
  { id: 1, points: 200, amount: 20, title: "R$ 20 de desconto", detail: "na próxima estadia elegível" },
  { id: 2, points: 250, amount: 25, title: "R$ 25 de desconto", detail: "na próxima estadia elegível" },
  { id: 3, points: 400, amount: 45, title: "R$ 45 de desconto", detail: "para viagens de 2 noites ou mais" },
  { id: 4, points: 500, amount: 60, title: "R$ 60 de desconto", detail: "para guardar para a próxima escapada" },
];

/** Bônus de boas-vindas creditado em toda conta nova. */
export const WELCOME_POINTS = 250;

/** Pontos por estadia concluída, proporcionais ao valor da diária (50 a 120). */
export function pointsForPrice(price: number) {
  return Math.min(120, Math.max(50, Math.round((price * 0.3) / 5) * 5));
}

export const REPORT_REASONS = [
  "Informações falsas ou enganosas",
  "Fotos que não correspondem ao espaço",
  "Anúncio duplicado",
  "Golpe ou pedido de pagamento suspeito",
  "Conteúdo ofensivo",
  "Outro motivo",
] as const;
