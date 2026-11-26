/**
 * Central de ajuda: como funciona, perguntas frequentes, segurança e termos.
 */
import { useState } from "react";
import { REWARDS, WELCOME_POINTS } from "@shared/catalog";
import { Icon } from "@/components/Icon";
import { PageHeader, useDocumentTitle } from "@/components/ui";
import { Link } from "@/lib/router";

const FAQ: { q: string; a: string; group: "viajantes" | "anfitrioes" }[] = [
  { group: "viajantes", q: "Como faço uma reserva?", a: "Abra a acomodação, escolha as datas no calendário e o número de hóspedes e toque em “Solicitar reserva”. O anfitrião recebe o pedido e pode aceitar ou recusar. Você acompanha tudo em Minhas viagens." },
  { group: "viajantes", q: "Como funciona o pagamento?", a: "A SunHost não processa pagamentos e não cobra taxa de serviço. Quando o anfitrião aceita a reserva, o telefone/WhatsApp e o e-mail de vocês dois são liberados para combinar a forma de pagamento diretamente." },
  { group: "viajantes", q: "Posso cancelar?", a: "Sim. Pedidos pendentes podem ser cancelados a qualquer momento, e reservas confirmadas podem ser canceladas até o dia do check-in, em Minhas viagens. Combine com o anfitrião qualquer valor já adiantado." },
  { group: "viajantes", q: "Quem pode avaliar uma acomodação?", a: "Qualquer pessoa com conta pode deixar de 1 a 5 estrelas e um comentário (uma avaliação por acomodação, que pode ser editada). Quem concluiu uma estadia pela SunHost recebe o selo “Hóspede verificado”." },
  { group: "viajantes", q: "O que são os Pontos Cívicos?", a: `Toda conta nova recebe ${WELCOME_POINTS} pontos de boas-vindas, e cada estadia concluída rende de 50 a 120 pontos. Troque o saldo por cupons (a partir de ${REWARDS[0].points} pontos) e aplique o cupom ao solicitar uma reserva: o desconto aparece para o anfitrião no pedido.` },
  { group: "anfitrioes", q: "Quanto custa anunciar?", a: "Nada. Não há mensalidade nem comissão. Você define a diária, a taxa de limpeza e o mínimo de noites, e recebe o valor diretamente do hóspede." },
  { group: "anfitrioes", q: "Por que meu anúncio está “em análise”?", a: "Todo anúncio novo ou editado passa por uma revisão da equipe para evitar golpes e informações falsas. Assim que for aprovado, ele aparece nas buscas. Se algo precisar de ajuste, a observação da equipe aparece no seu painel." },
  { group: "anfitrioes", q: "Posso pausar meu anúncio?", a: "Sim. No painel do anfitrião, use “Pausar” para tirar o espaço das buscas temporariamente, sem perder fotos, avaliações e reservas já confirmadas." },
  { group: "anfitrioes", q: "Como aceito descontos de Pontos Cívicos?", a: "Quando o hóspede aplica um cupom, o código e o valor aparecem na solicitação e o total já vem com o desconto. Basta considerar esse total ao combinar o pagamento." },
];

export default function HelpPage() {
  useDocumentTitle("Central de ajuda");
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="page container narrow help-page">
      <PageHeader eyebrow="Central de ajuda" title="Como a SunHost funciona" text="Tudo o que você precisa saber para viajar ou receber hóspedes em Florianópolis." />

      <div className="help-cards">
        <a href="#viajantes" className="help-card">
          <Icon name="compass" size={26} />
          <strong>Para viajantes</strong>
          <span>Reservas, pagamento, cancelamento e avaliações</span>
        </a>
        <a href="#anfitrioes" className="help-card">
          <Icon name="home" size={26} />
          <strong>Para anfitriões</strong>
          <span>Anúncios, moderação e pedidos de reserva</span>
        </a>
        <a href="#seguranca" className="help-card">
          <Icon name="shield" size={26} />
          <strong>Segurança</strong>
          <span>Como evitar golpes e denunciar anúncios</span>
        </a>
      </div>

      {(["viajantes", "anfitrioes"] as const).map(group => (
        <section key={group} id={group} className="help-section">
          <h2 className="block-title">{group === "viajantes" ? "Viajantes" : "Anfitriões"}</h2>
          <div className="accordion">
            {FAQ.map((item, index) =>
              item.group !== group ? null : (
                <div className={`accordion-item${open === index ? " open" : ""}`} key={item.q}>
                  <button onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index}>
                    {item.q}
                    <Icon name="chevron-down" size={18} />
                  </button>
                  {open === index && <p>{item.a}</p>}
                </div>
              )
            )}
          </div>
        </section>
      ))}

      <section id="seguranca" className="help-section panel">
        <h2 className="block-title">
          <Icon name="shield" size={22} /> Segurança
        </h2>
        <ul className="check-list">
          <li>
            <Icon name="check" size={18} /> Todo anúncio é revisado pela equipe antes de ser publicado.
          </li>
          <li>
            <Icon name="check" size={18} /> Os contatos só são liberados quando a reserva é confirmada pelo anfitrião.
          </li>
          <li>
            <Icon name="check" size={18} /> Desconfie de pedidos de pagamento total antecipado ou de links externos para “confirmar” a reserva.
          </li>
          <li>
            <Icon name="check" size={18} /> Viu algo estranho? Use “Denunciar este anúncio” na página da acomodação.
          </li>
        </ul>
      </section>

      <section id="termos" className="help-section panel">
        <h2 className="block-title">Termos de uso e privacidade</h2>
        <p className="prose">
          A SunHost Floripa é um projeto acadêmico que conecta viajantes e anfitriões. A plataforma não intermedeia pagamentos: valores, formas de pagamento e eventuais reembolsos são combinados diretamente entre as partes, que são responsáveis pelas informações publicadas e pelo cumprimento do que for acordado.
        </p>
        <p className="prose">
          Coletamos apenas os dados necessários para o funcionamento do serviço (nome, e-mail, telefone opcional, foto e conteúdo que você publica). As senhas são armazenadas com hash e sal individuais. Telefone e e-mail só são exibidos à outra parte de uma reserva confirmada. Você pode editar seus dados ou excluir a conta a qualquer momento em <Link to="/conta">Conta e perfil</Link>, conforme a LGPD.
        </p>
      </section>
    </div>
  );
}
