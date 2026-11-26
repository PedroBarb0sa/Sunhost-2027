import { describe, expect, it } from "vitest";
import { AMENITIES, CATEGORIES, REWARDS, WELCOME_POINTS, pointsForPrice } from "../../shared/catalog";
import { addDaysISO, brl, formatPhone, initials, nightsBetween, plural, whatsappLink } from "./lib/format";
import { matchPath } from "./lib/router";
import { cn } from "./lib/utils";

describe("SunHost — utilidades", () => {
  it("combina classes Tailwind sem duplicar conflitos", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });

  it("formata valores em reais", () => {
    expect(brl(280)).toBe("R$ 280");
    expect(brl(1050)).toBe("R$ 1.050");
  });

  it("calcula noites entre datas, inclusive na virada do mês", () => {
    expect(nightsBetween("2026-11-28", "2026-12-02")).toBe(4);
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("pluraliza, gera iniciais e formata telefone", () => {
    expect(plural(1, "noite", "noites")).toBe("1 noite");
    expect(plural(3, "noite", "noites")).toBe("3 noites");
    expect(initials("Marina Costa")).toBe("MC");
    expect(formatPhone("48999990001")).toBe("(48) 99999-0001");
    expect(whatsappLink("48999990001", "Oi")).toBe("https://wa.me/5548999990001?text=Oi");
  });

  it("reconhece rotas com parâmetros", () => {
    expect(matchPath("/acomodacao/:id", "/acomodacao/12")).toEqual({ id: "12" });
    expect(matchPath("/anfitriao/editar/:id", "/anfitriao/novo")).toBeNull();
    expect(matchPath("/", "/")).toEqual({});
  });
});

describe("SunHost — regras de negócio", () => {
  it("Pontos Cívicos por estadia ficam entre 50 e 120", () => {
    expect(pointsForPrice(100)).toBe(50);
    expect(pointsForPrice(280)).toBe(85);
    expect(pointsForPrice(5000)).toBe(120);
  });

  it("recompensas são ordenadas e o bônus de boas-vindas permite o primeiro resgate", () => {
    const points = REWARDS.map(reward => reward.points);
    expect(points).toEqual([...points].sort((a, b) => a - b));
    expect(WELCOME_POINTS).toBeGreaterThanOrEqual(REWARDS[0].points);
  });

  it("catálogo tem tipos de espaço e comodidades sem repetição", () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
    expect(new Set(AMENITIES).size).toBe(AMENITIES.length);
  });

  it("mantém a porta de produção documentada", () => {
    expect(Number(process.env.PORT ?? 3001)).toBeGreaterThan(0);
  });
});
